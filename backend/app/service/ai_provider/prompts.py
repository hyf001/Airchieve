def build_storyboard_prompt(*, title: str, story_content: str, page_count: int) -> str:
    return (
        "你是一名专业儿童绘本视觉导演。请把故事严格拆分为绘本分镜页。\n\n"
        "输出必须是 JSON 对象，结构如下：\n"
        "{\n"
        '  "pages": [\n'
        "    {\n"
        '      "page_no": 1,\n'
        '      "title": "页标题",\n'
        '      "text_zh": "本页中文正文",\n'
        '      "text_en": null,\n'
        '      "narration_text": "朗读文本",\n'
        '      "visual_prompt": "给插画模型的中文画面提示词",\n'
        '      "character_appearances": [{"role_code": "hero", "display_name": "角色名"}],\n'
        '      "dialogues": []\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        f"要求：pages 必须恰好 {page_count} 页；page_no 从 1 连续递增；"
        "内容适合儿童绘本，积极、温暖，分镜顺序遵循原故事，不添加不适宜内容；"
        "visual_prompt 要只描述可视化画面，不要包含图片中文字。\n\n"
        f"故事标题：{title}\n\n故事内容：\n{story_content}"
    )
