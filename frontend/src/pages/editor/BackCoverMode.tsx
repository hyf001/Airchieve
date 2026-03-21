import React, { useState, useRef } from 'react';
import { BookImage, Loader2, ChevronLeft, Palette, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { templates, BackCoverTemplate, backgroundColors, aspectRatios } from './back_cover_templates';
import { Storybook, generateBackCover } from '../../services/storybookService';

type AspectRatioType = '1:1' | '16:9' | '4:3';

interface BackCoverModeProps {
  storybook: Storybook;
  onBack: () => void;
  onBackCoverCreated: () => void;
}

const defaultEditorMessage = `宝贝，愿你在故事的世界里快乐成长，
每一天都充满阳光和欢笑。`;

const BackCoverMode: React.FC<BackCoverModeProps> = ({ storybook, onBack, onBackCoverCreated }) => {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<BackCoverTemplate>(templates[0]);
  const [editorMessage, setEditorMessage] = useState(defaultEditorMessage);
  const [backgroundColor, setBackgroundColor] = useState(backgroundColors[0].value);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatioType>(storybook.aspect_ratio || '16:9');
  const [isCreating, setIsCreating] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // 检查是否已有封底
  const hasBackCover = storybook.pages?.some(p => p.page_type === 'back_cover');

  // 根据比例计算预览尺寸
  const getPreviewSize = () => {
    const baseSize = 500; // 预览显示尺寸
    switch (selectedAspectRatio) {
      case '1:1':
        return { width: baseSize, height: baseSize };
      case '16:9':
        return { width: baseSize, height: Math.round(baseSize * 9 / 16) };
      case '4:3':
        return { width: baseSize, height: Math.round(baseSize * 3 / 4) };
      default:
        return { width: baseSize, height: Math.round(baseSize * 9 / 16) };
    }
  };

  const previewSize = getPreviewSize();

  const handleCreateClick = () => {
    setIsConfirmOpen(true);
  };

  const handleConfirmCreate = async () => {
    setIsConfirmOpen(false);
    setIsCreating(true);

    try {
      // 生成封底图片
      if (!previewContainerRef.current) {
        throw new Error('预览容器未找到');
      }

      // 使用 html2canvas 生成图片
      const canvas = await html2canvas(previewContainerRef.current, {
        scale: 3, // 3倍分辨率，提高清晰度
        useCORS: true,
        backgroundColor: null,
        logging: false,
        allowTaint: true,
      });

      // 转换为 base64 data URL
      const imageData = canvas.toDataURL('image/png', 0.95);

      // 调用后端接口创建封底
      await generateBackCover(storybook.id, imageData);
      toast({ title: '封底创建成功 ✓' });
      onBackCoverCreated();
    } catch (error) {
      toast({ title: '创建失败', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const SelectedTemplateComponent = selectedTemplate.component;

  if (hasBackCover) {
    return (
      <div className="w-full mx-auto flex flex-col items-center gap-6 py-12">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800 mb-2">封底已存在</h2>
          <p className="text-sm text-slate-500">此绘本已经创建了封底，无法重复创建。</p>
        </div>
        <Button onClick={onBack} variant="outline">
          返回预览
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
            <ChevronLeft size={20} />
          </Button>
          <div>
            <h2 className="text-lg font-bold text-slate-800">生成封底</h2>
            <p className="text-xs text-slate-500">为《{storybook.title}》创建封底</p>
          </div>
        </div>
        <Button
          onClick={handleCreateClick}
          disabled={isCreating}
          className="bg-[#00CDD4] hover:bg-[#00b0b8] text-white"
        >
          {isCreating ? (
            <><Loader2 size={16} className="mr-2 animate-spin" />创建中…</>
          ) : (
            <><BookImage size={16} className="mr-2" />创建封底</>
          )}
        </Button>
      </div>

      {/* 主内容区 - 左右分栏 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧设置面板 */}
        <div className="w-[360px] bg-white border-r border-slate-200 overflow-y-auto p-6 space-y-6">
          {/* 模板选择 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">选择模板</h3>
            <div className="grid grid-cols-2 gap-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`p-3 rounded-lg border-2 transition-all text-center ${
                    selectedTemplate.id === template.id
                      ? 'border-[#00CDD4] bg-[#00CDD4]/5 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="text-xs font-medium text-slate-700">{template.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 背景颜色选择 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Palette size={16} className="text-slate-600" />
              <h3 className="text-sm font-semibold text-slate-800">背景颜色</h3>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {backgroundColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setBackgroundColor(color.value)}
                  className={`h-12 rounded-lg border-2 transition-all hover:scale-105 relative ${
                    backgroundColor === color.value
                      ? 'border-[#00CDD4] shadow-md'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  style={{ background: color.value }}
                  title={color.name}
                >
                  {backgroundColor === color.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-5 h-5 bg-[#00CDD4] rounded-full flex items-center justify-center">
                        <X size={12} className="text-white" strokeWidth={3} />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 比例选择 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">图片比例</h3>
            <div className="grid grid-cols-3 gap-2">
              {aspectRatios.map((ratio) => (
                <button
                  key={ratio.value}
                  onClick={() => setSelectedAspectRatio(ratio.value as AspectRatioType)}
                  className={`p-2 rounded-lg border-2 text-xs font-medium transition-all ${
                    selectedAspectRatio === ratio.value
                      ? 'border-[#00CDD4] bg-[#00CDD4]/5 text-slate-800'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600'
                  }`}
                >
                  {ratio.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              当前绘本：{storybook.aspect_ratio || '16:9'}
            </p>
          </div>

          {/* 编者寄语编辑 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">编者寄语</h3>
            <textarea
              value={editorMessage}
              onChange={(e) => setEditorMessage(e.target.value)}
              className="w-full h-48 p-3 border border-slate-200 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:border-[#00CDD4] focus:ring-1 focus:ring-[#00CDD4]"
              placeholder="请输入编者寄语..."
            />
            <p className="text-xs text-slate-500 mt-2">
              {editorMessage.length} 字符
            </p>
          </div>

          {/* 提示信息 */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <p className="text-xs text-blue-700 leading-relaxed">
              💡 <strong>提示：</strong>封底是模板化生成的，不会调用大模型。左侧调整设置时，右侧预览会实时更新。
            </p>
          </div>
        </div>

        {/* 右侧预览区域 */}
        <div className="flex-1 bg-slate-100 flex items-center justify-center p-8 overflow-auto">
          <div
            ref={previewContainerRef}
            className="bg-white shadow-2xl overflow-hidden border border-slate-200 transition-all duration-300"
            style={{
              width: `${previewSize.width}px`,
              height: `${previewSize.height}px`,
              boxShadow: '20px 20px 60px rgba(0,0,0,0.1), inset -5px 0 10px rgba(0,0,0,0.05)',
            }}
          >
            <SelectedTemplateComponent
              storybookTitle={storybook.title}
              logoUrl="/caterpillar.png"
              editorMessage={editorMessage}
              backgroundColor={backgroundColor}
              aspectRatio={selectedAspectRatio}
            />
          </div>
        </div>
      </div>

      {/* 确认对话框 */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认创建封底</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            确认要为《{storybook.title}》创建封底吗？创建后封底将添加到绘本最后一页。
          </p>
          <DialogFooter className="flex gap-2 sm:flex-row flex-col">
            <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>取消</Button>
            <Button onClick={handleConfirmCreate} className="bg-[#00CDD4] hover:bg-[#00b0b8] text-white">确认创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BackCoverMode;
