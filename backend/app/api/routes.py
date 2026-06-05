import asyncio
from datetime import UTC, datetime
from pathlib import Path

import redis.asyncio as redis
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.limiter import limiter
from app.core.security import require_admin_token
from app.db.session import AsyncSessionLocal, get_db
from app.models.algorithm import Algorithm, Category
from app.schemas.algorithm import (
    AlgorithmDetailOut,
    AlgorithmListOut,
    AlgorithmSearchOut,
    CategoryOut,
    ExecuteRequest,
    ExecuteResponse,
    HealthOut,
    ReadyCheckOut,
    SearchMetaOut,
    SyncStatusOut,
    VisualizeRequest,
    VisualizeResponse,
)
from app.services.examples import build_validated_examples
from app.services.executor import UnsafeCodeError, execute_python
from app.services.ingestion import sync_repository
from app.services.visualizer import visualize_python

router = APIRouter()
settings = get_settings()

SYNC_STATUS = SyncStatusOut()
SYNC_LOCK = asyncio.Lock()
SYNC_TASK: asyncio.Task | None = None


@router.get("/health", response_model=HealthOut)
async def health() -> HealthOut:
    return HealthOut(status="ok")


@router.get("/health/live", response_model=HealthOut)
async def health_live() -> HealthOut:
    return HealthOut(status="ok")


@router.get("/health/ready", response_model=ReadyCheckOut)
async def health_ready(db: AsyncSession = Depends(get_db)) -> ReadyCheckOut:
    checks: dict[str, str] = {}
    status = "ready"
    try:
        await db.execute(select(1))
        checks["database"] = "ok"
    except Exception as exc:
        status = "not_ready"
        checks["database"] = type(exc).__name__

    try:
        client = redis.from_url(settings.redis_url, socket_connect_timeout=0.5, socket_timeout=0.5)
        await client.ping()
        await client.aclose()
        checks["redis"] = "ok"
    except Exception as exc:
        checks["redis"] = f"optional:{type(exc).__name__}"

    return ReadyCheckOut(status=status, checks=checks)


@router.post("/admin/sync")
@limiter.limit(settings.rate_limit_admin)
async def sync(
    request: Request,
    background: bool = Query(default=False),
    _: None = Depends(require_admin_token),
    db: AsyncSession = Depends(get_db),
) -> dict:
    global SYNC_TASK
    if background:
        if (SYNC_TASK and not SYNC_TASK.done()) or SYNC_LOCK.locked():
            return SYNC_STATUS.model_dump()
        SYNC_STATUS.status = "running"
        SYNC_STATUS.last_started_at = datetime.now(UTC).isoformat()
        SYNC_STATUS.last_finished_at = None
        SYNC_STATUS.message = "Sync accepted and waiting for the background worker."
        SYNC_TASK = asyncio.create_task(_sync_in_background(Path("data/upstream")))
        return {"status": "accepted", "message": "Sync started in the background."}
    if SYNC_TASK and not SYNC_TASK.done():
        return SYNC_STATUS.model_dump()
    return await _run_sync(db, Path("data/upstream"))


@router.get("/admin/sync/status", response_model=SyncStatusOut)
@limiter.limit(settings.rate_limit_admin)
async def sync_status(request: Request, _: None = Depends(require_admin_token)) -> SyncStatusOut:
    return SYNC_STATUS


