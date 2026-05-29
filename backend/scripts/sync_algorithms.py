import asyncio
from pathlib import Path

from app.db.session import AsyncSessionLocal
from app.services.ingestion import sync_repository


async def main() -> None:
    async with AsyncSessionLocal() as session:
        result = await sync_repository(session, Path("data/upstream"))
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
