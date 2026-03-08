
import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, Loader2, FileText, Save, BookOpen } from 'lucide-react';
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
import { listStorybooks, getStorybook, StorybookListItem, Storybook } from '../services/storybookService';
import StorybookPreview from '../components/StorybookPreview';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface TemplatesViewProps {
  onBack?: () => void;
}

interface TemplateFormData {
  name: string;
  description: string;
  instruction: string;
  systemprompt: string;
  storybook_id: number | null;
  is_active: boolean;
  sort_order: number;
}

const TemplatesView: React.FC<TemplatesViewProps> = ({ onBack }) => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [templateStorybooks, setTemplateStorybooks] = useState<Map<number, Storybook>>(new Map());
  const [templateStorybookIds, setTemplateStorybookIds] = useState<Map<number, number>>(new Map());
  const [storybooks, setStorybooks] = useState<StorybookListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStorybooks, setLoadingStorybooks] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>({
    name: '',
    description: '',
    instruction: '',
    systemprompt: '',
    storybook_id: null,
    is_active: true,
    sort_order: 0
  });

  const loadTemplateStorybooks = async (templateList: TemplateListItem[]) => {
    try {
      const storybookIds = new Set<number>();
      const templateIdMap = new Map<number, number>();

      const templateDetails = await Promise.all(
        templateList.map(async (t) => {
          try {
            const response = await fetch(`/api/v1/templates/${t.id}`);
            if (response.ok) return await response.json() as Template;
          } catch (err) {
            console.error(`Failed to load template ${t.id} details:`, err);
          }
          return null;
        })
      );

      templateDetails.forEach(t => {
        if (t?.storybook_id) {
          storybookIds.add(t.storybook_id);
          templateIdMap.set(t.id, t.storybook_id);
        }
      });
      setTemplateStorybookIds(templateIdMap);

      if (storybookIds.size > 0) {
        const storybookMap = new Map<number, Storybook>();
        await Promise.all(
          Array.from(storybookIds).map(async (id) => {
            try {
              const storybook = await getStorybook(id);
              storybookMap.set(id, storybook);
            } catch (err) {
              console.error(`Failed to load storybook ${id}:`, err);
            }
          })
        );
        setTemplateStorybooks(storybookMap);
      }
    } catch (err) {
      console.error('Failed to load template storybooks:', err);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const data = await listTemplates({ limit: 100 });
        if (isMounted) {
          setTemplates(data);
          await loadTemplateStorybooks(data);
        }
      } catch (err) {
        if (isMounted) toast({ variant: "destructive", title: "加载模版失败", description: err instanceof Error ? err.message : undefined });
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchTemplates();
    return () => { isMounted = false; };
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await listTemplates({ limit: 100 });
      setTemplates(data);
      await loadTemplateStorybooks(data);
    } catch (err) {
      toast({ variant: "destructive", title: "加载模版失败", description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  };

  const loadStorybooks = async () => {
    try {
      setLoadingStorybooks(true);
      const data = await listStorybooks({ status: 'finished', is_public: true, limit: 100 });
      setStorybooks(data);
    } catch (err) {
      console.error('Failed to load storybooks:', err);
    } finally {
      setLoadingStorybooks(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({ name: '', description: '', instruction: '', systemprompt: '', storybook_id: null, is_active: true, sort_order: 0 });
    setShowDialog(true);
    loadStorybooks();
  };

  const handleEdit = async (template: TemplateListItem) => {
    try {
      const response = await fetch(`/api/v1/templates/${template.id}`);
      if (!response.ok) throw new Error('获取模版详情失败');
      const fullTemplate = await response.json() as Template;
      setEditingTemplate(fullTemplate);
      setFormData({
        name: fullTemplate.name,
        description: fullTemplate.description || '',
        instruction: fullTemplate.instruction,
        systemprompt: fullTemplate.systemprompt || '',
        storybook_id: fullTemplate.storybook_id,
        is_active: fullTemplate.is_active,
        sort_order: fullTemplate.sort_order
      });
      setShowDialog(true);
      loadStorybooks();
    } catch (err) {
      toast({ variant: "destructive", title: "获取模版详情失败", description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    setDeleteConfirm({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await deleteTemplate(id);
      await loadTemplates();
    } catch (err) {
      toast({ variant: "destructive", title: "删除模版失败", description: err instanceof Error ? err.message : undefined });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.instruction.trim()) {
      toast({ variant: "destructive", title: "模版名称和指令模板不能为空" });
      return;
    }
    try {
      setSubmitting(true);
      if (editingTemplate) {
        const updateReq: UpdateTemplateRequest = {
          name: formData.name,
          description: formData.description || undefined,
          instruction: formData.instruction,
          systemprompt: formData.systemprompt || undefined,
          storybook_id: formData.storybook_id || undefined,
          is_active: formData.is_active,
          sort_order: formData.sort_order,
          modifier: 'user'
        };
        await updateTemplate(editingTemplate.id, updateReq);
      } else {
        const createReq: CreateTemplateRequest = {
          name: formData.name,
          instruction: formData.instruction,
          creator: 'user',
          description: formData.description || undefined,
          systemprompt: formData.systemprompt || undefined,
          storybook_id: formData.storybook_id || undefined,
          is_active: formData.is_active,
          sort_order: formData.sort_order
        };
        await createTemplate(createReq);
      }
      setShowDialog(false);
      await loadTemplates();
    } catch (err) {
      toast({ variant: "destructive", title: "保存模版失败", description: err instanceof Error ? err.message : undefined });
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
            <Button variant="ghost" onClick={onBack} className="gap-2 text-slate-600">
              <ArrowLeft size={20} /> 返回
            </Button>
            <div>
              <h1 className="text-2xl font-bold font-lexend text-slate-900">我的模版</h1>
              <p className="text-sm text-slate-500 mt-0.5">管理你的绘本生成模版</p>
            </div>
          </div>
          <Button onClick={handleCreate} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Plus size={20} /> 创建模版
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={40} className="text-indigo-600 animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FileText size={32} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">还没有模版</h3>
              <p className="text-slate-500 mb-6 max-w-md">
                创建你的第一个模版，用它来快速生成风格一致的绘本
              </p>
              <Button onClick={handleCreate} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                <Plus size={20} /> 创建第一个模版
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => {
                const storybookId = templateStorybookIds.get(template.id);
                const sampleStorybook = storybookId ? templateStorybooks.get(storybookId) : null;
                return (
                  <div key={template.id} className="bg-white rounded-xl border border-slate-200 hover:shadow-lg transition-shadow duration-200 flex flex-col">
                    {sampleStorybook && (
                      <div className="p-4 pb-0">
                        <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                          <BookOpen size={12} /><span>样本绘本</span>
                        </div>
                        <StorybookPreview storybook={sampleStorybook as any} className="w-full" popupPosition="center" popupMaxWidth="80vw" popupScale={2.5} />
                      </div>
                    )}
                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex items-start justify-between mb-3 overflow-hidden">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-slate-900 mb-1 truncate">{template.name}</h3>
                          <p className="text-xs text-slate-500">创建于 {new Date(template.created_at).toLocaleDateString('zh-CN')}</p>
                        </div>
                        <Badge variant={template.is_active ? 'success' : 'muted'} className="flex-shrink-0 ml-2">
                          {template.is_active ? '启用' : '停用'}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2 mb-4 min-h-[2.5rem] flex-1">
                        {template.description || '暂无描述'}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(template)} className="flex-1 gap-2">
                          <Edit2 size={16} /><span>编辑</span>
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(template.id, template.name)}
                          className="border-red-200 text-red-600 hover:bg-red-50">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-white text-slate-900 max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 shrink-0">
            <DialogTitle>{editingTemplate ? '编辑模版' : '创建新模版'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
              <div className="space-y-1.5">
                <Label>模版名称 <span className="text-red-500">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="例如：水彩风格童话" required
                />
              </div>

              <div className="space-y-1.5">
                <Label>模版描述</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2} placeholder="简单描述这个模版的用途和特点"
                />
              </div>

              <div className="space-y-1.5">
                <Label>用户指令模板 <span className="text-red-500">*</span></Label>
                <Textarea
                  value={formData.instruction}
                  onChange={(e) => setFormData({ ...formData, instruction: e.target.value })}
                  rows={4} placeholder="定义用户输入的指令格式" required
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label>系统提示词</Label>
                <Textarea
                  value={formData.systemprompt}
                  onChange={(e) => setFormData({ ...formData, systemprompt: e.target.value })}
                  rows={4} placeholder="定义AI生成内容时使用的系统级提示词"
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label>样本绘本</Label>
                <Select
                  value={formData.storybook_id ? String(formData.storybook_id) : ''}
                  onValueChange={(v) => setFormData({ ...formData, storybook_id: v ? parseInt(v) : null })}
                  disabled={loadingStorybooks}
                >
                  <SelectTrigger><SelectValue placeholder="选择一个绘本作为样本（可选）" /></SelectTrigger>
                  <SelectContent>
                    {storybooks.map((sb) => (
                      <SelectItem key={sb.id} value={String(sb.id)}>
                        {sb.title}{sb.description ? ` - ${sb.description}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">选择一个已发布的绘本作为模版的参考样本</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div className="space-y-1.5">
                  <Label>排序顺序</Label>
                  <Input
                    type="number" min={0}
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button type="submit" disabled={submitting} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                {submitting ? <><Loader2 size={16} className="animate-spin" /><span>保存中...</span></> : <><Save size={16} /><span>{editingTemplate ? '保存修改' : '创建模版'}</span></>}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">确定要删除模版「{deleteConfirm?.name}」吗？此操作不可恢复。</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>取消</Button>
            <Button variant="destructive" onClick={confirmDelete}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TemplatesView;
