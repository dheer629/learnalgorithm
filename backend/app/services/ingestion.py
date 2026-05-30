from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.algorithm import Algorithm, Category
from app.services.parser import parse_python_file

UPSTREAM = "https://github.com/TheAlgorithms/Python.git"
RAW_BASE = "https://github.com/TheAlgorithms/Python/blob/master"


def slugify(value: str) -> str:
    return "-".join(value.lower().replace("_", "-").split())


async def sync_repository(session: AsyncSession, repo_dir: Path) -> dict:
    repo_path = _ensure_repo(repo_dir)
    count = 0
    skipped = 0
    for file_path in repo_path.rglob("*.py"):
        if _skip(file_path, repo_path):
            continue
        relative = file_path.relative_to(repo_path)
        try:
            parsed = parse_python_file(file_path)
        except SyntaxError:
            skipped += 1
            continue
        category_name = relative.parts[0].replace("_", " ").title()
        category_slug = slugify(relative.parts[0])
        category = await _get_or_create_category(session, category_slug, category_name)
        slug = slugify("/".join(relative.with_suffix("").parts))
        result = await session.execute(select(Algorithm).where(Algorithm.source_path == str(relative)))
        algorithm = result.scalar_one_or_none() or Algorithm(source_path=str(relative))
        algorithm.slug = slug
        algorithm.name = parsed.name
        algorithm.category_id = category.id
        algorithm.source_url = f"{RAW_BASE}/{relative.as_posix()}"
        algorithm.description = parsed.description or "No description is available yet."
        algorithm.source_code = parsed.source_code
        algorithm.functions = parsed.functions
        algorithm.doctests = parsed.doctests
        algorithm.complexity = parsed.complexity
        algorithm.tags = [category_slug, *relative.parts[:-1]]
        algorithm.difficulty = _difficulty(parsed.source_code, parsed.functions)
        session.add(algorithm)
        count += 1
    await session.flush()
    await session.execute(
        text(
            "UPDATE algorithms SET search_vector = "
            "to_tsvector('english', coalesce(name,'') || ' ' || "
            "coalesce(description,'') || ' ' || array_to_string(tags, ' '))"
        )
    )
    await session.commit()
    return {"synced": count, "skipped": skipped, "repo": str(repo_path)}


def _ensure_repo(repo_dir: Path) -> Path:
    repo_path = repo_dir / "TheAlgorithms-Python"
    if repo_path.exists():
        subprocess.run(["git", "-C", str(repo_path), "pull", "--ff-only"], check=True)
    else:
        if repo_dir.exists():
            shutil.rmtree(repo_dir)
        repo_dir.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--depth", "1", UPSTREAM, str(repo_path)], check=True)
    return repo_path


def _skip(file_path: Path, repo_path: Path) -> bool:
    relative = file_path.relative_to(repo_path)
    blocked = {"tests", ".github", "scripts", "project_euler"}
    return any(part.startswith(".") or part in blocked for part in relative.parts) or file_path.name.startswith("__")


async def _get_or_create_category(session: AsyncSession, slug: str, name: str) -> Category:
    result = await session.execute(select(Category).where(Category.slug == slug))
    category = result.scalar_one_or_none()
    if category:
        return category
    category = Category(slug=slug, name=name, description=f"{name} algorithms from TheAlgorithms/Python.")
    session.add(category)
    await session.flush()
    return category


def _difficulty(source: str, functions: list[dict]) -> str:
    lines = len(source.splitlines())
    if lines < 90 and len(functions) <= 2:
        return "beginner"
    if lines > 220 or len(functions) > 6:
        return "advanced"
    return "intermediate"
