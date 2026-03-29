import React, { useState, useRef, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { editPageImage, InsufficientPointsError } from '../../services/storybookService';

interface AIEditToolProps {
  storybookId: string;
  baseImageUrl: string;
  onImageGenerated: (imageUrl: string, instruction: string) => void;
}

const AIEditTool: React.FC<AIEditToolProps> = ({
  storybookId,
  baseImageUrl,
  onImageGenerated,
}) => {
  const { toast } = useToast();
  const [imageInstruction, setImageInstruction] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 重置状态
  useEffect(() => {
    setImageInstruction('');
    setUploadedImages([]);
    setImageError(null);
  }, [baseImageUrl]);

  // 图片上传处理
  const compressImage = (file: File): Promise<string> => {
    const MAX_SIZE = 2 * 1024 * 1024; // 2MB
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        if (file.size <= MAX_SIZE) { resolve(dataUrl); return; }
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          let quality = 0.9;
          let result = canvas.toDataURL('image/jpeg', quality);
          while (result.length * 0.75 > MAX_SIZE && quality > 0.1) {
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const allFiles = Array.from(files);
    try {
      const newImages = await Promise.all(allFiles.map((file) => compressImage(file)));
      setUploadedImages(prev => [...prev, ...newImages]);
    } catch (err) {
      toast({ variant: 'destructive', title: '上传失败', description: '图片处理失败' });
    }
    e.target.value = '';
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerateImage = async () => {
    if (!imageInstruction.trim() || isGeneratingImage) return;
    setIsGeneratingImage(true);
    setImageError(null);

    try {
      const newUrl = await editPageImage(storybookId, baseImageUrl, imageInstruction);
      onImageGenerated(newUrl, imageInstruction);
      setImageInstruction('');
      toast({ title: '图片已生成' });
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        toast({ variant: 'destructive', title: '积分不足', description: err.message });
      } else {
        setImageError(err instanceof Error ? err.message : '图片生成失败');
      }
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="space-y-3">
      {imageError && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-500">{imageError}</p>
        </div>
      )}
      {isGeneratingImage && (
        <div className="px-3 py-2 rounded-lg bg-sky-50 border border-sky-200">
          <div className="flex items-center gap-2">
            <Loader2 size={14} className="text-sky-500 animate-spin" />
            <p className="text-sm text-sky-700">AI 编辑中…</p>
          </div>
        </div>
      )}

      {/* 上传的图片缩略图 */}
      {uploadedImages.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {uploadedImages.map((src, i) => (
            <div
              key={i}
              className="group/thumb relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-slate-200"
            >
              <img src={src} alt={`上传 ${i + 1}`} className="w-full h-full object-cover" />
              <button
                onClick={() => handleRemoveImage(i)}
                className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 上传图片按钮 */}
      <div className="flex gap-2">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isGeneratingImage}
          className="px-3 py-2 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          📎 上传参考图
        </button>
        {uploadedImages.length > 0 && (
          <span className="text-xs text-slate-400 flex items-center">
            已上传 {uploadedImages.length} 张
          </span>
        )}
      </div>

      <textarea
        value={imageInstruction}
        onChange={e => setImageInstruction(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerateImage();
          }
        }}
        placeholder="描述您想要的图片修改，例如：把天空改成夜晚…"
        rows={4}
        className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4] placeholder:text-slate-400"
        disabled={isGeneratingImage}
      />
      <button
        onClick={handleGenerateImage}
        disabled={!imageInstruction.trim() || isGeneratingImage}
        className="w-full px-4 py-2.5 rounded-lg bg-[#00CDD4] hover:bg-[#00b8be] text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isGeneratingImage ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            编辑中…
          </>
        ) : (
          <>
            ✨ 编辑图片
          </>
        )}
      </button>
    </div>
  );
};

export default AIEditTool;
