/**
 * 创建绘本步骤组件
 * 选择艺术风格、设置绘本参数、上传参考图片
 */
import React, { useState, useRef, useCallback } from 'react';
import { Loader2, Wand2, Image as ImageIcon, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImageStyleListItem } from '../../services/imageStyleService';
import { StoryboardItem, CreationParams } from '../../types/creation';
import { CliType, AspectRatio, ImageSize } from '../../services/storybookService';
import { toApiUrl } from '@/services/storybookService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CreateStorybookStepProps {
  storyTitle: string;
  storyContent: string;
  storyboards: StoryboardItem[];
  initialImageStyle: ImageStyleListItem | null;
  cli_type: CliType;
  onCreate: (
    imageStyleId: number,
    images: string[],
    params: CreationParams
  ) => void;
  onBack: () => void;
}

const defaultParams: CreationParams = {
  aspect_ratio: '16:9',
  image_size: '1k',
  cli_type: 'gemini',
};
const MAX_REFERENCE_IMAGES = 6;

const CreateStorybookStep: React.FC<CreateStorybookStepProps> = ({
  storyTitle,
  storyContent,
  storyboards,
  initialImageStyle,
  cli_type,
  onCreate,
}) => {
  const selectedImageStyle = initialImageStyle;
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [params, setParams] = useState<CreationParams>({ ...defaultParams, cli_type });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploadError('');

    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) {
      setUploadError('仅支持上传图片文件。');
    }

    const availableSlots = MAX_REFERENCE_IMAGES - uploadedImages.length;
    if (availableSlots <= 0) {
      setUploadError(`最多上传 ${MAX_REFERENCE_IMAGES} 张参考图片。`);
      e.target.value = '';
      return;
    }

    const selectedFiles = imageFiles.slice(0, availableSlots);
    if (imageFiles.length > availableSlots) {
      setUploadError(`最多上传 ${MAX_REFERENCE_IMAGES} 张参考图片，已保留前 ${availableSlots} 张。`);
    }

    const compressImage = (file: File): Promise<string> => {
      const MAX_SIZE = 2 * 1024 * 1024;
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          if (file.size <= MAX_SIZE) {
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

    setUploadingCount(selectedFiles.length);
    try {
      const images = await Promise.all(selectedFiles.map((file) => compressImage(file)));
      setUploadedImages((prev) => [...prev, ...images]);
    } catch {
      setUploadError('图片处理失败，请换一张图片重试。');
    } finally {
      setUploadingCount(0);
      e.target.value = '';
    }
  }, [uploadedImages.length]);

  const handleRemoveImage = useCallback((index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCreate = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (!selectedImageStyle) return;
      await onCreate(
        selectedImageStyle.id,
        uploadedImages,
        params
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedImageStyle, uploadedImages, params, onCreate, isSubmitting]);

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      {/* 标题栏 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <Wand2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">创建绘本</h2>
          <p className="text-sm text-slate-400">选择艺术风格和生成参数</p>
        </div>
      </div>

      {/* 输入框区域（蓝色光晕玻璃态） */}
      <div className="w-full relative">
        {/* 蓝色光晕层 */}
        <div className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-sky-300/50 via-blue-300/40 to-cyan-300/45 blur-2xl pointer-events-none" />
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-white/60 to-sky-100/30 blur-md pointer-events-none" />

        {/* 玻璃卡片 */}
        <div className="relative rounded-2xl overflow-hidden bg-white/72 backdrop-blur-2xl border border-white/70 shadow-[0_8px_40px_rgba(0,0,0,0.10),0_2px_10px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)]">
          <div className="px-5 pt-4 pb-3 space-y-4">
            {/* 故事信息摘要 */}
            <div className="rounded-xl p-4 bg-white/60 border border-slate-300/50">
              <h3 className="text-lg font-bold text-slate-800 mb-2">{storyTitle}</h3>
              <p className="text-slate-600 text-sm line-clamp-2">{storyContent}</p>
              <div className="mt-3 flex items-center gap-4 text-sm text-slate-500">
                <span>正文 {storyboards.filter(item => item.page_type !== 'cover').length} 页</span>
                {storyboards.some(item => item.page_type === 'cover') && (
                  <>
                    <span>·</span>
                    <span>含封面</span>
                  </>
                )}
                {selectedImageStyle && (
                  <>
                    <span>·</span>
                    <span>画风: {selectedImageStyle.name}</span>
                  </>
                )}
                {uploadedImages.length > 0 && (
                  <>
                    <span>·</span>
                    <span>{uploadedImages.length} 张参考图片</span>
                  </>
                )}
              </div>
            </div>

            {/* 上方：参考图片上传 */}
            <div className="rounded-xl p-4 bg-white/60 border border-slate-300/50">
              <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-600" />
                参考图片（可选）
              </h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  multiple
	                  onChange={handleImageUpload}
	                  className="hidden"
	                />
	                <Button
	                  type="button"
	                  onClick={() => fileInputRef.current?.click()}
	                  disabled={isSubmitting || uploadingCount > 0 || uploadedImages.length >= MAX_REFERENCE_IMAGES}
	                  variant="outline"
	                  className="h-auto w-full shrink-0 flex-col border-2 border-dashed py-4 sm:w-24"
	                >
	                  {uploadingCount > 0 ? (
	                    <Loader2 className="mb-2 h-6 w-6 animate-spin text-slate-400" />
	                  ) : (
	                    <Upload className="mb-2 h-6 w-6 text-slate-400" />
	                  )}
	                  <span className="text-sm text-slate-500">{uploadingCount > 0 ? '处理中' : '上传图片'}</span>
	                </Button>
	                <div className="min-w-0 flex-1 space-y-2">
	                  <div className="text-xs text-slate-500">
	                    支持最多 {MAX_REFERENCE_IMAGES} 张图片，较大的图片会自动压缩。
	                  </div>
	                  {uploadError && <div className="text-xs text-amber-700">{uploadError}</div>}
	                  {uploadedImages.length > 0 && (
	                    <div className="flex flex-wrap gap-2">
	                      {uploadedImages.map((image, index) => (
	                        <div key={index} className="relative group">
	                          <img
	                            src={image}
	                            alt={`参考图片 ${index + 1}`}
	                            className="w-20 h-20 object-cover rounded-lg"
	                          />
	                          <Button
	                            onClick={() => handleRemoveImage(index)}
	                            size="icon"
	                            variant="destructive"
	                            className="absolute right-1 top-1 h-6 w-6 p-0 text-xs opacity-100 transition sm:h-5 sm:w-5 sm:opacity-0 sm:group-hover:opacity-100"
	                            aria-label={`删除参考图片 ${index + 1}`}
	                          >
	                            <X className="h-3 w-3" />
	                          </Button>
	                        </div>
	                      ))}
	                    </div>
	                  )}
	                </div>
              </div>
            </div>

            {/* 下方：已选画风 */}
            <div className="rounded-xl p-4 bg-white/60 border border-slate-300/50">
              <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-purple-600" />
                已选画风
              </h3>
              {selectedImageStyle ? (
                <div className="flex flex-col gap-3 rounded-xl border border-amber-300/70 bg-amber-50/80 p-3 sm:flex-row sm:items-center">
                  <div className="h-24 w-full overflow-hidden rounded-lg bg-slate-100 sm:w-32">
                    {selectedImageStyle.cover_image ? (
                      <img
                        src={toApiUrl(selectedImageStyle.cover_image)}
                        alt={selectedImageStyle.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-800">{selectedImageStyle.name}</div>
                    <p className="mt-1 text-sm leading-5 text-slate-600 line-clamp-2">
                      {selectedImageStyle.description || '暂无描述'}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">如需更换画风，请返回上一步调整。</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300/70 bg-white/50 px-4 py-6 text-center text-sm text-slate-500">
                  尚未选择画风，请返回上一步选择。
                </div>
              )}
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="flex flex-col gap-3 px-4 py-3 border-t border-white/50 bg-white/20 sm:flex-row sm:items-center">
            {/* 参数选择器 */}
            <div className="flex flex-wrap items-center gap-3 sm:flex-1 sm:justify-start">
              {/* 图片比例 */}
              <Select
                value={params.aspect_ratio}
                onValueChange={(v) => setParams({ ...params, aspect_ratio: v as AspectRatio })}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-8 w-[100px] text-xs bg-white/60 border-slate-300/50 text-slate-700 shadow-sm focus:ring-amber-500/30">
                  <SelectValue placeholder="比例" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 border-slate-300/50">
                  <SelectItem value="16:9">16:9</SelectItem>
                  <SelectItem value="4:3">4:3</SelectItem>
                  <SelectItem value="1:1">1:1</SelectItem>
                </SelectContent>
              </Select>

              {/* 图片尺寸 */}
              <Select
                value={params.image_size}
                onValueChange={(v) => setParams({ ...params, image_size: v as ImageSize })}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-8 w-[80px] text-xs bg-white/60 border-slate-300/50 text-slate-700 shadow-sm focus:ring-amber-500/30">
                  <SelectValue placeholder="尺寸" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 border-slate-300/50">
                  <SelectItem value="1k">1K</SelectItem>
                  <SelectItem value="2k">2K</SelectItem>
                  <SelectItem value="4k">4K</SelectItem>
                </SelectContent>
              </Select>

            </div>

            {/* 开始创作按钮 */}
            <Button
              onClick={handleCreate}
              disabled={isSubmitting || !selectedImageStyle}
              variant="gradient-rose"
              className="w-full shrink-0 shadow-lg transition-all hover:scale-105 hover:shadow-purple-400/60 active:scale-95 sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>正在生成绘本...</span>
                </>
              ) : (
                <>
                  <Wand2 size={16} strokeWidth={2} />
                  <span>开始创作</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateStorybookStep;
