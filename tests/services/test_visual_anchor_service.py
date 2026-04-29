"""
visual_anchor_service 的单元测试
"""

from app.services.visual_anchor_service import (
    anchors_for_storyboard,
    clean_storyboard_anchor_refs,
    format_anchors_for_prompt,
    normalize_storyboard,
    normalize_visual_anchors,
)


class TestNormalizeVisualAnchors:
    def test_filters_invalid_types_counts_duplicates_and_reference_image_characters(self):
        result = normalize_visual_anchors(
            [
                {"id": "bear_01", "type": "character", "name": "小熊"},
                {"id": "cup_01", "type": "object", "name": "杯子"},
                {"id": "scene_01", "type": "scene", "name": "森林"},
                {"id": "bad id", "type": "object", "name": "非法 ID"},
                {"id": "cup_01", "type": "object", "name": "重复杯子"},
                {"id": "key_01", "type": "object", "name": "钥匙"},
            ],
            has_character_reference_images=True,
        )

        assert result == [
            {"id": "cup_01", "type": "object", "name": "杯子", "description": ""},
            {"id": "key_01", "type": "object", "name": "钥匙", "description": ""},
        ]

    def test_limits_characters_and_objects(self):
        raw = [
            {"id": f"character_{index}", "type": "character", "name": f"角色{index}"}
            for index in range(5)
        ] + [
            {"id": f"object_{index}", "type": "object", "name": f"物品{index}"}
            for index in range(7)
        ]

        result = normalize_visual_anchors(raw)

        assert [anchor["id"] for anchor in result] == [
            "character_0",
            "character_1",
            "character_2",
            "object_0",
            "object_1",
            "object_2",
            "object_3",
            "object_4",
        ]


class TestStoryboardAnchorRefs:
    def test_normalize_storyboard_converts_legacy_fields_to_weak_structure(self):
        result = normalize_storyboard(
            {
                "scene": "森林小路",
                "characters": "小熊抱着灯",
                "shot": "中景",
                "anchor_refs": ["bear_01", "lamp_01", "extra_01", "overflow_01"],
                "color": "暖色",
            },
            fallback_text="小熊找到星星灯。",
        )

        assert result == {
            "summary": "小熊找到星星灯。",
            "visual_brief": "森林小路",
            "anchor_refs": ["bear_01", "lamp_01", "extra_01"],
            "must_include": ["小熊抱着灯"],
            "composition": "中景",
            "avoid": [],
        }

    def test_cleans_refs_and_resolves_only_current_page_anchors(self):
        anchors = [
            {"id": "bear_01", "type": "character", "name": "小熊", "description": ""},
            {"id": "lamp_01", "type": "object", "name": "星星灯", "description": ""},
        ]
        storyboard = {
            "summary": "小熊抱着灯。",
            "visual_brief": "小熊抱着星星灯",
            "anchor_refs": ["bear_01", "missing_01", "lamp_01"],
            "must_include": ["小熊", "星星灯"],
            "composition": "中景",
            "avoid": ["文字"],
        }

        cleaned = clean_storyboard_anchor_refs(storyboard, anchors)
        resolved = anchors_for_storyboard(cleaned, anchors)

        assert cleaned["anchor_refs"] == ["bear_01", "lamp_01"]
        assert resolved == anchors


class TestFormatAnchorsForPrompt:
    def test_formats_empty_and_non_empty_prompts(self):
        assert format_anchors_for_prompt([], language="zh") == "无"

        result = format_anchors_for_prompt(
            [
                {
                    "id": "lamp_01",
                    "type": "object",
                    "name": "星星灯",
                    "description": "柔和发光",
                    "key_attributes": ["黄色光"],
                }
            ],
            language="zh",
        )

        assert "lamp_01" in result
        assert "星星灯" in result
        assert "关键属性：黄色光" in result
