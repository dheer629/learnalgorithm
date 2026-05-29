from pydantic import BaseModel, ConfigDict


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


class AlgorithmDetailOut(AlgorithmListOut):
    source_path: str
    source_url: str
    source_code: str
    functions: list[dict]
    doctests: list[str]
    complexity: dict
    related: list[AlgorithmListOut] = []


class ExecuteRequest(BaseModel):
    code: str
    stdin: str = ""
    args: list[str] = []


class ExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    output: str
    execution_time_ms: int | None = None

