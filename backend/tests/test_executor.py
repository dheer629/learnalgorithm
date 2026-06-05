from types import SimpleNamespace

import pytest

from app.schemas.algorithm import ExecuteRequest, VisualizeRequest
from app.services.executor import UnsafeCodeError, execute_python, execute_python_local, validate_code
from app.services.visualizer import visualize_python


def test_ast_sandbox_rejects_file_access() -> None:
    with pytest.raises(UnsafeCodeError, match="open"):
        validate_code("open('secret.txt').read()")


def test_ast_sandbox_rejects_blocked_imports() -> None:
    with pytest.raises(UnsafeCodeError, match="os"):
        validate_code("import os\nprint(os.environ)")


@pytest.mark.asyncio
async def test_local_executor_runs_successfully() -> None:
    result = await execute_python_local(ExecuteRequest(code="print(sum([1, 2, 3]))"))

    assert result.status == "completed"
    assert result.output.strip() == "6"
    assert result.runner == "local-python"


@pytest.mark.asyncio
async def test_remote_executor_truncates_combined_output(monkeypatch) -> None:
    output_limit = 32
    large_output = "x" * 80

    class FakeResponse:
        status_code = 200

        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"run": {"stdout": large_output, "stderr": "", "output": large_output, "code": 0}}

    class FakeAsyncClient:
        def __init__(self, *_, **__) -> None:
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_) -> None:
            return None

        async def post(self, *_, **__) -> FakeResponse:
            return FakeResponse()

    monkeypatch.setattr("app.services.executor.httpx.AsyncClient", FakeAsyncClient)
    monkeypatch.setattr(
        "app.services.executor.get_settings",
        lambda: SimpleNamespace(
            piston_url="https://example.test/execute",
            execution_timeout_seconds=5,
            execution_output_limit_bytes=output_limit,
            local_memory_limit_mb=256,
        ),
    )

    result = await execute_python(ExecuteRequest(code="print('hello')"))

    assert result.status == "completed"
    assert result.stdout.endswith("[truncated]\n")
    assert result.output.endswith("[truncated]\n")
    assert len(result.output.encode("utf-8")) <= output_limit + len("\n[truncated]\n")
    assert any("combined output" in log for log in result.logs)


@pytest.mark.asyncio
async def test_local_executor_times_out() -> None:
    result = await execute_python_local(ExecuteRequest(code="while True:\n    pass"), timeout_seconds=1)

    assert result.status == "timeout"
    assert "timed out" in result.stderr


@pytest.mark.asyncio
async def test_visualizer_enforces_step_limit() -> None:
    result = await visualize_python(
        VisualizeRequest(code="total = 0\nfor value in range(100):\n    total += value\nprint(total)", max_steps=6)
    )

    assert result.status == "truncated"
    assert len(result.steps) == 6
    assert any("Trace stopped" in line for line in result.logs)
