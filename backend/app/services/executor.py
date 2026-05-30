import ast
import asyncio
import os
import sys
import tempfile
import time

import httpx

from app.core.config import get_settings
from app.schemas.algorithm import ExecuteRequest, ExecuteResponse

BLOCKED_MODULES = {
    "builtins",
    "ctypes",
    "importlib",
    "multiprocessing",
    "os",
    "pathlib",
    "requests",
    "shutil",
    "socket",
    "subprocess",
    "sysconfig",
    "urllib",
}
BLOCKED_CALLS = {
    "__import__",
    "breakpoint",
    "compile",
    "eval",
    "exec",
    "getattr",
    "globals",
    "input.__self__",
    "locals",
    "memoryview",
    "open",
    "setattr",
    "vars",
}
BLOCKED_ATTRIBUTE_NAMES = {"environ", "popen", "system"}
BLOCKED_TOKENS = ("__builtins__", "__loader__", "__spec__", "__import__", "open(", "eval(", "exec(")


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
    stdout, stdout_truncated = _truncate(stdout, settings.execution_output_limit_bytes)
    stderr, stderr_truncated = _truncate(stderr, settings.execution_output_limit_bytes)
    exit_code = result.get("code")
    status = "completed" if not stderr and exit_code in (None, 0) else "failed"
    logs.append(f"Runner finished with exit code {exit_code if exit_code is not None else 'unknown'}.")
    if stdout_truncated or stderr_truncated:
        logs.append(f"Output was truncated to {settings.execution_output_limit_bytes} bytes per stream.")
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
    with tempfile.TemporaryDirectory(prefix="algolearn-run-") as temp_dir:
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            "-I",
            "-c",
            payload.code,
            *payload.args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=temp_dir,
            env={"PYTHONIOENCODING": "utf-8"},
            **_platform_resource_kwargs(settings.local_memory_limit_mb),
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

    stdout_text, stdout_truncated = _truncate(stdout.decode(errors="replace"), settings.execution_output_limit_bytes)
    stderr_text, stderr_truncated = _truncate(stderr.decode(errors="replace"), settings.execution_output_limit_bytes)
    if stdout_truncated or stderr_truncated:
        logs.append(f"Output was truncated to {settings.execution_output_limit_bytes} bytes per stream.")

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
    settings = get_settings()
    if len(code) > 30_000:
        raise UnsafeCodeError("Code is too large for the shared sandbox.")
    for token in BLOCKED_TOKENS:
        if token in code:
            raise UnsafeCodeError(f"The sandbox blocks use of {token}.")
    if len(code.encode("utf-8")) > settings.execution_output_limit_bytes:
        raise UnsafeCodeError("Code is too large for the shared sandbox.")
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            _validate_import(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            _validate_import([node.module or ""])
        elif isinstance(node, ast.Call):
            call_name = _call_name(node.func)
            if call_name in BLOCKED_CALLS:
                raise UnsafeCodeError(f"The sandbox blocks {call_name}().")
        elif isinstance(node, ast.Attribute):
            if node.attr.startswith("__") or node.attr in BLOCKED_ATTRIBUTE_NAMES:
                raise UnsafeCodeError(f"The sandbox blocks access to attribute {node.attr}.")
        elif isinstance(node, ast.Name) and node.id.startswith("__") and node.id not in {"__name__", "__file__"}:
            raise UnsafeCodeError(f"The sandbox blocks access to {node.id}.")


def _validate_import(names) -> None:
    for name in names:
        root = name.split(".")[0]
        if root in BLOCKED_MODULES:
            raise UnsafeCodeError(f"The sandbox blocks importing {root}.")


def _call_name(node: ast.expr) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        parts = [node.attr]
        value = node.value
        while isinstance(value, ast.Attribute):
            parts.append(value.attr)
            value = value.value
        if isinstance(value, ast.Name):
            parts.append(value.id)
        return ".".join(reversed(parts))
    return ""


def _truncate(value: str, limit: int) -> tuple[str, bool]:
    encoded = value.encode("utf-8", errors="replace")
    if len(encoded) <= limit:
        return value, False
    return encoded[:limit].decode("utf-8", errors="replace") + "\n[truncated]\n", True


def _platform_resource_kwargs(memory_limit_mb: int) -> dict:
    if os.name == "nt":
        return {}

    def limit_resources() -> None:
        import resource

        memory_limit = memory_limit_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (memory_limit, memory_limit))
        resource.setrlimit(resource.RLIMIT_NPROC, (32, 32))

    return {"preexec_fn": limit_resources}
