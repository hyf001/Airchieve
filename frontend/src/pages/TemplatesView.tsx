
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Loader2, FileText, X, Save } from 'lucide-react';
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  Template,
  TemplateListItem,
  CreateTemplateRequest,
  UpdateTemplateRequest
} from '../services/templateService';

interface TemplatesViewProps {
  onBack?: () => void;
}

interface TemplateFormData {
  name: string;
  description: string;
  instruction: string;
  systemprompt: string;
  is_active: boolean;
  sort_order: number;
}

const TemplatesView: React.FC<TemplatesViewProps> = ({ onBack }) => {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    instruction: '',
    systemprompt: '',
    is_active: true,
    sort_order: 0
  });

  // Load templates
  useEffect(() => {
    let isMounted = true;

    const fetchTemplates = async () => {
      try {
        setLoading(true);
        setError(null);
        // 获取当前用户的模版，这里暂时不按用户筛选，可以后续添加用户认证
        const data = await listTemplates({ limit: 100 });
        if (isMounted) {
          setTemplates(data);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : '加载模版失败');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchTemplates();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      // 获取当前用户的模版，这里暂时不按用户筛选，可以后续添加用户认证
      const data = await listTemplates({ limit: 100 });
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError(err instanceof Error ? err.message : '加载模版失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      instruction: '',
      systemprompt: '',
      is_active: true,
      sort_order: 0
    });
    setShowDialog(true);
  };

  const handleEdit = async (template: TemplateListItem) => {
    try {
      // 获取完整的模版信息
      const response = await fetch(`/api/v1/templates/${template.id}`);
      if (!response.ok) throw new Error('获取模版详情失败');
      const fullTemplate = await response.json() as Template;

      setEditingTemplate(fullTemplate);
      setFormData({
        name: fullTemplate.name,
        description: fullTemplate.description || '',
        instruction: fullTemplate.instruction,
        systemprompt: fullTemplate.systemprompt || '',
        is_active: fullTemplate.is_active,
        sort_order: fullTemplate.sort_order
      });
      setShowDialog(true);
    } catch (err) {
      console.error('Failed to load template details:', err);
      setError('获取模版详情失败');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`确定要删除模版"${name}"吗？此操作不可恢复。`)) {
      return;
    }

    try {
      await deleteTemplate(id);
      await loadTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
      setError(err instanceof Error ? err.message : '删除模版失败');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.instruction.trim()) {
      setError('模版名称和指令模板不能为空');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (editingTemplate) {
        // 更新模版
        const updateReq: UpdateTemplateRequest = {
          name: formData.name,
          description: formData.description || undefined,
          instruction: formData.instruction,
          systemprompt: formData.systemprompt || undefined,
          is_active: formData.is_active,
          sort_order: formData.sort_order,
          modifier: 'user' // TODO: 后续接入真实用户信息
        };
        await updateTemplate(editingTemplate.id, updateReq);
      } else {
        // 创建模版
        const createReq: CreateTemplateRequest = {
          name: formData.name,
          instruction: formData.instruction,
          creator: 'user', // TODO: 后续接入真实用户信息
          description: formData.description || undefined,
          systemprompt: formData.systemprompt || undefined,
          is_active: formData.is_active,
          sort_order: formData.sort_order
        };
        await createTemplate(createReq);
      }

      setShowDialog(false);
      await loadTemplates();
    } catch (err) {
      console.error('Failed to submit template:', err);
      setError(err instanceof Error ? err.message : '保存模版失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors duration-200"
            >
              <ArrowLeft size={20} />
              <span>返回</span>
            </button>
            <div>
              <h1 className="text-2xl font-bold font-lexend text-slate-900">我的模版</h1>
              <p className="text-sm text-slate-500 mt-0.5">管理你的绘本生成模版</p>
            </div>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors duration-200 shadow-sm"
          >
            <Plus size={20} />
            <span>创建模版</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={40} className="text-indigo-600 animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FileText size={32} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">还没有模版</h3>
              <p className="text-slate-500 mb-6 max-w-md">
                创建你的第一个模版，用它来快速生成风格一致的绘本
              </p>
              <button
                onClick={handleCreate}
                className="flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors duration-200"
              >
                <Plus size={20} />
                <span>创建第一个模版</span>
              </button>
            </div>
          ) : (
            /* Template grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow duration-200"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-1 line-clamp-1">
                          {template.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          创建于 {new Date(template.created_at).toLocaleDateString('zh-CN')}
                        </p>
                      </div>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        template.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {template.is_active ? '启用' : '停用'}
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-4 min-h-[2.5rem]">
                      {template.description || '暂无描述'}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(template)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors duration-200"
                      >
                        <Edit2 size={16} />
                        <span className="text-sm">编辑</span>
                      </button>
                      <button
                        onClick={() => handleDelete(template.id, template.name)}
                        className="flex items-center justify-center px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors duration-200"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            {/* Dialog Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">
                {editingTemplate ? '编辑模版' : '创建新模版'}
              </h2>
              <button
                onClick={() => setShowDialog(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors duration-200"
              >
                <X size={20} />
              </button>
            </div>

            {/* Dialog Content */}
            <form onSubmit={handleSubmit} className="flex flex-col max-h-[calc(90vh-5rem)]">
              <div className="flex-1 overflow-auto px-6 py-4">
                {/* Template Name */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    模版名称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="例如：水彩风格童话"
                    required
                  />
                </div>

                {/* Description */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    模版描述
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    rows={2}
                    placeholder="简单描述这个模版的用途和特点"
                  />
                </div>

                {/* Instruction */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    用户指令模板 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.instruction}
                    onChange={(e) => setFormData({ ...formData, instruction: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
                    rows={4}
                    placeholder="定义用户输入的指令格式，例如：请创建一个关于{主题}的故事，风格为{风格}"
                    required
                  />
                </div>

                {/* System Prompt */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    系统提示词
                  </label>
                  <textarea
                    value={formData.systemprompt}
                    onChange={(e) => setFormData({ ...formData, systemprompt: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
                    rows={4}
                    placeholder="定义AI生成内容时使用的系统级提示词"
                  />
                </div>

                {/* Settings Row */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Is Active */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700">启用模版</span>
                    </label>
                  </div>

                  {/* Sort Order */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      排序顺序
                    </label>
                    <input
                      type="number"
                      value={formData.sort_order}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      min="0"
                    />
                  </div>
                </div>
              </div>

              {/* Dialog Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowDialog(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors duration-200"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>保存中...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>{editingTemplate ? '保存修改' : '创建模版'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplatesView;
