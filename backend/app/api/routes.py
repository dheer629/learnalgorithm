from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.algorithm import Algorithm, Category
from app.schemas.algorithm import AlgorithmDetailOut, AlgorithmListOut, CategoryOut, ExecuteRequest, ExecuteResponse
from app.services.examples import build_validated_examples
from app.services.executor import UnsafeCodeError, execute_python
from app.services.ingestion import sync_repository

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.post("/admin/sync")
async def sync(db: AsyncSession = Depends(get_db)) -> dict:
    return await sync_repository(db, Path("data/upstream"))


@router.post("/admin/validate-examples")
async def validate_examples(
    include_failures: bool = Query(default=False),
    failure_limit: int = Query(default=25, ge=0, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict:
    rows = (await db.execute(select(Algorithm).order_by(Algorithm.name))).scalars().all()
    summary = {
        "algorithms_checked": 0,
        "examples_checked": 0,
        "matched": 0,
        "not_matched": 0,
        "blocked": 0,
        "failed": 0,
        "without_examples": 0,
        "failures": [],
    }
    for algorithm_model in rows:
        examples = await build_validated_examples(algorithm_model.source_code)
        summary["algorithms_checked"] += 1
        if not examples:
            summary["without_examples"] += 1
            continue
        for example in examples:
            summary["examples_checked"] += 1
            if example.status == "matched":
                summary["matched"] += 1
            elif example.status == "blocked":
                summary["blocked"] += 1
            elif example.status == "failed":
                summary["failed"] += 1
            elif example.status == "not-matched":
                summary["not_matched"] += 1
            if include_failures and example.status in {"not-matched", "blocked", "failed"}:
                if len(summary["failures"]) >= failure_limit:
                    continue
                summary["failures"].append(
                    {
                        "algorithm": algorithm_model.name,
                        "slug": algorithm_model.slug,
                        "example": example.title,
                        "status": example.status,
                        "command": example.command,
                        "expected": example.expected_output,
                        "actual": example.actual_output,
                        "error": example.validation_error,
                    }
                )
    return summary


@router.get("/categories", response_model=list[CategoryOut])
async def categories(db: AsyncSession = Depends(get_db)) -> list[CategoryOut]:
    query = (
        select(Category, func.count(Algorithm.id).label("algorithm_count"))
        .join(Algorithm, Algorithm.category_id == Category.id, isouter=True)
        .group_by(Category.id)
        .order_by(Category.name)
    )
    rows = (await db.execute(query)).all()
    return [
        CategoryOut.model_validate(category).model_copy(update={"algorithm_count": count}) for category, count in rows
    ]


@router.get("/algorithms", response_model=list[AlgorithmListOut])
async def algorithms(
    category: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[AlgorithmListOut]:
    query = select(Algorithm, Category.slug).join(Category)
    if category:
        query = query.where(Category.slug == category)
    if q:
        like = f"%{q}%"
        query = query.where(or_(Algorithm.name.ilike(like), Algorithm.description.ilike(like), Algorithm.tags.any(q)))
    query = query.order_by(Algorithm.name).limit(80)
    rows = (await db.execute(query)).all()
    return [_list_out(algorithm, category_slug) for algorithm, category_slug in rows]


@router.get("/algorithms/{slug:path}", response_model=AlgorithmDetailOut)
async def algorithm(slug: str, db: AsyncSession = Depends(get_db)) -> AlgorithmDetailOut:
    row = (
        await db.execute(select(Algorithm, Category.slug).join(Category).where(Algorithm.slug == slug))
    ).one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Algorithm not found")
    algorithm_model, category_slug = row
    related_rows = (
        await db.execute(
            select(Algorithm, Category.slug)
            .join(Category)
            .where(Algorithm.category_id == algorithm_model.category_id, Algorithm.id != algorithm_model.id)
            .limit(4)
        )
    ).all()
    return AlgorithmDetailOut(
        **_list_out(algorithm_model, category_slug).model_dump(),
        source_path=algorithm_model.source_path,
        source_url=algorithm_model.source_url,
        source_code=algorithm_model.source_code,
        functions=algorithm_model.functions,
        doctests=algorithm_model.doctests,
        examples=await build_validated_examples(algorithm_model.source_code),
        complexity=algorithm_model.complexity,
        related=[_list_out(item, item_category) for item, item_category in related_rows],
    )


@router.post("/execute", response_model=ExecuteResponse)
async def execute(payload: ExecuteRequest, request: Request) -> ExecuteResponse:
    try:
        return await execute_python(payload)
    except UnsafeCodeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _list_out(algorithm: Algorithm, category_slug: str) -> AlgorithmListOut:
    return AlgorithmListOut(
        id=algorithm.id,
        slug=algorithm.slug,
        name=algorithm.name,
        category_slug=category_slug,
        description=algorithm.description,
        tags=algorithm.tags,
        difficulty=algorithm.difficulty,
    )
