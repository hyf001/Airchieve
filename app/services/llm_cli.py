"""
LLM Client Base Interface
大模型客户端基类接口
用于处理绘本生成的核心方法
"""
from abc import ABC, abstractmethod
from typing import List, Optional
from app.models.storybook import StorybookPage


class LLMClientBase(ABC):
    """大模型客户端基类"""

    @abstractmethod
    async def create_story(
        self,
        instruction: str,
        system_prompt: Optional[str] = None,
        images: Optional[List[str]] = None
    ) -> List[StorybookPage]:
        """
        创建故事

        根据用户指令、系统提示词和可选的参考图片，生成完整的绘本内容（包含文本和图片）。

        Args:
            instruction: 用户指令/故事描述，例如"一个关于小兔子找朋友的故事"
            system_prompt: 系统提示词（可选），用于指定绘本风格、约束条件等
            images: base64编码的参考图片列表（可选），用于参考风格或角色

        Returns:
            List[StorybookPage]: 生成的页面列表，每页包含文本内容和图片URL
                [{
                    "text": "第一页的文本内容",
                    "image_url": "https://generated-image-url-1"
                }, ...]

        Raises:
            Exception: 当生成失败时抛出异常
        """
        pass

    @abstractmethod
    async def edit_story(
        self,
        instruction: str,
        current_pages: List[StorybookPage],
        system_prompt: Optional[str] = None
    ) -> List[StorybookPage]:
        """
        编辑故事

        根据编辑指令，对整个故事进行修改。可以调整整体情节、增加/删除页面、改变故事走向等。

        Args:
            instruction: 编辑指令，例如"让故事更感人一些"、"在结尾加上一个反转"
            current_pages: 当前故事的所有页面
            system_prompt: 系统提示词（可选），用于指定绘本风格、约束条件等

        Returns:
            List[StorybookPage]: 编辑后的页面列表

        Raises:
            Exception: 当编辑失败时抛出异常
        """
        pass

    @abstractmethod
    async def edit_page(
        self,
        page_index: int,
        instruction: str,
        current_page: StorybookPage,
        system_prompt: Optional[str] = None
    ) -> StorybookPage:
        """
        编辑故事页

        对指定单页内容进行编辑，修改该页的文本和/或图片。

        Args:
            page_index: 页码索引（从0开始）
            instruction: 编辑指令，例如"把这只兔子画得更可爱一些"、"增加更多细节描述"
            current_page: 当前页的内容
            system_prompt: 系统提示词（可选），用于指定绘本风格、约束条件等

        Returns:
            StorybookPage: 编辑后的页面内容
                {
                    "text": "编辑后的文本内容",
                    "image_url": "https://new-generated-image-url"
                }

        Raises:
            Exception: 当编辑失败时抛出异常
        """
        pass
