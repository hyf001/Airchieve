import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ImagePlus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toApiUrl } from '@/services/storybookService';
import {
  deleteImageStyleAsset,
  ImageStyleAsset,
  ImageStyleAssetMetadata,
  listImageStyleAssets,
  updateImageStyleAsset,
  uploadImageStyleAsset,
} from '@/services/imageStyleService';

interface ImageStyleAssetsViewProps {
  onBack?: () => void;
  embedded?: boolean;
}

const STYLE_TYPES = ['水彩', '卡通', '涂鸦', '彩铅', '国风', '奇幻'];
const TAG_PRESETS = ['低饱和', '明亮', '暖色', '冷色', '柔和', '纸纹', '蜡笔', '森林', '室内', '儿童', '动物', '低幼', '亲子'];

const emptyForm: ImageStyleAssetMetadata = {
  name: '',
  description: '',
  tags: [],
  style_type: null,
};

const splitTags = (value: string): string[] =>
  value.split(/[，,\s]+/).map((item) => item.trim()).filter(Boolean);

const formatSize = (bytes: number): string => {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
};

const ImageStyleAssetsView: React.FC<ImageStyleAssetsViewProps> = ({ onBack, embedded = false }) => {
  const { toast } = useToast();
  const [assets, setAssets] = useState<ImageStyleAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterActive, setFilterActive] = useState<string>('all');
  const [filterStyleType, setFilterStyleType] = useState<string>('all');
  const [filterTag, setFilterTag] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<ImageStyleAssetMetadata>(emptyForm);
  const [editingAsset, setEditingAsset] = useState<ImageStyleAsset | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImageStyleAsset | null>(null);

  const tagText = useMemo(() => (form.tags || []).join('，'), [form.tags]);

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listImageStyleAssets({
        is_active: filterActive === 'all' ? undefined : filterActive === 'active',
        style_type: filterStyleType === 'all' ? undefined : filterStyleType,
        tag: filterTag.trim() || undefined,
        limit: 100,
      });
      setAssets(data);
    } catch (err) {
      toast({ variant: 'destructive', title: '加载图片库失败', description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [filterActive, filterStyleType, filterTag, toast]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const openCreate = () => {
    setEditingAsset(null);
    setForm(emptyForm);
    setFile(null);
    setShowDialog(true);
  };

  const openEdit = (asset: ImageStyleAsset) => {
    setEditingAsset(asset);
    setForm({
      name: asset.name,
      description: asset.description || '',
      tags: asset.tags,
      style_type: asset.style_type,
    });
    setFile(null);
    setShowDialog(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingAsset && !file) {
      toast({ variant: 'destructive', title: '请选择图片文件' });
      return;
    }
    try {
      setSubmitting(true);
      if (editingAsset) {
        await updateImageStyleAsset(editingAsset.id, form);
      } else if (file) {
        await uploadImageStyleAsset(file, { ...form, name: form.name || file.name });
      }
      setShowDialog(false);
      await loadAssets();
    } catch (err) {
      toast({ variant: 'destructive', title: '保存图片资产失败', description: err instanceof Error ? err.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (asset: ImageStyleAsset, checked: boolean) => {
    try {
      await updateImageStyleAsset(asset.id, { is_active: checked });
      await loadAssets();
    } catch (err) {
      toast({ variant: 'destructive', title: '更新状态失败', description: err instanceof Error ? err.message : undefined });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteImageStyleAsset(deleteTarget.id);
      setDeleteTarget(null);
      await loadAssets();
    } catch (err) {
      toast({ variant: 'destructive', title: deleteTarget.reference_count > 0 ? '资产已被引用，请下架' : '删除失败', description: err instanceof Error ? err.message : undefined });
    }
  };

  const content = (
    <>
      {!embedded && (
        <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack} className="gap-2 text-slate-600">
              <ArrowLeft size={20} /> 返回
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">风格图片库</h1>
              <p className="text-sm text-slate-500 mt-0.5">管理可复用的画风参考图资产</p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
            <ImagePlus size={18} /> 上传图片
          </Button>
        </div>
        </header>
      )}

      <main className={embedded ? '' : 'flex-1 overflow-auto'}>
        <div className={embedded ? 'space-y-5' : 'max-w-7xl mx-auto px-6 py-6 space-y-5'}>
          {embedded && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">风格图片库</h2>
                <p className="text-sm text-slate-600 mt-0.5">管理可复用的画风参考图资产</p>
              </div>
              <Button onClick={openCreate} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
                <ImagePlus size={18} /> 上传图片
              </Button>
            </div>
          )}
          <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-end gap-3">
            <div className="w-40">
              <Label>状态</Label>
              <Select value={filterActive} onValueChange={setFilterActive}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="inactive">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label>风格类型</Label>
              <Select value={filterStyleType} onValueChange={setFilterStyleType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {STYLE_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-64">
              <Label>标签</Label>
              <Input value={filterTag} onChange={(e) => setFilterTag(e.target.value)} placeholder="输入标签筛选" />
            </div>
            <Button variant="outline" onClick={loadAssets}>刷新</Button>
          </div>

          {loading ? (
            <LoadingSpinner size={40} color="text-cyan-600" className="py-20" />
          ) : assets.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg py-16 text-center">
              <p className="text-slate-700 font-medium">还没有图片资产</p>
              <p className="text-sm text-slate-500 mt-1">上传第一张参考图后，就可以在风格版本里复用它。</p>
              <Button onClick={openCreate} className="mt-4 gap-2 bg-cyan-600 hover:bg-cyan-700">
                <ImagePlus size={16} /> 上传图片
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {assets.map((asset) => (
                <div key={asset.id} className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                  <div className="aspect-[4/3] bg-slate-100">
                    <img src={toApiUrl(asset.url)} alt={asset.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-4 space-y-3 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 truncate">{asset.name}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ''}{formatSize(asset.file_size)}
                        </p>
                      </div>
                      <Badge variant={asset.reference_count > 0 ? 'info' : 'muted'}>{asset.reference_count} 引用</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 min-h-6">
                      {asset.style_type && <Badge variant="secondary">{asset.style_type}</Badge>}
                      {asset.tags.slice(0, 4).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <Switch checked={asset.is_active} onCheckedChange={(checked) => handleToggleActive(asset, checked)} />
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(asset)}><Pencil size={16} /></Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleteTarget(asset)}><Trash2 size={16} /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editingAsset ? '编辑图片资产' : '上传图片资产'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingAsset && (
              <div>
                <Label>图片文件</Label>
                <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              </div>
            )}
            <div>
              <Label>名称</Label>
              <Input value={form.name || ''} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div>
              <Label>描述</Label>
              <Textarea value={form.description || ''} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} />
            </div>
            <div>
              <Label>风格类型</Label>
              <Select value={form.style_type || 'none'} onValueChange={(value) => setForm((prev) => ({ ...prev, style_type: value === 'none' ? null : value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">未设置</SelectItem>
                  {STYLE_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>标签</Label>
              <Input value={tagText} onChange={(event) => setForm((prev) => ({ ...prev, tags: splitTags(event.target.value) }))} placeholder="用逗号或空格分隔" />
              <div className="flex flex-wrap gap-1 mt-2">
                {TAG_PRESETS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, tags: Array.from(new Set([...(prev.tags || []), tag])) }))}
                    className="text-xs rounded-md border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-100"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>取消</Button>
              <Button type="submit" disabled={submitting}>{submitting && <Loader2 size={16} className="mr-2 animate-spin" />}保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除图片资产"
        description={deleteTarget?.reference_count ? '该资产已被版本引用，后端会阻止物理删除。请改为下架。' : `确认删除「${deleteTarget?.name}」？`}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );

  if (embedded) {
    return <section className="bg-white border border-slate-200 rounded-lg p-5">{content}</section>;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      {content}
    </div>
  );
};

export default ImageStyleAssetsView;
