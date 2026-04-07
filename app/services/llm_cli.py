"""
LLM Client Base Interface
大模型客户端基类接口
用于处理绘本生成的核心方法
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Tuple, AsyncGenerator
from app.models.storybook import StorybookPage, Storyboard
from app.models.template import Template
from app.models.enums import CliType, StoryType, Language, AgeGroup


# ============ 通用 LLM 异常基类 ============

class LLMError(Exception):
    """LLM 调用异常基类（user_message 可直接展示给用户）"""
    def __init__(self, dev_message: str, user_message: str, error_type: str):
        super().__init__(dev_message)
        self.user_message = user_message
        self.error_type = error_type


class LLMClientBase(ABC):
    """大模型客户端基类"""

    @staticmethod
    def get_client(cli_type: CliType) -> "LLMClientBase":
        """
        根据CLI类型获取对应的客户端实例

        Args:
            cli_type: CLI类型

        Returns:
            LLMClientBase: 对应的客户端实例

        Raises:
            ValueError: 不支持的CLI类型
        """
        if cli_type == CliType.GEMINI:
            from app.services.gemini_cli import GeminiCli
            return GeminiCli()
        # 未来可以在这里添加其他客户端
        # elif cli_type == CliType.CLAUDE:
        #     from app.services.claude_cli import ClaudeCli
        #     return ClaudeCli()
        # elif cli_type == CliType.OPENAI:
        #     from app.services.openai_cli import OpenAICli
        #     return OpenAICli()
        else:
            raise ValueError(f"不支持的CLI类型: {cli_type}")


    @abstractmethod
    async def generate_page(
        self,
        story_text: str,
        storyboard: Optional[Storyboard],
        story_context: List[str],
        page_index: int,
        reference_images: Optional[List[str]] = None,
        previous_page_image: Optional[str] = None,
        template: Optional[Template] = None,
        aspect_ratio: str = "16:9",
        image_size: str = "1k",
    ) -> str:
        """
        生成单页图片

        Args:
            story_text: 当前页的故事文本
            storyboard: 当前页的分镜描述
            story_context: 完整故事的所有文本
            page_index: 当前页索引
            reference_images: 用户提供的参考图片
            previous_page_image: 上一页生成的图片URL
            template: 风格模板
            aspect_ratio: 图片比例
            image_size: 图片尺寸

        Returns:
            str: 生成的图片URL（base64 data URL）
        """
        pass

    @abstractmethod
    async def edit_image(
        self,
        instruction: str,
        current_image_url: str,
        referenced_image: Optional[str] = None,
        aspect_ratio: str = "16:9",
        image_size: str = "1k",
    ) -> str:
        """
        编辑图片

        Args:
            instruction: 编辑指令
            current_image_url: 当前图片URL
            referenced_image: 参考图片URL（可选）
            aspect_ratio: 图片比例
            image_size: 图片尺寸

        Returns:
            str: 编辑后的图片URL（base64 data URL）
        """
        pass

    @abstractmethod
    async def create_story(
        self,
        instruction: str,
        word_count: int = 500,
        story_type: StoryType = StoryType.FAIRY_TALE,
        language: Language = Language.ZH,
        age_group: AgeGroup = AgeGroup.AGE_3_6,
    ) -> Tuple[str, str]:
        """
        创建纯文本故事（不含分镜）

        Args:
            instruction: 用户指令/故事描述
            word_count: 目标字数
            story_type: 故事类型
            language: 语言
            age_group: 年龄组

        Returns:
            Tuple[str, str]: (故事标题, 故事内容)
        """
        pass

    @abstractmethod
    async def create_storyboard_from_story(
        self,
        story_content: str,
        page_count: int = 10,
    ) -> Tuple[List[str], List[Optional[Storyboard]]]:
        """
        基于故事内容创建分镜描述

        Args:
            story_content: 故事内容（纯文本）
            page_count: 需要拆分的页数

        Returns:
            Tuple[List[str], List[Optional[Storyboard]]]: (每页故事文本列表, 分镜列表)
        """
        pass

    @abstractmethod
    async def create_insertion_story_and_storyboard(
        self,
        pages: List[StorybookPage],
        insert_position: int,
        count: int,
        instruction: str,
        template: Optional[Template] = None,
    ) -> Tuple[List[str], List[Optional[Storyboard]]]:
        """
        创建插入页面的故事文本和分镜（需要上下文）

        Args:
            pages: 现有页面列表
            insert_position: 插入位置
            count: 插入页面数量
            instruction: 插入指令
            template: 模板对象（可选）

        Returns:
            Tuple[List[str], List[Optional[Storyboard]]]: (故事文本列表, 分镜列表)
        """
        pass

    @abstractmethod
    async def generate_cover(
        self,
        title: str,
        cover_text: str,
        reference_images: List[str],
        aspect_ratio: str = "16:9",
        image_size: str = "1k",
    ) -> str:
        """
        生成绘本封面图片

        Args:
            title: 绘本标题
            cover_text: 封面展示文字
            reference_images: 参考图片列表（从内页自动选取）
            aspect_ratio: 图片比例
            image_size: 图片尺寸

        Returns:
            str: 生成的封面图片 base64 data URL
        """
        pass
