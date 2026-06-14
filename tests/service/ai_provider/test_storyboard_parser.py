from app.service.ai_provider.parsers import storyboard_from_response


class TestStoryboardParser:
    def test_merges_narration_only_playback_segments(self):
        storyboard = storyboard_from_response(
            """
            {
              "pages": [
                {
                  "page_no": 1,
                  "text_zh": "第一句。第二句。",
                  "visual_prompt": "温暖的教室",
                  "playback_segments": [
                    {"segment_type": "narration", "text": "第一句。", "sort_order": 1},
                    {"segment_type": "narration", "text": "第二句。", "sort_order": 2}
                  ]
                }
              ]
            }
            """,
            title="测试故事",
            page_count=1,
        )

        segments = storyboard.pages[0].playback_segments
        assert len(segments) == 1
        assert segments[0].segment_type == "narration"
        assert segments[0].text == "第一句。\n第二句。"
        assert segments[0].sort_order == 0

    def test_keeps_interleaved_narration_and_dialogue_segments(self):
        storyboard = storyboard_from_response(
            """
            {
              "pages": [
                {
                  "page_no": 1,
                  "text_zh": "小猫走近。你好。它笑了。",
                  "visual_prompt": "小猫在花园里",
                  "playback_segments": [
                    {"segment_type": "narration", "text": "小猫走近。", "sort_order": 1},
                    {"segment_type": "dialogue", "speaker_ref": "cat", "text": "你好。", "sort_order": 2},
                    {"segment_type": "narration", "text": "它笑了。", "sort_order": 3}
                  ]
                }
              ]
            }
            """,
            title="测试故事",
            page_count=1,
        )

        segments = storyboard.pages[0].playback_segments
        assert [segment.segment_type for segment in segments] == ["narration", "dialogue", "narration"]
        assert [segment.sort_order for segment in segments] == [0, 1, 2]

    def test_merges_adjacent_narration_segments_when_dialogue_exists(self):
        storyboard = storyboard_from_response(
            """
            {
              "pages": [
                {
                  "page_no": 1,
                  "text_zh": "小猫走近。风很轻。你好。",
                  "visual_prompt": "小猫在花园里",
                  "playback_segments": [
                    {"segment_type": "narration", "text": "小猫走近。", "sort_order": 1},
                    {"segment_type": "narration", "text": "风很轻。", "sort_order": 2},
                    {"segment_type": "dialogue", "speaker_ref": "cat", "text": "你好。", "sort_order": 3}
                  ]
                }
              ]
            }
            """,
            title="测试故事",
            page_count=1,
        )

        segments = storyboard.pages[0].playback_segments
        assert [segment.segment_type for segment in segments] == ["narration", "dialogue"]
        assert segments[0].text == "小猫走近。\n风很轻。"
