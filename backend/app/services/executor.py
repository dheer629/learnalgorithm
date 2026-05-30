import asyncio
import sys
import time

import httpx

from app.core.config import get_settings
from app.schemas.algorithm import ExecuteRequest, ExecuteResponse

BLOCKED_TOKENS = ("import os", "import subprocess", "socket", "open(", "__import__", "eval(", "exec(")


class UnsafeCodeError(ValueError):
    pass


async def execute_python(payload: ExecuteRequest) -> ExecuteResponse:
    validate_code(payload.code)

    settings = get_settings()
    started = time.perf_counter()
    logs = [
        "Execution request accepted by Algorithm Learn API.",
        f"Primary runner: Piston API at {settings.piston_url}.",
    ]
    response: httpx.Response | None = None
    async with httpx.AsyncClient(timeout=settings.execution_timeout_seconds + 2) as client:
        try:
            response = await client.post(
                str(settings.piston_url),
                json={
                    "language": "python",
                    "version": "3.10.0",
                    "files": [{"name": "main.py", "content": payload.code}],
                    "stdin": payload.stdin,
                    "args": payload.args,
                    "run_timeout": settings.execution_timeout_seconds * 1000,
                },
            )
            response.raise_for_status()
            logs.append(f"Piston API responded with HTTP {response.status_code}.")
        except (httpx.HTTPError, ValueError) as exc:
            logs.append(f"Piston runner unavailable: {type(exc).__name__}: {exc}")
            logs.append("Falling back to the local isolated Python interpreter in the backend container.")
            return await execute_python_local(payload, started, settings.execution_timeout_seconds, logs)
    elapsed = int((time.perf_counter() - started) * 1000)
    result = response.json().get("run", {}) if response else {}
    stdout = result.get("stdout", "")
    stderr = result.get("stderr", "")
    exit_code = result.get("code")
    status = "completed" if not stderr and exit_code in (None, 0) else "failed"
    logs.append(f"Runner finished with exit code {exit_code if exit_code is not None else 'unknown'}.")
    return ExecuteResponse(
        stdout=stdout,
        stderr=stderr,
        output=result.get("output", stdout + stderr),
        execution_time_ms=elapsed,
        status=status,
        runner="piston",
        python_version="python 3.10.0",
        exit_code=exit_code,
        logs=logs,
    )


async def execute_python_local(
    payload: ExecuteRequest,
    started: float | None = None,
    timeout_seconds: int | None = None,
    logs: list[str] | None = None,
) -> ExecuteResponse:
    validate_code(payload.code)
    settings = get_settings()
    started = started or time.perf_counter()
    timeout_seconds = timeout_seconds or settings.execution_timeout_seconds
    logs = logs or ["Execution request accepted by Algorithm Learn API."]
    logs.extend(
        [
            "Runner selected: local isolated Python interpreter.",
            f"Python executable: {sys.executable}",
            f"Python version: {sys.version.split()[0]}",
            "Command: python -I -c <user-code>",
        ]
    )
    process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-I",
        "-c",
        payload.code,
        *payload.args,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(payload.stdin.encode()),
            timeout=timeout_seconds,
        )
    except TimeoutError:
        process.kill()
        await process.wait()
        elapsed = int((time.perf_counter() - started) * 1000)
        logs.append(f"Execution exceeded timeout of {timeout_seconds} seconds and was stopped.")
        return ExecuteResponse(
            stdout="",
            stderr=f"Execution timed out after {timeout_seconds} seconds.",
            output=f"Execution timed out after {timeout_seconds} seconds.",
            execution_time_ms=elapsed,
            status="timeout",
            runner="local-python",
            python_version=sys.version.split()[0],
            exit_code=None,
            logs=logs,
        )

    stdout_text = stdout.decode(errors="replace")
    stderr_text = stderr.decode(errors="replace")
    elapsed = int((time.perf_counter() - started) * 1000)
    exit_code = process.returncode
    status = "completed" if exit_code == 0 else "failed"
    logs.append(f"Process exited with code {exit_code}.")
    if stdout_text:
        logs.append(f"stdout captured: {len(stdout_text)} characters.")
    if stderr_text:
        logs.append(f"stderr captured: {len(stderr_text)} characters.")
    return ExecuteResponse(
        stdout=stdout_text,
        stderr=stderr_text,
        output=stdout_text + stderr_text,
        execution_time_ms=elapsed,
        status=status,
        runner="local-python",
        python_version=sys.version.split()[0],
        exit_code=exit_code,
        logs=logs,
    )


def validate_code(code: str) -> None:
    if len(code) > 30_000:
        raise UnsafeCodeError("Code is too large for the shared sandbox.")
    if any(token in code for token in BLOCKED_TOKENS):
        raise UnsafeCodeError("This code uses APIs that are disabled in the learning sandbox.")
