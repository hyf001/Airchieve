"""
LLM Client Base Interface
大模型客户端基类接口
用于处理绘本生成的核心方法
"""
from abc import ABC, abstractmethod
from typing import List, Optional
from app.models.storybook import StorybookPage
from app.models.template import Template


# ============ 通用 LLM 异常基类 ============

class LLMError(Exception):
    """LLM 调用异常基类（user_message 可直接展示给用户）"""
    def __init__(self, dev_message: str, user_message: str, error_type: str):
        super().__init__(dev_message)
        self.user_message = user_message
        self.error_type = error_type


class LLMClientBase(ABC):
    """大模型客户端基类"""

    @abstractmethod
    async def create_story(
        self,
        instruction: str,
        template: Optional[Template] = None,
        images: Optional[List[str]] = None
    ) -> List[StorybookPage]:
        """
        创建故事

        根据用户指令、模板配置和可选的参考图片，生成完整的绘本内容（包含文本和图片）。

        Args:
            instruction: 用户指令/故事描述，例如"一个关于小兔子找朋友的故事"
            template: 模板对象（可选），包含风格名称、描述和系统提示词
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
    async def edit_image_only(
        self,
        instruction: str,
        current_image_url: str,
    ) -> str:
        """
        仅编辑图片，不修改文字。

        Args:
            instruction: 图片编辑指令
            current_image_url: 当前图片 URL 或 base64 data URL

        Returns:
            str: 生成的新图片 base64 data URL
        """
        pass

    @abstractmethod
    async def regenerate_pages(
        self,
        pages: List[StorybookPage],
        count: int = 1,
        instruction: str = "",
    ) -> List[StorybookPage]:
        """
        基于选中的页面再生成新页面。

        Args:
            pages: 选中的 1-5 个原始页面
            instruction: 再生成指令（可选）

        Returns:
            List[StorybookPage]: 新生成的页面列表（数量与输入相同）
        """
        pass

