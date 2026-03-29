import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Loader2, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  StorybookPage,
  savePage,
  deletePage,
  Storybook,
  toApiUrl,
} from '../../services/storybookService';
import ConfirmDialog from '../../components/ConfirmDialog';
import AIEditTool from '../../components/editor/AIEditTool';
import TextEditTool, { TextLayer, TextEditToolOverlay, TextEditToolRef } from '../../components/editor/TextEditTool';

interface TempImage {
  url: string;
  instruction: string;
}

interface EditModeProps {
  storybook: Storybook;
  onStorybookChange: (storybook: Storybook) => void;
}

const EditMode: React.FC<EditModeProps> = ({ storybook, onStorybookChange }) => {
  const { toast } = useToast();
  const pages = storybook.pages || [];
  const aspectRatio = storybook.aspect_ratio || '16:9';

  // 根据比例获取 Tailwind 类名
  const getAspectRatioClass = (ratio: string): string => {
    switch (ratio) {
      case '1:1':
        return 'aspect-square';
      case '4:3':
        return 'aspect-[4/3]';
      case '16:9':
      default:
        return 'aspect-[16/9]';
    }
  };

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Edit state for the selected page
  const [draftText, setDraftText] = useState('');
  const [imageHistory, setImageHistory] = useState<TempImage[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(-1);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);

  const [activeCanvasTool, setActiveCanvasTool] = useState<'text' | 'ai-edit' | 'adjust' | 'color' | 'filter' | 'eraser' | 'border' | 'draw' | 'mosaic' | 'marker' | 'optimize' | 'blur' | 'cutout' | 'background' | 'effect' | 'creative' | 'repair'>('ai-edit');

  // TextEditTool 的 ref
  const textEditToolRef = useRef<TextEditToolRef>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 文字工具的状态（从 TextEditTool 获取）
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // 切换页面确认状态
  const [pendingPageChange, setPendingPageChange] = useState<number | null>(null);
  const [showPageChangeConfirm, setShowPageChangeConfirm] = useState(false);

  // Reset edit state when page selection changes
  useEffect(() => {
    const page = pages[selectedIndex];
    if (!page) return;
    setDraftText(page.text);
    setImageHistory([]);
    setActiveImageIndex(-1);
  }, [selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const page = pages[selectedIndex];
  const currentDisplayImage =
    activeImageIndex >= 0 ? imageHistory[activeImageIndex].url : toApiUrl(page?.image_url ?? '');

  // 处理 AI 生成的图片
  const handleAIImageGenerated = (imageUrl: string, instruction: string) => {
    const newEntry = { url: imageUrl, instruction };
    setImageHistory(prev => {
      const newHistory = [...prev, newEntry];
      setActiveImageIndex(newHistory.length - 1);
      return newHistory;
    });
  };

  const handleSave = async () => {
    if (isSaving || !page) return;
    setIsSaving(true);
    const finalImageUrl =
      activeImageIndex >= 0 ? imageHistory[activeImageIndex].url : page.image_url;
    try {
      const saved = await savePage(storybook.id, selectedIndex, draftText, finalImageUrl);
      const pages = [...(storybook.pages || [])];
      pages[selectedIndex] = saved;
      onStorybookChange({ ...storybook, pages });
      setImageHistory([]);
      setActiveImageIndex(-1);
      toast({ title: '已保存' });
    } catch (err) {
      toast({ variant: 'destructive', title: '保存失败', description: err instanceof Error ? err.message : undefined });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmIndex === null) return;
    const idx = deleteConfirmIndex;
    setDeleteConfirmIndex(null);
    try {
      const updated = await deletePage(storybook.id, idx);
      onStorybookChange(updated);
      setSelectedIndex(prev => Math.min(prev, (updated.pages?.length ?? 1) - 1));
    } catch (err) {
      toast({ variant: 'destructive', title: '删除失败', description: err instanceof Error ? err.message : undefined });
    }
  };

  // 检查当前页面是否有未保存的编辑
  const hasUnsavedChanges = () => {
    return imageHistory.length > 0 || (page && draftText !== page.text);
  };

  // 处理页面切换
  const handlePageSelect = (index: number) => {
    if (index === selectedIndex) return;

    // 如果有未保存的编辑，显示确认对话框
    if (hasUnsavedChanges()) {
      setPendingPageChange(index);
      setShowPageChangeConfirm(true);
    } else {
      setSelectedIndex(index);
    }
  };

  // 确认切换页面
  const handleConfirmPageChange = () => {
    if (pendingPageChange !== null) {
      setSelectedIndex(pendingPageChange);
      setPendingPageChange(null);
      setShowPageChangeConfirm(false);
    }
  };

  // 取消切换页面
  const handleCancelPageChange = () => {
    setPendingPageChange(null);
    setShowPageChangeConfirm(false);
  };


  if (!page) return null;

  return (
    <>
      <div className="w-full flex gap-4 h-full">
        {/* === 左侧：缩略图导航栏 === */}
        <div className="flex flex-col gap-2 overflow-y-auto p-2 w-32 shrink-0 custom-scrollbar">
          {pages.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handlePageSelect(idx)}
              className={`relative shrink-0 w-24 rounded-lg overflow-hidden ring-2 transition-all mx-auto ${
                selectedIndex === idx
                  ? 'ring-[#00CDD4] scale-[1.04]'
                  : 'ring-transparent hover:ring-slate-300'
              }`}
            >
              <img src={p.image_url} alt={`第 ${idx + 1} 页`} className="w-full h-full object-cover" />
              <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/50 leading-4">
                第 {idx + 1} 页
              </span>
            </button>
          ))}
        </div>

        {/* === 中间：主内容区域 === */}
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-w-0">
          {/* 页面图片区域 */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col shrink-0">
            <div className="p-4 flex justify-center bg-white shrink-0">
              <div
                ref={canvasRef}
                className={`relative ${getAspectRatioClass(aspectRatio)} bg-slate-100 max-h-[350px]`}
                style={{ width: 'auto' }}
              >
              <img
                src={currentDisplayImage}
                alt={`第 ${selectedIndex + 1} 页`}
                className="w-full h-full object-contain"
              />
              {/* 文字图层叠加层 */}
              {activeCanvasTool === 'text' && textLayers.length > 0 && textEditToolRef.current && (
                <TextEditToolOverlay
                  layers={textLayers}
                  selectedLayerId={selectedLayerId}
                  onLayerMouseDown={(e, layer) => {
                    textEditToolRef.current?.handleLayerMouseDown(e, layer);
                  }}
                  onResizeMouseDown={(e, layer, handle) => {
                    textEditToolRef.current?.handleResizeMouseDown(e, layer, handle);
                  }}
                  onTextChange={(id, text) => {
                    textEditToolRef.current?.handleTextChange(id, text);
                  }}
                  onDeleteLayer={(id) => {
                    textEditToolRef.current?.deleteLayer(id);
                  }}
                  onLayerClick={(id) => {
                    textEditToolRef.current?.selectLayer(id);
                  }}
                  isDragging={isDragging}
                  isResizing={isResizing}
                />
              )}
              </div>
            </div>

            {/* 编辑历史区域 - 固定高度 */}
            <div className="h-[120px] bg-slate-50 border-t flex flex-col">
              <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">编辑历史（点击编辑历史回到任意编辑时刻）</span>
                {imageHistory.length > 0 && (
                  <button
                    onClick={() => {
                      setImageHistory([]);
                      setActiveImageIndex(-1);
                    }}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    清空历史
                  </button>
                )}
              </div>
              <div className="flex-1 flex items-center gap-2 px-4 overflow-x-auto">
                {imageHistory.length === 0 ? (
                  <div className="w-full text-center text-xs text-slate-400">
                    暂无编辑历史
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setActiveImageIndex(-1)}
                      className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden ring-2 transition-all ${
                        activeImageIndex === -1 ? 'ring-[#00CDD4]' : 'ring-transparent hover:ring-slate-300'
                      }`}
                      title="原图"
                    >
                      <img src={page.image_url} alt="原图" className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/50 leading-3">原图</span>
                    </button>
                    {imageHistory.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImageIndex(i)}
                        className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden ring-2 transition-all ${
                          activeImageIndex === i ? 'ring-[#00CDD4]' : 'ring-transparent hover:ring-slate-300'
                        }`}
                        title={img.instruction}
                      >
                        <img src={img.url} alt={`v${i + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/50 leading-3">v{i + 1}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 页面文字区域 */}
          <div className="bg-white rounded-2xl shadow-xl p-3">
            <textarea
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              rows={2}
              className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4] leading-relaxed placeholder:text-slate-400"
              placeholder="页面文字…"
            />
            <div className="mt-1.5 text-xs text-slate-400 text-right">
              {draftText.length} 字符
            </div>
          </div>

          {/* ��面操作区域 */}
          <div className="bg-white rounded-2xl shadow-xl p-3 shrink-0">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">页面操作</h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteConfirmIndex(selectedIndex)}
                className="flex-1 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 justify-center gap-2"
              >
                <Trash2 size={14} />
                删除此页
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-[#00CDD4] hover:bg-[#00b8be] text-white justify-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    保存中…
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    保存
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* === 右侧：编辑工具栏 === */}
        <div className="w-[480px] shrink-0 flex flex-col">
          {/* 编辑工具栏 */}
          <div className="bg-white rounded-2xl shadow-xl p-4 flex flex-col h-full overflow-hidden">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">图片工具</h3>

            {/* 工具网格 - 可滚动区域 */}
            <div className="max-h-[200px] overflow-y-auto mb-3 pr-1">
              <div className="grid grid-cols-8 gap-2">
                {[
                  { id: 'ai-edit' as const, label: 'AI改图', icon: '🤖' },
                  { id: 'text' as const, label: '文字', icon: '✏️' },
                  { id: 'adjust' as const, label: '编辑', icon: '⚙️' },
                  { id: 'color' as const, label: '调色', icon: '🌈' },
                  { id: 'filter' as const, label: '滤镜', icon: '🎨' },
                  { id: 'eraser' as const, label: '消除笔', icon: '🧹' },
                  { id: 'border' as const, label: '边框', icon: '🖼️' },
                  { id: 'draw' as const, label: '涂鸦笔', icon: '🖌️' },
                  { id: 'mosaic' as const, label: '马赛克', icon: '▦' },
                  { id: 'marker' as const, label: '标记', icon: '📍' },
                  { id: 'optimize' as const, label: '智能优化', icon: '✨' },
                  { id: 'blur' as const, label: '背景虚化', icon: '💫' },
                  { id: 'cutout' as const, label: '抠图', icon: '✂️' },
                  { id: 'background' as const, label: '背景', icon: '🏞️' },
                  { id: 'effect' as const, label: '特效', icon: '💥' },
                  { id: 'creative' as const, label: '创意玩法', icon: '🎪' },
                  { id: 'repair' as const, label: '画质修复', icon: '🔧' },
                ].map(tool => (
                  <Button
                    key={tool.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveCanvasTool(tool.id)}
                    className={`relative flex flex-col items-center gap-1 p-2 h-auto rounded-lg text-xs transition-colors z-10 ${
                      activeCanvasTool === tool.id
                        ? 'bg-[#00CDD4]/15 text-[#00CDD4] ring-2 ring-[#00CDD4]/30 ring-inset'
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                    title={tool.label}
                  >
                    <span className="text-xl">{tool.icon}</span>
                    <span className="text-[10px] leading-tight">{tool.label}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* 工具面板内容 - 可滚动区域 */}
            <div className="flex-1 overflow-y-auto min-h-0 p-3 bg-slate-50 rounded-lg">
              {activeCanvasTool === 'text' && (
                <TextEditTool
                  ref={textEditToolRef}
                  baseImageUrl={currentDisplayImage}
                  initialText={draftText}
                  containerRef={canvasRef}
                  onLayersChange={setTextLayers}
                  onSelectedLayerChange={setSelectedLayerId}
                  onIsDraggingChange={setIsDragging}
                  onIsResizingChange={setIsResizing}
                  onApply={(imageUrl) => handleAIImageGenerated(imageUrl, '文字编辑')}
                />
              )}
              {activeCanvasTool === 'ai-edit' && (
                <AIEditTool
                  storybookId={String(storybook.id)}
                  baseImageUrl={currentDisplayImage}
                  onImageGenerated={handleAIImageGenerated}
                />
              )}
              {activeCanvasTool === 'adjust' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>编辑工具</p>
                  <p className="text-xs">裁剪、旋转、调节亮度对比度等</p>
                </div>
              )}
              {activeCanvasTool === 'color' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>调色工具</p>
                  <p className="text-xs">调节色彩温度、饱和度、色相</p>
                </div>
              )}
              {activeCanvasTool === 'filter' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>滤镜工具</p>
                  <p className="text-xs">各种精美滤镜效果</p>
                </div>
              )}
              {activeCanvasTool === 'eraser' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>消除笔</p>
                  <p className="text-xs">智能移除图片中的物体</p>
                </div>
              )}
              {activeCanvasTool === 'border' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>边框</p>
                  <p className="text-xs">添加各种风格的边框</p>
                </div>
              )}
              {activeCanvasTool === 'draw' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>涂鸦笔</p>
                  <p className="text-xs">自由绘制和创作</p>
                </div>
              )}
              {activeCanvasTool === 'mosaic' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>马赛克</p>
                  <p className="text-xs">添加马赛克效果</p>
                </div>
              )}
              {activeCanvasTool === 'marker' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>标��</p>
                  <p className="text-xs">添加箭头、标记等</p>
                </div>
              )}
              {activeCanvasTool === 'optimize' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>智能优化</p>
                  <p className="text-xs">一键优化图片质量</p>
                </div>
              )}
              {activeCanvasTool === 'blur' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>背景虚化</p>
                  <p className="text-xs">智能虚化背景突出主体</p>
                </div>
              )}
              {activeCanvasTool === 'cutout' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>抠图</p>
                  <p className="text-xs">智能抠出主体</p>
                </div>
              )}
              {activeCanvasTool === 'background' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>背景</p>
                  <p className="text-xs">更换背景颜色或图片</p>
                </div>
              )}
              {activeCanvasTool === 'effect' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>特效</p>
                  <p className="text-xs">添加各种特效效果</p>
                </div>
              )}
              {activeCanvasTool === 'creative' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>创意玩法</p>
                  <p className="text-xs">有趣的创意功能</p>
                </div>
              )}
              {activeCanvasTool === 'repair' && (
                <div className="text-center text-slate-400 text-sm py-8 space-y-2">
                  <p>画质修复</p>
                  <p className="text-xs">修复模糊提升清晰度</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteConfirmIndex !== null}
        title="确认删除此页"
        description={`确定要删除第 ${(deleteConfirmIndex ?? 0) + 1} 页吗？此操作不可恢复。`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmIndex(null)}
      />

      {/* 页面切换确认对话框 */}
      <ConfirmDialog
        open={showPageChangeConfirm}
        title="未保存的编辑"
        description="当前页面有未保存的编辑，切换页面将丢失这些修改。是否确定要切换？"
        onConfirm={handleConfirmPageChange}
        onCancel={handleCancelPageChange}
      />
    </>
  );
};

export default EditMode;
