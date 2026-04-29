"""
gemini_cli 分镜解析兼容性测试
"""

import json
from types import SimpleNamespace

from app.services.gemini_cli import (
    _normalize_storyboard,
    _parse_story_json_response,
    _parse_storyboard_payload,
)


def _response_with_text(text: str):
    return SimpleNamespace(
        candidates=[
            SimpleNamespace(
                content=SimpleNamespace(parts=[SimpleNamespace(text=text)])
            )
        ]
    )


class TestNormalizeStoryboard:
    def test_fills_missing_summary_and_drops_legacy_style_fields(self):
        result = _normalize_storyboard(
            {
                "scene": "forest",
                "characters": "bear walking",
                "shot": "medium shot",
                "color": "warm",
                "lighting": "soft",
            },
            fallback_text="Bear walks through the forest.",
        )

        assert result == {
            "summary": "Bear walks through the forest.",
            "visual_brief": "forest",
            "anchor_refs": [],
            "must_include": ["bear walking"],
            "composition": "medium shot",
            "avoid": [],
        }


class TestParseStoryJsonResponse:
    def test_normalizes_storyboard_items_from_gemini_json(self):
        response = _response_with_text(json.dumps([
            {
                "text": "Bear finds a lamp.",
                "storyboard": {
                    "scene": "forest path",
                    "characters": "bear holding a lamp",
                    "shot": "wide shot",
                    "color": "blue",
                    "lighting": "moonlight",
                },
            }
        ]))

        story_texts, storyboards = _parse_story_json_response(response)

        assert story_texts == ["Bear finds a lamp."]
        assert storyboards == [
            {
                "summary": "Bear finds a lamp.",
                "visual_brief": "forest path",
                "anchor_refs": [],
                "must_include": ["bear holding a lamp"],
                "composition": "wide shot",
                "avoid": [],
            }
        ]


class TestParseStoryboardPayload:
    def test_parses_anchors_and_cleans_page_refs(self):
        story_texts, storyboards, anchors = _parse_storyboard_payload(
            {
                "anchors": [
                    {
                        "id": "bear_01",
                        "type": "character",
                        "name": "Little Bear",
                        "description": "small bear",
                    },
                    {
                        "id": "lamp_01",
                        "type": "object",
                        "name": "Star Lamp",
                        "description": "warm lamp",
                    },
                ],
                "pages": [
                    {
                        "text": "Bear finds a lamp.",
                        "storyboard": {
                            "summary": "Bear finds a lamp on the forest path.",
                            "visual_brief": "Bear picks up the lamp.",
                            "anchor_refs": ["bear_01", "missing_01", "lamp_01"],
                            "must_include": ["Bear", "lamp"],
                            "composition": "medium shot",
                            "avoid": ["text"],
                        },
                    }
                ],
            }
        )

        assert story_texts == ["Bear finds a lamp."]
        assert storyboards[0]["anchor_refs"] == ["bear_01", "lamp_01"]
        assert [anchor["id"] for anchor in anchors] == ["bear_01", "lamp_01"]

    def test_removes_character_anchors_when_reference_images_exist(self):
        _story_texts, storyboards, anchors = _parse_storyboard_payload(
            {
                "anchors": [
                    {"id": "bear_01", "type": "character", "name": "Little Bear"},
                    {"id": "lamp_01", "type": "object", "name": "Star Lamp"},
                ],
                "pages": [
                    {
                        "text": "Bear carries a lamp.",
                        "storyboard": {
                            "summary": "Bear carries a lamp.",
                            "anchor_refs": ["bear_01", "lamp_01"],
                        },
                    }
                ],
            },
            has_character_reference_images=True,
        )

        assert anchors == [
            {"id": "lamp_01", "type": "object", "name": "Star Lamp", "description": ""}
        ]
        assert storyboards[0]["anchor_refs"] == ["lamp_01"]
