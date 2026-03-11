import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Trash2, Loader2, Send, X, Check, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { StorybookPage, editPageImage, savePage, InsufficientPointsError } from '../services/storybookService';

interface TempImage {
  url: string;
  instruction: string;
}

interface StorybookPageCardProps {
  page: StorybookPage;
  index: number;
  storybookId: number;
  onSaved: (index: number, newPage: StorybookPage) => void;
  onDeleteRequest: (index: number) => void;
  regenSelectMode: boolean;
  regenSelected: boolean;
  onRegenToggle: (index: number) => void;
}

const StorybookPageCard: React.FC<StorybookPageCardProps> = ({
  page,
  index,
  storybookId,
  onSaved,
  onDeleteRequest,
  regenSelectMode,
  regenSelected,
  onRegenToggle,
}) => {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [draftText, setDraftText] = useState(page.text);
  const [imageHistory, setImageHistory] = useState<TempImage[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(-1);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showImageInput, setShowImageInput] = useState(false);
  const [imageInstruction, setImageInstruction] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleEnterEdit = () => {
    setDraftText(page.text);
    setImageHistory([]);
    setActiveImageIndex(-1);
    setShowImageInput(false);
    setImageInstruction('');
    setImageError(null);
    setEditOpen(true);
  };

  const handleCancelEdit = () => {
    setEditOpen(false);
    setImageHistory([]);
    setActiveImageIndex(-1);
    setShowImageInput(false);
    setImageInstruction('');
    setImageError(null);
  };

  useEffect(() => {
    if (editOpen && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [editOpen]);

  const currentDisplayImage =
    activeImageIndex >= 0 ? imageHistory[activeImageIndex].url : page.image_url;

  const handleGenerateImage = async () => {
    if (!imageInstruction.trim() || isGeneratingImage) return;
    setIsGeneratingImage(true);
    setImageError(null);
    const baseImage = activeImageIndex >= 0 ? imageHistory[activeImageIndex].url : page.image_url;
    try {
      const newUrl = await editPageImage(baseImage, imageInstruction);
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
    if (isSaving) return;
    setIsSaving(true);
    const finalImageUrl =
      activeImageIndex >= 0 ? imageHistory[activeImageIndex].url : page.image_url;
    try {
      const saved = await savePage(storybookId, index, draftText, finalImageUrl);
      onSaved(index, saved);
      setEditOpen(false);
      setImageHistory([]);
      setActiveImageIndex(-1);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // ── 再生成选择模式 ──
  if (regenSelectMode) {
    return (
      <div
        onClick={() => onRegenToggle(index)}
        className={`relative aspect-[16/9] rounded-xl overflow-hidden cursor-pointer ring-4 transition-all ${
          regenSelected ? 'ring-[#00CDD4] scale-[0.97]' : 'ring-transparent hover:ring-slate-300'
        }`}
      >
        <img src={page.image_url} alt={`Page ${index + 1}`} className="w-full h-full object-cover" />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
          <p className="text-white text-xs line-clamp-2">{page.text}</p>
        </div>
        {regenSelected && (
          <div className="absolute top-2 right-2 bg-[#00CDD4] rounded-full p-1">
            <Check size={14} className="text-white" />
          </div>
        )}
        <div className="absolute top-2 left-2 bg-black/50 rounded px-1.5 py-0.5 text-white text-xs">
          第 {index + 1} 页
        </div>
      </div>
    );
  }

  // ── 普通展示模式 ──
  return (
    <>
      <div className="relative w-full h-full">
        <img src={page.image_url} alt={`Page ${index + 1}`} className="w-full h-full object-cover" />
        {page.text && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-6 pt-10 pb-4">
            <p className="text-white text-sm md:text-base lg:text-lg font-lexend leading-relaxed text-center drop-shadow">
              {page.text}
            </p>
          </div>
        )}
        <div className="absolute top-3 right-3 flex gap-1.5 z-20">
          <Button
            variant="ghost" size="icon"
            onClick={handleEnterEdit}
            className="bg-white/90 hover:bg-white backdrop-blur rounded-lg text-slate-600 shadow-md h-8 w-8"
            title="编辑此页"
          >
            <Edit2 size={14} />
          </Button>
          <Button
            variant="ghost" size="icon"
            onClick={() => onDeleteRequest(index)}
            className="bg-white/90 hover:bg-red-50 backdrop-blur rounded-lg text-slate-500 hover:text-red-500 shadow-md h-8 w-8"
            title="删除此页"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* ── 编辑弹窗 ── */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) handleCancelEdit(); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-0">
            <DialogTitle className="text-sm font-semibold text-slate-700">编辑第 {index + 1} 页</DialogTitle>
          </DialogHeader>

          {/* 图片预览 */}
          <div className="relative aspect-[16/9] bg-slate-100 mx-4 mt-3 rounded-xl overflow-hidden">
            <img src={currentDisplayImage} alt={`Page ${index + 1}`} className="w-full h-full object-cover" />
            {isGeneratingImage && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                <Loader2 className="animate-spin text-white" size={32} />
                <span className="text-white text-sm font-medium">AI 生成中…</span>
              </div>
            )}
          </div>

          {/* 图片历史横排 */}
          {imageHistory.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto bg-slate-50 border-y border-slate-100">
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

          <div className="px-4 pb-4 pt-3 space-y-3">
            {/* 编辑图片 */}
            <div className="space-y-2">
              <Button
                variant="outline" size="sm"
                onClick={() => { setShowImageInput(v => !v); setImageError(null); }}
                className="gap-1.5 text-slate-600"
              >
                <ImageIcon size={14} />
                编辑图片
              </Button>
              {showImageInput && (
                <div className="flex gap-2">
                  <input
                    value={imageInstruction}
                    onChange={e => setImageInstruction(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerateImage(); } }}
                    placeholder="描述图片修改，例如：把天空改成夜晚…"
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4]"
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

            {/* 文字编辑 */}
            <textarea
              ref={textAreaRef}
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-[#00CDD4]/30 focus:border-[#00CDD4] leading-relaxed"
              placeholder="页面文字…"
            />

            {/* 操作按钮 */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                <X size={14} className="mr-1" />取消
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
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StorybookPageCard;
