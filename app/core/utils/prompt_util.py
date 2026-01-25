import os
from tempfile import template
from typing import Union
from jinja2 import Environment, FileSystemLoader, select_autoescape
from app.core.config import settings

env = Environment(
    loader=FileSystemLoader(os.path.dirname(__file__)),
    autoescape=select_autoescape(),
    trim_blocks=True,
    lstrip_blocks=True
)

def getSystemPrompt( **args) -> str:
    """
    根据模版获取prompt
    """
    current_dir = os.path.dirname(__file__)
    file_name = f"system-prompt.md"
    if os.path.exists(os.path.join(current_dir, file_name)):
        template = env.get_template(file_name)
        return template.render(args)
    else:
        file_name = f"system-prompt.md"
        template = env.get_template(file_name)
        return template.render(args)
