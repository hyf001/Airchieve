def build_story_prompt(
    *,
    idea_prompt: str,
    language: str,
    age_range_codes: list[str] | None = None,
    theme_codes: list[str] | None = None,
    narrative_style_code: str | None = None,
) -> str:
    supplemental_lines = [f"- 语言：{language}"]
    if age_range_codes:
        supplemental_lines.append(f"- 适龄范围：{', '.join(age_range_codes)}")
    if theme_codes:
        supplemental_lines.append(f"- 主题方向：{', '.join(theme_codes)}")
    if narrative_style_code:
        supplemental_lines.append(f"- 叙事风格：{narrative_style_code}")
    supplemental_text = "\n".join(supplemental_lines)

    return (
        "你是一名专业儿童故事作者，请根据用户提供的灵感和补充信息，创作一篇适合生成儿童绘本的故事。\n\n"
        "输出必须是 JSON 对象，结构如下：\n"
        "{\n"
        '  "title": "故事标题，20字以内",\n'
        '  "summary": "一句话简介，80字以内",\n'
        '  "content": "完整故事正文，600到1200字，分段清晰"\n'
        "}\n\n"
        "要求：故事积极、温暖、适合儿童；情节完整，有开端、发展和结尾；语言适合朗读；"
        "不要包含暴力、惊吓、歧视、成人化或不适宜儿童的内容；不要输出 Markdown；不要解释生成过程。\n\n"
        f"补充信息：\n{supplemental_text}\n\n"
        f"用户灵感：\n{idea_prompt.strip()}"
    )


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
