from pydantic import BaseModel, Field

from app.model.account import UserRole


class AdminOperatorDTO(BaseModel):
    operator_id: int
    role: UserRole
    permission_codes: list[str] = Field(default_factory=list)
