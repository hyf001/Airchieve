"""
Storyboard schema types shared by ORM models and API schemas.
"""
from typing import NotRequired, TypedDict


class Storyboard(TypedDict):
    summary: NotRequired[str]       # 当前页视觉摘要
    visual_brief: NotRequired[str]  # 自然语言画面目标
    anchor_refs: NotRequired[list[str]]
    must_include: NotRequired[list[str]]
    composition: NotRequired[str]
    avoid: NotRequired[list[str]]
