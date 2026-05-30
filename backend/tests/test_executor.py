import pytest

from app.schemas.algorithm import ExecuteRequest, VisualizeRequest
from app.services.executor import UnsafeCodeError, execute_python_local, validate_code
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
