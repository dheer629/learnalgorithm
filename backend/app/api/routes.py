from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.algorithm import Algorithm, Category
from app.schemas.algorithm import AlgorithmDetailOut, AlgorithmListOut, CategoryOut, ExecuteRequest, ExecuteResponse
from app.services.executor import UnsafeCodeError, execute_python
from app.services.ingestion import sync_repository

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.post("/admin/sync")
async def sync(db: AsyncSession = Depends(get_db)) -> dict:
    return await sync_repository(db, Path("data/upstream"))


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
        CategoryOut.model_validate(category).model_copy(update={"algorithm_count": count})
        for category, count in rows
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
        await db.execute(
            select(Algorithm, Category.slug)
            .join(Category)
            .where(Algorithm.slug == slug)
        )
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
