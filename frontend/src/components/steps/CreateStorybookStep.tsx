/**
 * 创建绘本步骤组件
 * 选择艺术风格、设置绘本参数、上传参考图片
 */
import React, { useState, useRef, useCallback } from 'react';
import { Wand2, Image as ImageIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TemplateListItem } from '../../services/templateService';
import { StoryboardItem, CreationParams } from '../../types/creation';
import { CliType, AspectRatio, ImageSize } from '../../services/storybookService';
import StorybookPreview from '../StorybookPreview';
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
  templates: TemplateListItem[];
  onCreate: (
    templateId: number | null,
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

const CreateStorybookStep: React.FC<CreateStorybookStepProps> = ({
  storyTitle,
  storyContent,
  storyboards,
  templates,
  onCreate,
  onBack,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateListItem | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [params, setParams] = useState<CreationParams>(defaultParams);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

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

    Array.from(files).forEach((file) => {
      compressImage(file).then((base64) => {
        setUploadedImages((prev) => [...prev, base64]);
      });
    });
    e.target.value = '';
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCreate = useCallback(async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onCreate(
        selectedTemplate?.id || null,
        uploadedImages,
        params
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedTemplate, uploadedImages, params, onCreate, isSubmitting]);

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
                <span>共 {storyboards.length} 页</span>
                {selectedTemplate && (
                  <>
                    <span>·</span>
                    <span>模板: {selectedTemplate.name}</span>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 左侧：模板选择 */}
              <div className="lg:col-span-2">
                <div className="rounded-xl p-4 bg-white/60 border border-slate-300/50">
                  <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-purple-600" />
                    选择艺术风格（可选）
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {/* 不使用模板 */}
                    <Button
                      onClick={() => setSelectedTemplate(null)}
                      variant="outline"
                      className={`p-3 h-auto text-left ${
                        !selectedTemplate
                          ? 'border-amber-500 bg-amber-50 shadow-md'
                          : 'border-slate-300/50 hover:border-slate-400'
                      }`}
                    >
                      <div className="font-medium text-slate-800 text-sm">不使用模板</div>
                      <div className="text-xs text-slate-500 mt-1">由 AI 自由创作</div>
                    </Button>
                    {/* 模板列表 */}
                    {templates.map((template) => {
                      const previewStorybook =
                        template.storybook_id && template.cover_image
                          ? {
                              id: template.storybook_id,
                              title: template.name,
                              description: template.description,
                              creator: template.creator,
                              status: 'finished' as const,
                              is_public: false,
                              created_at: template.created_at,
                              pages: [
                                { image_url: template.cover_image, text: '', page_type: 'cover' as const },
                              ],
                            }
                          : null;

                      return (
                        <Button
                          key={template.id}
                          onClick={() => setSelectedTemplate(template)}
                          variant="outline"
                          className={`p-3 h-auto text-left ${
                            selectedTemplate?.id === template.id
                              ? 'border-amber-500 bg-amber-50 shadow-md'
                              : 'border-slate-300/50 hover:border-slate-400'
                          }`}
                        >
                          {previewStorybook ? (
                            <div className="mb-2 rounded-lg overflow-hidden">
                              <StorybookPreview storybook={previewStorybook as any} />
                            </div>
                          ) : (
                            <div className="h-16 bg-slate-200 rounded-lg flex items-center justify-center mb-2">
                              <span className="text-2xl">📚</span>
                            </div>
                          )}
                          <div className="font-medium text-slate-800 text-sm truncate">{template.name}</div>
                          {template.description && (
                            <div className="text-xs text-slate-500 mt-1 truncate">{template.description}</div>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 右侧：参考图片上传 */}
              <div>
                <div className="rounded-xl p-4 bg-white/60 border border-slate-300/50">
                  <h3 className="text-base font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    参考图片（可选）
                  </h3>
                  <div className="space-y-3">
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
                      variant="outline"
                      className="w-full h-auto flex-col py-6 border-2 border-dashed"
                    >
                      <Upload className="w-6 h-6 text-slate-400 mb-2" />
                      <span className="text-slate-500 text-sm">点击上传图片</span>
                    </Button>
                    {uploadedImages.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {uploadedImages.map((image, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={image}
                              alt={`参考图片 ${index + 1}`}
                              className="w-full h-16 object-cover rounded-lg"
                            />
                            <Button
                              onClick={() => handleRemoveImage(index)}
                              size="icon"
                              variant="destructive"
                              className="absolute top-1 right-1 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition text-xs"
                            >
                              ×
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 底部操作栏 */}
          <div className="flex items-center gap-2 px-4 py-3 flex-nowrap border-t border-white/50 bg-white/20">
            {/* 上一步按钮 */}
            <Button
              onClick={onBack}
              disabled={isSubmitting}
              variant="outline"
              className="shrink-0"
            >
              上一步
            </Button>

            {/* 参数选择器 */}
            <div className="flex-1 flex items-center justify-center gap-3">
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

              {/* AI 模型 */}
              <Select
                value={params.cli_type}
                onValueChange={(v) => setParams({ ...params, cli_type: v as CliType })}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-8 w-[100px] text-xs bg-white/60 border-slate-300/50 text-slate-700 shadow-sm focus:ring-amber-500/30">
                  <SelectValue placeholder="模型" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 border-slate-300/50">
                  <SelectItem value="gemini">Gemini</SelectItem>
                  <SelectItem value="claude">Claude</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 开始创作按钮 */}
            <Button
              onClick={handleCreate}
              disabled={isSubmitting}
              variant="gradient-rose"
              className="shrink-0 shadow-lg hover:shadow-purple-400/60 hover:scale-105 active:scale-95 transition-all"
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
