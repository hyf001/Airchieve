/**
 * 工具注册表 - 管理所有编辑工具的配置
 */

import React from 'react';
import { ToolConfig, ToolId, ToolCategory } from '@/types/tool';

// 导入已实现工具
import AIEditTool from '../AIEditTool';
import TextEditTool from '../TextEditTool';
import DrawTool from '../DrawTool';

// 占位组件 - 用于未实现的工具
const PlaceholderTool: React.FC<any> = ({ description }) => (
  <div className="text-center text-slate-400 py-8">
    <p className="text-sm font-medium mb-2">工具开发中...</p>
    <p className="text-xs">{description || '此功能即将推出'}</p>
  </div>
);

/**
 * 工具配置注册表
 * 每个工具包含：ID、标签、图标、分类、组件、描述等信息
 */
export const TOOL_REGISTRY: Record<ToolId, ToolConfig> = {
  // ========== 基础工具 ==========
  'ai-edit': {
    id: 'ai-edit',
    label: 'AI改图',
    icon: '🤖',
    category: 'basic',
    component: AIEditTool,
    description: '输入指令描述你想要的修改',
  },

  'text': {
    id: 'text',
    label: '文字',
    icon: '✏️',
    category: 'basic',
    component: TextEditTool,
    description: '在图片上添加文字图层',
  },

  'draw': {
    id: 'draw',
    label: '涂鸦笔',
    icon: '🖌️',
    category: 'basic',
    component: DrawTool,
    description: '在图片上自由绘制',
  },

  'eraser': {
    id: 'eraser',
    label: '消除笔',
    icon: '🧹',
    category: 'basic',
    component: PlaceholderTool,
    description: '智能移除图片中的物体',
  },

  // ========== 高级工具 ==========
  'adjust': {
    id: 'adjust',
    label: '编辑',
    icon: '⚙️',
    category: 'advanced',
    component: PlaceholderTool,
    description: '调整亮度、对比度、饱和度',
  },

  'color': {
    id: 'color',
    label: '调色',
    icon: '🌈',
    category: 'advanced',
    component: PlaceholderTool,
    description: '调整色彩平衡、色温、色调',
  },

  'filter': {
    id: 'filter',
    label: '滤镜',
    icon: '🎨',
    category: 'advanced',
    component: PlaceholderTool,
    description: '添加精美的滤镜效果',
  },

  'blur': {
    id: 'blur',
    label: '背景虚化',
    icon: '💫',
    category: 'advanced',
    component: PlaceholderTool,
    description: '智能虚化背景，突出主体',
  },

  'optimize': {
    id: 'optimize',
    label: '智能优化',
    icon: '✨',
    category: 'advanced',
    component: PlaceholderTool,
    description: 'AI 自动优化图片质量',
  },

  'repair': {
    id: 'repair',
    label: '画质修复',
    icon: '🔧',
    category: 'advanced',
    component: PlaceholderTool,
    description: '修复模糊、低分辨率图片',
  },

  // ========== 创意工具 ==========
  'border': {
    id: 'border',
    label: '边框',
    icon: '🖼️',
    category: 'creative',
    component: PlaceholderTool,
    description: '为图片添加精美边框',
  },

  'mosaic': {
    id: 'mosaic',
    label: '马赛克',
    icon: '▦',
    category: 'creative',
    component: PlaceholderTool,
    description: '添加马赛克隐私保护',
  },

  'marker': {
    id: 'marker',
    label: '标记',
    icon: '📍',
    category: 'creative',
    component: PlaceholderTool,
    description: '添加标记、箭头、形状',
  },

  'cutout': {
    id: 'cutout',
    label: '抠图',
    icon: '✂️',
    category: 'creative',
    component: PlaceholderTool,
    description: '智能抠图，移除背景',
  },

  'background': {
    id: 'background',
    label: '背景',
    icon: '🏞️',
    category: 'creative',
    component: PlaceholderTool,
    description: '更换图片背景',
  },

  'effect': {
    id: 'effect',
    label: '特效',
    icon: '💥',
    category: 'creative',
    component: PlaceholderTool,
    description: '添加动态特效和动画',
  },

  'creative': {
    id: 'creative',
    label: '创意玩法',
    icon: '🎪',
    category: 'creative',
    component: PlaceholderTool,
    description: '探索更多创意功能',
  },
};

/**
 * 工具分类配置
 */
export const TOOL_CATEGORIES: Record<ToolCategory, { label: string; description: string }> = {
  basic: {
    label: '基础工具',
    description: '常用的编辑功能',
  },
  advanced: {
    label: '高级工具',
    description: '专业编辑功能',
  },
  creative: {
    label: '创意工具',
    description: '创意特效和玩法',
  },
};

/**
 * 获取指定分类的工具列表
 */
export function getToolsByCategory(category: ToolCategory): ToolConfig[] {
  return Object.values(TOOL_REGISTRY).filter(tool => tool.category === category);
}

/**
 * 获取所有工具列表（按指定顺序）
 */
export function getAllTools(): ToolConfig[] {
  const order: ToolId[] = [
    'ai-edit', 'text', 'adjust', 'color', 'filter',
    'eraser', 'border', 'draw', 'mosaic', 'marker',
    'optimize', 'blur', 'cutout', 'background',
    'effect', 'creative', 'repair',
  ];
  return order.map(id => TOOL_REGISTRY[id]).filter(Boolean);
}

/**
 * 根据工具 ID 获取工具配置
 */
export function getToolById(id: ToolId): ToolConfig | undefined {
  return TOOL_REGISTRY[id];
}

/**
 * 获取工具配置（带默认值）
 */
export function getToolConfig(id: ToolId): ToolConfig {
  return TOOL_REGISTRY[id] || {
    id,
    label: '未知工具',
    icon: '❓',
    category: 'basic',
    component: PlaceholderTool,
    description: '未知工具',
  };
}
