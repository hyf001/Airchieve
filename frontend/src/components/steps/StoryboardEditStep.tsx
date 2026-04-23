/**
 * 分镜编辑步骤组件
 * 显示分镜列表，支持编辑每页的分镜描述
 */
import React, { useState } from 'react';
import { Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import { StoryboardItem } from '../../types/creation';

interface StoryboardEditStepProps {
  storyTitle: string;
  storyContent: string;
  initialStoryboards: StoryboardItem[];
  onNext: (storyboards: StoryboardItem[]) => void;
  onBack: () => void;
}

const StoryboardEditStep: React.FC<StoryboardEditStepProps> = ({
  storyTitle,
  storyContent,
  initialStoryboards,
  onNext,
  onBack,
}) => {
  const [storyboards, setStoryboards] = useState<StoryboardItem[]>(initialStoryboards);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditText(storyboards[index].text);
  };

  const handleSave = (index: number) => {
    setStoryboards((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              text: editText,
            }
          : item
      )
    );
    setEditingIndex(null);
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditText('');
  };

  const handleDeleteClick = (index: number) => {
    setDeleteIndex(index);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteIndex !== null) {
      setStoryboards((prev) => prev.filter((_, i) => i !== deleteIndex));
    }
    setDeleteDialogOpen(false);
    setDeleteIndex(null);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDeleteIndex(null);
  };

  const handleNext = () => {
    onNext(storyboards);
  };

  const contentPageCount = storyboards.filter(item => item.page_type !== 'cover').length;

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      {/* 标题栏 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <Edit3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-100">编辑分镜</h2>
          <p className="text-sm text-slate-400">调整每页的分镜描述</p>
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
              <h3 className="text-lg font-bold text-slate-800 mb-1">{storyTitle}</h3>
              <p className="text-slate-600 text-sm line-clamp-2">{storyContent}</p>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                <span>正文 {contentPageCount} 页</span>
                {storyboards.some(item => item.page_type === 'cover') && <span>含封面分镜</span>}
              </div>
            </div>

            {/* 分镜列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {storyboards.map((item, index) => (
                <div key={index} className="rounded-xl overflow-hidden bg-white/60 border border-slate-300/50">
                  {/* 编辑模式 */}
                  {editingIndex === index ? (
                    <div className="p-4">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 bg-white/80 border border-slate-300/50 rounded-lg text-slate-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        placeholder="输入分镜描述..."
                      />
                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={() => handleSave(index)}
                          variant="gradient-amber"
                          className="flex-1"
                          size="sm"
                        >
                          保存
                        </Button>
                        <Button
                          onClick={handleCancel}
                          variant="outline"
                          className="flex-1"
                          size="sm"
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // 预览模式
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-amber-600">
                          {item.page_type === 'cover' ? '封面' : `第 ${storyboards.slice(0, index + 1).filter(p => p.page_type !== 'cover').length} 页`}
                        </span>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleEdit(index)}
                            variant="ghost"
                            size="sm"
                            className="text-xs text-slate-800 hover:text-slate-900"
                          >
                            编辑
                          </Button>
                          {item.page_type !== 'cover' && (
                            <Button
                              onClick={() => handleDeleteClick(index)}
                              variant="ghost"
                              size="sm"
                              className="text-xs text-red-600 hover:text-red-700"
                            >
                              删除
                            </Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-slate-700 line-clamp-4 mb-3">{item.text}</p>
                      {item.storyboard && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {item.storyboard.scene && (
                            <div className="bg-amber-50 p-2 rounded">
                              <span className="text-amber-700 font-medium">场景:</span>
                              <span className="text-gray-700 ml-1">{item.storyboard.scene}</span>
                            </div>
                          )}
                          {item.storyboard.characters && (
                            <div className="bg-blue-50 p-2 rounded">
                              <span className="text-blue-700 font-medium">角色:</span>
                              <span className="text-gray-700 ml-1">{item.storyboard.characters}</span>
                            </div>
                          )}
                          {item.storyboard.shot && (
                            <div className="bg-green-50 p-2 rounded">
                              <span className="text-green-700 font-medium">构图:</span>
                              <span className="text-gray-700 ml-1">{item.storyboard.shot}</span>
                            </div>
                          )}
                          {item.storyboard.color && (
                            <div className="bg-yellow-50 p-2 rounded">
                              <span className="text-yellow-700 font-medium">色调:</span>
                              <span className="text-gray-700 ml-1">{item.storyboard.color}</span>
                            </div>
                          )}
                          {item.storyboard.lighting && (
                            <div className="bg-pink-50 p-2 rounded col-span-2">
                              <span className="text-pink-700 font-medium">光线:</span>
                              <span className="text-gray-700 ml-1">{item.storyboard.lighting}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 底��操作栏 */}
          <div className="flex items-center gap-2 px-4 py-3 flex-nowrap border-t border-white/50 bg-white/20">
            {/* 上一步按钮 */}
            <Button
              onClick={onBack}
              variant="outline"
              className="shrink-0"
            >
              上一步
            </Button>

            {/* 占位 */}
            <div className="flex-1" />

            {/* 确认分镜按钮 */}
            <Button
              onClick={handleNext}
              variant="gradient-rose"
              className="shrink-0 shadow-lg hover:shadow-purple-400/60 hover:scale-105 active:scale-95 transition-all"
            >
              <Edit3 size={16} strokeWidth={2} />
              <span>确认分镜</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="确认删除"
        description={`确定要删除${deleteIndex !== null && storyboards[deleteIndex]?.page_type === 'cover' ? '封面' : `第 ${deleteIndex !== null ? deleteIndex + 1 : 0} 页`}吗？此操作无法撤销。`}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default StoryboardEditStep;
