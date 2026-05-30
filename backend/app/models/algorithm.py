from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    algorithms: Mapped[list["Algorithm"]] = relationship(back_populates="category")


class Algorithm(Base):
    __tablename__ = "algorithms"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(220), index=True)
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"))
    source_path: Mapped[str] = mapped_column(String(500), unique=True)
    source_url: Mapped[str] = mapped_column(String(800))
    description: Mapped[str | None] = mapped_column(Text)
    source_code: Mapped[str] = mapped_column(Text)
    functions: Mapped[list[dict]] = mapped_column(JSONB, default=list)
    imports: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    doctests: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    complexity: Mapped[dict] = mapped_column(JSONB, default=dict)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    difficulty: Mapped[str] = mapped_column(String(40), default="intermediate")
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    category: Mapped[Category] = relationship(back_populates="algorithms")


Index("ix_algorithms_search_vector", Algorithm.search_vector, postgresql_using="gin")
Index("ix_algorithms_category_id", Algorithm.category_id)
Index("ix_algorithms_difficulty", Algorithm.difficulty)
Index("ix_algorithms_tags", Algorithm.tags, postgresql_using="gin")
