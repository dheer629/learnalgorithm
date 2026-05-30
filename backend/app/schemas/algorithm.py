from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    name: str
    description: str | None = None
    algorithm_count: int = 0


class AlgorithmListOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    name: str
    category_slug: str
    description: str | None = None
    tags: list[str]
    difficulty: str


class AlgorithmExampleOut(BaseModel):
    title: str
    command: str
    runnable_code: str
    stdin: str = ""
    expected_output: str = ""
    actual_output: str = ""
    matched: bool | None = None
    status: str
    validation_error: str | None = None
    execution_time_ms: int | None = None
    runner: str | None = None
    python_version: str | None = None
    exit_code: int | None = None
    logs: list[str] = Field(default_factory=list)


class AlgorithmDetailOut(AlgorithmListOut):
    source_path: str
    source_url: str
    source_code: str
    functions: list[dict]
    doctests: list[str]
    examples: list[AlgorithmExampleOut] = Field(default_factory=list)
    complexity: dict
    related: list[AlgorithmListOut] = Field(default_factory=list)


class ExecuteRequest(BaseModel):
    code: str
    stdin: str = ""
    args: list[str] = Field(default_factory=list)


class ExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    output: str
    execution_time_ms: int | None = None
    status: str = "completed"
    runner: str = "unknown"
    python_version: str | None = None
    exit_code: int | None = None
    logs: list[str] = Field(default_factory=list)


class VisualizeRequest(BaseModel):
    code: str
    stdin: str = ""
    args: list[str] = Field(default_factory=list)
    max_steps: int = Field(default=120, ge=1, le=300)


class TraceValueOut(BaseModel):
    name: str
    kind: str
    preview: str
    size: int | None = None
    items: list[dict[str, Any]] = Field(default_factory=list)
    numeric_items: list[float] = Field(default_factory=list)


class TraceStepOut(BaseModel):
    index: int
    event: str
    line_no: int | None = None
    line_text: str = ""
    function: str = "<module>"
    locals: list[TraceValueOut] = Field(default_factory=list)
    stdout: str = ""
    stderr: str = ""
    narration: str = ""


class VisualizeResponse(BaseModel):
    status: str = "completed"
    runner: str = "local-python-trace"
    python_version: str | None = None
    exit_code: int | None = None
    execution_time_ms: int | None = None
    stdout: str = ""
    stderr: str = ""
    output: str = ""
    steps: list[TraceStepOut] = Field(default_factory=list)
    logs: list[str] = Field(default_factory=list)
