/**
 * AI 改图工具类型定义
 */

/** AI 改图工具暴露给外部的方法 */
export interface AIEditRef {
  getInstruction: () => string;
  getUploadedImages: () => string[];
  getIsGenerating: () => boolean;
  generate: () => Promise<void>;
  reset: () => void;
}
