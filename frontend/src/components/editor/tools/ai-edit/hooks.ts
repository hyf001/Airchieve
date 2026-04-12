/**
 * AI 改图工具状态管理 Hook
 */

import { useState, useCallback, useEffect } from 'react';
import { editPageImage, InsufficientPointsError } from '@/services/storybookService';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/** 图片压缩：超过 2MB 自动降低质量 */
export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      if (file.size <= MAX_FILE_SIZE) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        let quality = 0.9;
        let result = canvas.toDataURL('image/jpeg', quality);
        while (result.length * 0.75 > MAX_FILE_SIZE && quality > 0.1) {
          quality -= 0.1;
          result = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(result);
      };
      img.onerror = reject;
      img.src = dataUrl;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/** 核心 Hook — 管理 AI 改图状态和操作 */
export const useAIEditState = (
  storybookId: string | number,
  baseImageUrl: string,
  onApply: (imageUrl: string) => void
) => {
  const [instruction, setInstruction] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // baseImageUrl 变化时重置状态
  useEffect(() => {
    setInstruction('');
    setUploadedImages([]);
    setError(null);
  }, [baseImageUrl]);

  // 添加上传图片
  const addImages = useCallback(async (files: File[]) => {
    const results = await Promise.all(
      files.map(file => compressImage(file).catch(() => null))
    );
    const valid = results.filter((r): r is string => r !== null);
    if (valid.length > 0) {
      setUploadedImages(prev => [...prev, ...valid]);
    }
    return { success: valid.length, failed: files.length - valid.length };
  }, []);

  // 移除上传图片
  const removeImage = useCallback((index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 清空所有上传图片
  const clearImages = useCallback(() => {
    setUploadedImages([]);
  }, []);

  // 发起 AI 编辑
  const generate = useCallback(async () => {
    const trimmed = instruction.trim();
    if (!trimmed || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const referencedImage = uploadedImages.length > 0 ? uploadedImages[0] : undefined;
      const newUrl = await editPageImage(
        Number(storybookId),
        baseImageUrl,
        trimmed,
        referencedImage
      );
      setInstruction('');
      setUploadedImages([]);
      onApply(newUrl);
      return newUrl;
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : '图片生成失败');
      }
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [instruction, isGenerating, uploadedImages, storybookId, baseImageUrl, onApply]);

  // 完全重置
  const reset = useCallback(() => {
    setInstruction('');
    setUploadedImages([]);
    setError(null);
  }, []);

  return {
    instruction,
    setInstruction,
    uploadedImages,
    isGenerating,
    error,
    setError,
    addImages,
    removeImage,
    clearImages,
    generate,
    reset,
  };
};