@router.post("/admin/validate-examples")
@limiter.limit(settings.rate_limit_admin)
async def validate_examples(
    request: Request,
    include_failures: bool = Query(default=False),
    failure_limit: int = Query(default=25, ge=0, le=200),
    _: None = Depends(require_admin_token),
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


@router.get("/algorithms", response_model=list[AlgorithmListOut] | AlgorithmSearchOut)
async def algorithms(
    category: str | None = None,
    q: str | None = None,
    difficulty: str | None = None,
    tags: list[str] | None = Query(default=None),
    sort: str = Query(default="name", pattern="^-?(name|difficulty|category)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=40, ge=1, le=100),
    meta: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
) -> list[AlgorithmListOut] | AlgorithmSearchOut:
    query = select(Algorithm, Category.slug).join(Category)
    if category:
        query = query.where(Category.slug == category)
    if difficulty:
        query = query.where(Algorithm.difficulty == difficulty)
    for tag in _normalize_tags(tags):
        query = query.where(Algorithm.tags.contains([tag]))
    if q:
        like = f"%{q}%"
        query = query.where(
            or_(
                Algorithm.name.ilike(like),
                Algorithm.description.ilike(like),
                Algorithm.tags.any(q),
                Category.name.ilike(like),
            )
        )

    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    query = _apply_sort(query, sort)
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    rows = (await db.execute(query)).all()
    items = [_list_out(algorithm, category_slug) for algorithm, category_slug in rows]
    if not meta:
        return items
    return AlgorithmSearchOut(
        items=items,
        meta=SearchMetaOut(
            total=total or 0,
            page=page,
            page_size=page_size,
            offset=offset,
            limit=page_size,
            sort=sort,
        ),
    )


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
        imports=algorithm_model.imports,
        doctests=algorithm_model.doctests,
        examples=await build_validated_examples(algorithm_model.source_code),
        complexity=algorithm_model.complexity,
        related=[_list_out(item, item_category) for item, item_category in related_rows],
    )


@router.post("/execute", response_model=ExecuteResponse)
@limiter.limit(settings.rate_limit_execute)
async def execute(payload: ExecuteRequest, request: Request) -> ExecuteResponse:
    try:
        return await execute_python(payload)
    except UnsafeCodeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/visualize", response_model=VisualizeResponse)
@limiter.limit(settings.rate_limit_execute)
async def visualize(payload: VisualizeRequest, request: Request) -> VisualizeResponse:
    try:
        return await visualize_python(payload)
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


def _apply_sort(query, sort: str):
    descending = sort.startswith("-")
    key = sort.removeprefix("-")
    columns = {
        "name": Algorithm.name,
        "difficulty": Algorithm.difficulty,
        "category": Category.name,
    }
    column = columns.get(key, Algorithm.name)
    return query.order_by(column.desc() if descending else column.asc(), Algorithm.name.asc())


def _normalize_tags(tags: list[str] | None) -> list[str]:
    normalized: list[str] = []
    for raw in tags or []:
        normalized.extend(item.strip().lower() for item in raw.split(",") if item.strip())
    return normalized


async def _run_sync(db: AsyncSession, repo_dir: Path) -> dict:
    if SYNC_LOCK.locked():
        return SYNC_STATUS.model_dump()
    async with SYNC_LOCK:
        SYNC_STATUS.status = "running"
        SYNC_STATUS.last_started_at = datetime.now(UTC).isoformat()
        SYNC_STATUS.last_finished_at = None
        SYNC_STATUS.message = "Sync in progress."
        SYNC_STATUS.files_processed = 0
        SYNC_STATUS.algorithms_updated = 0
        SYNC_STATUS.skipped = 0
        SYNC_STATUS.failures = []
        try:
            summary = await sync_repository(db, repo_dir)
        except Exception as exc:
            SYNC_STATUS.status = "failed"
            SYNC_STATUS.last_finished_at = datetime.now(UTC).isoformat()
            SYNC_STATUS.message = str(exc)
            raise

        SYNC_STATUS.status = "completed"
        SYNC_STATUS.last_finished_at = datetime.now(UTC).isoformat()
        fallback_processed = summary.get("synced", 0) + summary.get("skipped", 0)
        SYNC_STATUS.files_processed = int(summary.get("files_processed", fallback_processed))
        SYNC_STATUS.algorithms_updated = int(summary.get("synced", 0))
        SYNC_STATUS.skipped = int(summary.get("skipped", 0))
        SYNC_STATUS.failures = list(summary.get("failures", []))
        SYNC_STATUS.message = "Sync completed."
        return summary


async def _sync_in_background(repo_dir: Path) -> None:
    async with AsyncSessionLocal() as session:
        await _run_sync(session, repo_dir)
