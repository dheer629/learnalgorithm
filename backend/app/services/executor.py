import time

import httpx

from app.core.config import get_settings
from app.schemas.algorithm import ExecuteRequest, ExecuteResponse

BLOCKED_TOKENS = ("import os", "import subprocess", "socket", "open(", "__import__", "eval(", "exec(")


class UnsafeCodeError(ValueError):
    pass


async def execute_python(payload: ExecuteRequest) -> ExecuteResponse:
    if len(payload.code) > 30_000:
        raise UnsafeCodeError("Code is too large for the shared sandbox.")
    if any(token in payload.code for token in BLOCKED_TOKENS):
        raise UnsafeCodeError("This code uses APIs that are disabled in the learning sandbox.")

    settings = get_settings()
    started = time.perf_counter()
    async with httpx.AsyncClient(timeout=settings.execution_timeout_seconds + 2) as client:
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
    elapsed = int((time.perf_counter() - started) * 1000)
    result = response.json().get("run", {})
    return ExecuteResponse(
        stdout=result.get("stdout", ""),
        stderr=result.get("stderr", ""),
        output=result.get("output", ""),
        execution_time_ms=elapsed,
    )

