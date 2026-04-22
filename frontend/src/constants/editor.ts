/**
 * 编辑器相关常量定义
 */

import { StorybookStatus } from '@/services/storybookService';

/**
 * 绘本状态文本映射
 */
export const STATUS_TEXT_MAP: Record<string, string> = {
  init: '初始化',
  creating: '生成中',
  updating: '更新中',
  finished: '已完成',
  error: '错误',
  terminated: '已中止',
};

/**
 * 终态状态集合
 * 这些状态表示绘本生成已经结束，不再需要轮询
 */
export const TERMINAL_STATUSES = new Set(['finished', 'error', 'terminated']);

/**
 * 进行中状态集合
 */
export const IN_PROGRESS_STATUSES = new Set(['creating', 'updating']);

/**
 * 导出进度配置
 */
export const EXPORT_CONFIG = {
  updateInterval: 400, // 进度更新间隔 (ms)
  progressIncrement: 0.06, // 每次更新的增量系数
  minIncrement: 0.35, // 最小增量
  targetProgress: 99, // 目标进度（不会自动达到100%）
} as const;

/**
 * 编辑器模式配置
 */
export const EDITOR_MODES = {
  read: 'read',
  edit: 'edit',
  reorder: 'reorder',
  regen: 'regen',
  cover: 'cover',
  backcover: 'backcover',
} as const;

/**
 * 页面类型文本映射
 */
export const PAGE_TYPE_TEXT_MAP: Record<string, string> = {
  cover: '封面',
  back_cover: '封底',
  content: '内页',
};

/**
 * 图片宽高比配置
 */
export const ASPECT_RATIO_CONFIG = {
  '1:1': {
    label: '正方形',
    className: 'aspect-square',
  },
  '4:3': {
    label: '4:3',
    className: 'aspect-[4/3]',
  },
  '16:9': {
    label: '16:9',
    className: 'aspect-[16/9]',
  },
} as const;

/**
 * 编辑器布局配置
 */
export const EDITOR_LAYOUT = {
  sidebarWidth: 320, // 左侧边栏宽度
  pageNavWidth: 176, // 页面导航栏宽度 (w-44)
  toolPanelWidth: 320, // 右侧工具栏宽度
  headerHeight: 64, // 头部高度
} as const;

/**
 * 工具栏配置
 */
export const TOOL_PANEL_CONFIG = {
  columns: 4, // 工具网格列数
  iconSize: 'lg', // 图标大小
  showLabels: true, // 是否显示标签
} as const;

/**
 * 轮询配置
 */
export const POLLING_CONFIG = {
  interval: 5000, // 轮询间隔
  maxRetries: 3, // 失败后的最大重试次数
} as const;

/**
 * 默认配置
 */
export const DEFAULT_CONFIG = {
  maxHistorySize: 20, // ��具历史记录最大数量
  maxUndoSteps: 50, // 最大撤销步数
  autoSaveInterval: 30000, // 自动保存间隔
} as const;
