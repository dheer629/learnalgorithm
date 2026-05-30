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
        except (httpx.HTTPError, ValueError):
            return await execute_python_local(payload, started, settings.execution_timeout_seconds)
    elapsed = int((time.perf_counter() - started) * 1000)
    result = response.json().get("run", {}) if response else {}
    return ExecuteResponse(
        stdout=result.get("stdout", ""),
        stderr=result.get("stderr", ""),
        output=result.get("output", ""),
        execution_time_ms=elapsed,
    )


async def execute_python_local(
    payload: ExecuteRequest,
    started: float | None = None,
    timeout_seconds: int | None = None,
) -> ExecuteResponse:
    validate_code(payload.code)
    settings = get_settings()
    started = started or time.perf_counter()
    timeout_seconds = timeout_seconds or settings.execution_timeout_seconds
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
        return ExecuteResponse(
            stdout="",
            stderr=f"Execution timed out after {timeout_seconds} seconds.",
            output=f"Execution timed out after {timeout_seconds} seconds.",
            execution_time_ms=elapsed,
        )

    stdout_text = stdout.decode(errors="replace")
    stderr_text = stderr.decode(errors="replace")
    elapsed = int((time.perf_counter() - started) * 1000)
    return ExecuteResponse(
        stdout=stdout_text,
        stderr=stderr_text,
        output=stdout_text + stderr_text,
        execution_time_ms=elapsed,
    )


def validate_code(code: str) -> None:
    if len(code) > 30_000:
        raise UnsafeCodeError("Code is too large for the shared sandbox.")
    if any(token in code for token in BLOCKED_TOKENS):
        raise UnsafeCodeError("This code uses APIs that are disabled in the learning sandbox.")
