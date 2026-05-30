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

