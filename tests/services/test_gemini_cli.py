"""
gemini_cli 分镜解析兼容性测试
"""

import json
from types import SimpleNamespace

from app.services.gemini_cli import _normalize_storyboard, _parse_story_json_response


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
            "scene": "forest",
            "characters": "bear walking",
            "shot": "medium shot",
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
                "scene": "forest path",
                "characters": "bear holding a lamp",
                "shot": "wide shot",
            }
        ]
