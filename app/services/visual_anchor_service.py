"""
Lightweight visual anchor normalization for storybook generation.

Anchors are weak continuity hints. They should never block the main story /
storyboard flow, and invalid anchor data is dropped instead of raising.
"""
from __future__ import annotations

import re
from typing import Any, Optional

from app.schemas.storyboard import Storyboard
from app.schemas.visual_anchor import VisualAnchor


_ANCHOR_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_STORYBOARD_KEYS = ("summary", "visual_brief", "anchor_refs", "must_include", "composition", "avoid")


def _text(value: Any, max_len: int = 500) -> str:
    if value is None:
        return ""
    return str(value).strip()[:max_len]


def _string_list(value: Any, *, max_items: int = 6, max_len: int = 120) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        items = [value]
    elif isinstance(value, list):
        items = value
    else:
        items = [value]
    result: list[str] = []
    for item in items:
        text = _text(item, max_len=max_len)
        if text:
            result.append(text)
        if len(result) >= max_items:
            break
    return result


def normalize_visual_anchors(
    raw: Any,
    *,
    has_character_reference_images: bool = False,
) -> list[VisualAnchor]:
    """Filter model/user anchor data down to the phase-2 weak-anchor contract."""
    if not isinstance(raw, list):
        return []

    anchors: list[VisualAnchor] = []
    character_count = 0
    object_count = 0
    seen_ids: set[str] = set()

    for item in raw:
        if not isinstance(item, dict):
            continue
        anchor_id = _text(item.get("id"), max_len=64)
        anchor_type = _text(item.get("type"), max_len=32).lower()
        if not anchor_id or not _ANCHOR_ID_RE.match(anchor_id) or anchor_id in seen_ids:
            continue
        if anchor_type == "scene":
            continue
        if anchor_type not in {"character", "object"}:
            continue
        if anchor_type == "character" and has_character_reference_images:
            continue
        if anchor_type == "character":
            if character_count >= 3:
                continue
            character_count += 1
        if anchor_type == "object":
            if object_count >= 5:
                continue
            object_count += 1

        name = _text(item.get("name") or anchor_id, max_len=80)
        description = _text(
            item.get("description")
            or item.get("visual_description")
            or item.get("appearance")
            or "",
            max_len=500,
        )
        anchor: VisualAnchor = {
            "id": anchor_id,
            "type": anchor_type,
            "name": name,
            "description": description,
        }
        key_attributes = _string_list(item.get("key_attributes") or item.get("attributes"), max_items=6)
        if key_attributes:
            anchor["key_attributes"] = key_attributes
        anchors.append(anchor)
        seen_ids.add(anchor_id)

    return anchors


def normalize_storyboard(raw: Any, fallback_text: str = "") -> Optional[Storyboard]:
    """Normalize current and legacy storyboard shapes to the phase-2 weak structure."""
    if not isinstance(raw, dict):
        return None

    summary = _text(raw.get("summary") or fallback_text)
    visual_brief = _text(raw.get("visual_brief") or raw.get("scene") or summary)
    must_include = _string_list(
        raw.get("must_include") or raw.get("characters"),
        max_items=6,
    )
    composition = _text(raw.get("composition") or raw.get("shot"), max_len=300)
    avoid = _string_list(raw.get("avoid"), max_items=6)
    anchor_refs = _string_list(raw.get("anchor_refs"), max_items=3, max_len=64)

    return {
        "summary": summary,
        "visual_brief": visual_brief,
        "anchor_refs": anchor_refs,
        "must_include": must_include,
        "composition": composition,
        "avoid": avoid,
    }


def clean_storyboard_anchor_refs(storyboard: Optional[Storyboard], anchors: list[VisualAnchor]) -> Optional[Storyboard]:
    """Drop refs that do not point to normalized anchors, keeping at most three."""
    if storyboard is None:
        return None
    valid_ids = {anchor["id"] for anchor in anchors}
    refs = [
        ref
        for ref in _string_list(storyboard.get("anchor_refs"), max_items=3, max_len=64)
        if ref in valid_ids
    ]
    cleaned = {key: storyboard.get(key) for key in _STORYBOARD_KEYS}
    cleaned["anchor_refs"] = refs[:3]
    return cleaned


def clean_storyboards_anchor_refs(
    storyboards: list[Optional[Storyboard]],
    anchors: list[VisualAnchor],
) -> list[Optional[Storyboard]]:
    return [clean_storyboard_anchor_refs(storyboard, anchors) for storyboard in storyboards]


def anchors_for_storyboard(
    storyboard: Optional[Storyboard],
    visual_anchors: Any,
) -> list[VisualAnchor]:
    """Resolve only the anchors referenced by one page storyboard."""
    anchors = normalize_visual_anchors(visual_anchors)
    if not anchors or not storyboard:
        return []
    refs = _string_list(storyboard.get("anchor_refs"), max_items=3, max_len=64)
    if not refs:
        return []
    by_id = {anchor["id"]: anchor for anchor in anchors}
    return [by_id[ref] for ref in refs if ref in by_id][:3]


def format_anchors_for_prompt(anchors: list[VisualAnchor], *, language: str = "en") -> str:
    if not anchors:
        return "None" if language == "en" else "无"
    lines: list[str] = []
    for anchor in anchors[:3]:
        attrs = anchor.get("key_attributes") or []
        attr_text = "; ".join(attrs)
        if language == "zh":
            line = f"- {anchor['id']} ({anchor['type']}): {anchor['name']}。{anchor.get('description', '')}"
            if attr_text:
                line += f" 关键属性：{attr_text}"
        else:
            line = f"- {anchor['id']} ({anchor['type']}): {anchor['name']}. {anchor.get('description', '')}"
            if attr_text:
                line += f" Key attributes: {attr_text}"
        lines.append(line.strip())
    return "\n".join(lines)
