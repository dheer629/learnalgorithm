from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserProgress(Base):
    __tablename__ = "user_progress"
    __table_args__ = (UniqueConstraint("user_id", "algorithm_id", name="uq_progress_user_algorithm"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(160), index=True)
    algorithm_id: Mapped[str] = mapped_column(ForeignKey("algorithms.id"))
    state: Mapped[str] = mapped_column(String(40), default="viewed")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
