"""
Visual anchor schema types shared across storybook generation layers.
"""
from typing import NotRequired, TypedDict


class VisualAnchor(TypedDict):
    id: str
    type: str
    name: str
    description: str
    key_attributes: NotRequired[list[str]]
