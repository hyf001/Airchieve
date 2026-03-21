import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Loader2, Send, X, Check, ImageIcon, ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  StorybookPage,
  editPageImage,
  savePage,
  deletePage,
  InsufficientPointsError,
  Storybook,
  toApiUrl,
} from '../../services/storybookService';
import ConfirmDialog from '../../components/ConfirmDialog';
import CanvasEditorModal from '../../components/CanvasEditor/CanvasEditorModal';

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
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageInstruction, setImageInstruction] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [showCanvasEditor, setShowCanvasEditor] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Reset edit state when page selection changes
  useEffect(() => {
    const page = pages[selectedIndex];
    if (!page) return;
    setDraftText(page.text);
    setImageHistory([]);
    setActiveImageIndex(-1);
    setShowImageInput(false);
    setImageInstruction('');
    setImageError(null);
  }, [selectedIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const page = pages[selectedIndex];
  const currentDisplayImage =
    activeImageIndex >= 0 ? imageHistory[activeImageIndex].url : page?.image_url ?? '';

  const handleGenerateImage = async () => {
    if (!imageInstruction.trim() || isGeneratingImage || !page) return;
    setIsGeneratingImage(true);
    setImageError(null);
    const baseImage = activeImageIndex >= 0 ? imageHistory[activeImageIndex].url : page.image_url;
    try {
      const newUrl = await editPageImage(storybook.id, baseImage, imageInstruction);
      const newEntry = { url: newUrl, instruction: imageInstruction };
      const newIndex = imageHistory.length;
      setImageHistory(prev => [...prev, newEntry]);
      setActiveImageIndex(newIndex);
      setImageInstruction('');
      setShowImageInput(false);
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
      setImageError(err instanceof Error ? err.message : '保存失败');
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

  if (!page) return null;

  return (
    <>
      <div className="w-full flex gap-4 justify-center items-start">
        {/* Thumbnail strip - left sidebar */}
        <div className="flex flex-col gap-2 overflow-y-auto p-2 custom-scrollbar max-h-[70vh] w-32 shrink-0">
          {pages.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`relative shrink-0 w-24 rounded-lg overflow-hidden ring-2 transition-all ${getAspectRatioClass(aspectRatio)} mx-auto ${
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

        {/* Selected page edit area */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Page preview */}
          <div className={`relative ${getAspectRatioClass(aspectRatio)} bg-slate-100 overflow-hidden h-[400px] md:h-[500px]`}>
            <img
              src={currentDisplayImage}
              alt={`第 ${selectedIndex + 1} 页`}
              className="w-full h-full object-cover"
            />
            {isGeneratingImage && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                <LoadingSpinner size={32} />
                <span className="text-white text-sm font-medium">AI 生成中，请不要刷新页面…</span>
              </div>
            )}
            {/* Page navigation buttons inside preview */}
            <Button
              variant="ghost" size="icon"
              onClick={() => setSelectedIndex(p => Math.max(0, p - 1))}
              disabled={selectedIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white/90 text-slate-700 rounded-full shadow-md z-10 disabled:opacity-0 h-9 w-9"
            >
              <ChevronLeft size={20} />
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={() => setSelectedIndex(p => Math.min(pages.length - 1, p + 1))}
              disabled={selectedIndex >= pages.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white/90 text-slate-700 rounded-full shadow-md z-10 disabled:opacity-0 h-9 w-9"
            >
              <ChevronRight size={20} />
            </Button>
          </div>

          {/* Image history strip */}
          {imageHistory.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto bg-slate-50 border-b border-slate-100">
              <button
                onClick={() => setActiveImageIndex(-1)}
                className={`relative shrink-0 w-12 h-12 rounded-lg overflow-hidden ring-2 transition-all ${
                  activeImageIndex === -1 ? 'ring-[#00CDD4]' : 'ring-transparent hover:ring-slate-300'
                }`}
                title="原图"
              >
                <img src={page.image_url} alt="原图" className="w-full h-full object-cover" />
                <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/50 leading-4">原图</span>
              </button>
              {imageHistory.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={`relative shrink-0 w-12 h-12 rounded-lg overflow-hidden ring-2 transition-all ${
                    activeImageIndex === i ? 'ring-[#00CDD4]' : 'ring-transparent hover:ring-slate-300'
                  }`}
                  title={img.instruction}
                >
                  <img src={img.url} alt={`v${i + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 text-center text-[9px] text-white bg-black/50 leading-4">v{i + 1}</span>
                </button>
              ))}
            </div>
          )}

          {/* Edit controls */}
          <div className="px-4 pb-4 pt-3 space-y-3">
            {/* Image edit */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => { setShowImageInput(v => !v); setImageError(null); }}
                  className="gap-1.5 text-slate-600"
                >
                  <ImageIcon size={14} />
                  编辑图片
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setShowCanvasEditor(true)}
                  className="gap-1.5 text-slate-600"
                >
                  <PenLine size={14} />
                  画布编辑
                </Button>
              </div>
              {showImageInput && (
                <div className="flex gap-2">
                  <input
                    value={imageInstruction}
                    onChange={e => setImageInstruction(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerateImage(); } }}
                    placeholder="描述图片修改，例如：把天空改成夜晚…"
                    className="flex-1 min-w-0 text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4] placeholder:text-slate-400"
                    disabled={isGeneratingImage}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleGenerateImage}
                    disabled={!imageInstruction.trim() || isGeneratingImage}
                    className="bg-[#00CDD4] hover:bg-[#00b8be] text-white shrink-0"
                  >
                    {isGeneratingImage ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </Button>
                </div>
              )}
              {imageError && <p className="text-xs text-red-500">{imageError}</p>}
            </div>

            {/* Text edit */}
            <textarea
              ref={textAreaRef}
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              rows={3}
              className="w-full text-sm text-slate-900 bg-white border border-slate-200 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4] leading-relaxed placeholder:text-slate-400"
              placeholder="页面文字…"
            />

            {/* Action row */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost" size="sm"
                onClick={() => setDeleteConfirmIndex(selectedIndex)}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 gap-1.5"
              >
                <Trash2 size={14} />
                删除此页
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => {
                    const p = pages[selectedIndex];
                    if (p) { setDraftText(p.text); setImageHistory([]); setActiveImageIndex(-1); }
                  }}
                  disabled={isSaving}
                >
                  <X size={14} className="mr-1" />重置
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-[#00CDD4] hover:bg-[#00b8be] text-white"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Check size={14} className="mr-1" />}
                  保存
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmIndex !== null}
        title="确认删除此页"
        description={`确定要删除第 ${(deleteConfirmIndex ?? 0) + 1} 页吗？此操作不可恢复。`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmIndex(null)}
      />

      {showCanvasEditor && page && (
        <CanvasEditorModal
          baseImageUrl={toApiUrl(currentDisplayImage)}
          pageText={draftText}
          onApply={base64 => {
            const newIndex = imageHistory.length;
            setImageHistory(prev => [...prev, { url: base64, instruction: '画布编辑' }]);
            setActiveImageIndex(newIndex);
            setShowCanvasEditor(false);
          }}
          onClose={() => setShowCanvasEditor(false)}
        />
      )}
    </>
  );
};

export default EditMode;
