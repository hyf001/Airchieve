/**
 * 分镜卡片��件
 * 显示单页的分镜信息，支持编辑
 */
import React, { useState } from 'react';
import { Edit3, RefreshCw, Film } from 'lucide-react';
import { StoryboardItem } from '../types/creation';

interface StoryboardCardProps {
  index: number;
  item: StoryboardItem;
  onEdit: (index: number, updates: Partial<StoryboardItem>) => void;
  onRegenerate: (index: number) => void;
  isRegenerating?: boolean;
}

const StoryboardCard: React.FC<StoryboardCardProps> = ({
  index,
  item,
  onEdit,
  onRegenerate,
  isRegenerating = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(item.text);
  const [editedStoryboard, setEditedStoryboard] = useState(item.storyboard);

  const handleSave = () => {
    onEdit(index, {
      text: editedText,
      storyboard: editedStoryboard,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedText(item.text);
    setEditedStoryboard(item.storyboard);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 border border-gray-200">
      {/* 卡片头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-amber-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            第 {index + 1} 页
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <>
              <button
                onClick={() => onRegenerate(index)}
                disabled={isRegenerating}
                className="p-2 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition disabled:opacity-50"
                title="重新生成分镜"
              >
                <RefreshCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-gray-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                title="编辑分镜"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* 文本内容 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          故事文本
        </label>
        {isEditing ? (
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
          />
        ) : (
          <p className="text-gray-800 text-sm leading-relaxed bg-gray-50 p-3 rounded-lg">
            {item.text}
          </p>
        )}
      </div>

      {/* 分镜信息 */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Film className="w-4 h-4" />
          分镜信息
        </h4>

        {isEditing ? (
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">视觉摘要</label>
              <input
                type="text"
                value={editedStoryboard.summary || ''}
                onChange={(e) =>
                  setEditedStoryboard({ ...editedStoryboard, summary: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">场景</label>
              <input
                type="text"
                value={editedStoryboard.scene}
                onChange={(e) =>
                  setEditedStoryboard({ ...editedStoryboard, scene: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">人物</label>
              <input
                type="text"
                value={editedStoryboard.characters}
                onChange={(e) =>
                  setEditedStoryboard({ ...editedStoryboard, characters: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">构图</label>
              <input
                type="text"
                value={editedStoryboard.shot}
                onChange={(e) =>
                  setEditedStoryboard({ ...editedStoryboard, shot: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-purple-50 p-2 rounded col-span-2">
              <span className="text-purple-700 font-medium">视觉摘要:</span>
              <span className="text-gray-700 ml-1">{item.storyboard.summary}</span>
            </div>
            <div className="bg-amber-50 p-2 rounded">
              <span className="text-amber-700 font-medium">场景:</span>
              <span className="text-gray-700 ml-1">{item.storyboard.scene}</span>
            </div>
            <div className="bg-blue-50 p-2 rounded">
              <span className="text-blue-700 font-medium">人物:</span>
              <span className="text-gray-700 ml-1">{item.storyboard.characters}</span>
            </div>
            <div className="bg-green-50 p-2 rounded">
              <span className="text-green-700 font-medium">构图:</span>
              <span className="text-gray-700 ml-1">{item.storyboard.shot}</span>
            </div>
          </div>
        )}
      </div>

      {/* 编辑模式按钮 */}
      {isEditing && (
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
          >
            保存
          </button>
        </div>
      )}
    </div>
  );
};

export default StoryboardCard;
