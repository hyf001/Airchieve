import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, Images, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import LoadingSpinner from '@/components/LoadingSpinner';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toApiUrl } from '@/services/storybookService';
import ImageStyleAssetsView from './ImageStyleAssetsView';
import {
  createImageStyle,
  createImageStyleReferenceImage,
  createImageStyleVersion,
  deleteImageStyleReferenceImage,
  deleteImageStyleVersion,
  ImageStyleAsset,
  ImageStyleListItem,
  ImageStyleVersion,
  listAdminImageStyles,
  listImageStyleAssets,
  listImageStyleVersions,
  publishImageStyleVersion,
  updateImageStyle,
  updateImageStyleReferenceImage,
  updateImageStyleVersion,
} from '@/services/imageStyleService';

interface ImageStylesViewProps {
  onBack?: () => void;
}

interface StyleForm {
  name: string;
  description: string;
  tags: string;
  is_active: boolean;
  sort_order: number;
}

interface VersionForm {
  style_summary: string;
  style_description: string;
  generation_prompt: string;
  negative_prompt: string;
}

const emptyStyleForm: StyleForm = {
  name: '',
  description: '',
  tags: '',
  is_active: true,
  sort_order: 0,
};

const emptyVersionForm: VersionForm = {
  style_summary: '',
  style_description: '',
  generation_prompt: '',
  negative_prompt: '',
};

const splitTags = (value: string): string[] =>
  value.split(/[，,\s]+/).map((item) => item.trim()).filter(Boolean);

const ImageStylesView: React.FC<ImageStylesViewProps> = ({ onBack }) => {
  const { toast } = useToast();
  const [styles, setStyles] = useState<ImageStyleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showStyleDialog, setShowStyleDialog] = useState(false);
  const [editingStyle, setEditingStyle] = useState<ImageStyleListItem | null>(null);
  const [styleForm, setStyleForm] = useState<StyleForm>(emptyStyleForm);

  const [versionStyle, setVersionStyle] = useState<ImageStyleListItem | null>(null);
  const [versions, setVersions] = useState<ImageStyleVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [editingVersion, setEditingVersion] = useState<ImageStyleVersion | null>(null);
  const [versionForm, setVersionForm] = useState<VersionForm>(emptyVersionForm);
  const [assets, setAssets] = useState<ImageStyleAsset[]>([]);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [deleteVersionTarget, setDeleteVersionTarget] = useState<ImageStyleVersion | null>(null);
  const [referenceSortValues, setReferenceSortValues] = useState<Record<number, string>>({});

  const canEditVersion = editingVersion?.status === 'draft';
  const selectedAssetIds = useMemo(
    () => new Set((editingVersion?.reference_images || []).map((image) => image.asset_id).filter(Boolean)),
    [editingVersion]
  );

  const loadStyles = useCallback(async () => {
    try {
      setLoading(true);
      setStyles(await listAdminImageStyles({ limit: 100 }));
    } catch (err) {
      toast({ variant: 'destructive', title: '加载图片风格失败', description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStyles();
  }, [loadStyles]);

  useEffect(() => {
    setReferenceSortValues(
      Object.fromEntries(
        (editingVersion?.reference_images || []).map((image) => [image.id, String(image.sort_order)])
      )
    );
  }, [editingVersion]);

  const loadVersions = useCallback(async (styleId: number) => {
    try {
      setLoadingVersions(true);
      setVersions(await listImageStyleVersions(styleId));
    } catch (err) {
      toast({ variant: 'destructive', title: '加载版本失败', description: err instanceof Error ? err.message : undefined });
    } finally {
      setLoadingVersions(false);
    }
  }, [toast]);

  const openStyleDialog = (style?: ImageStyleListItem) => {
    setEditingStyle(style || null);
    setStyleForm(style ? {
      name: style.name,
      description: style.description || '',
      tags: style.tags.join('，'),
      is_active: style.is_active ?? true,
      sort_order: style.sort_order,
    } : emptyStyleForm);
    setShowStyleDialog(true);
  };

  const handleStyleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!styleForm.name.trim()) {
      toast({ variant: 'destructive', title: '风格名称不能为空' });
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        name: styleForm.name,
        description: styleForm.description || null,
        tags: splitTags(styleForm.tags),
        is_active: styleForm.is_active,
        sort_order: Number(styleForm.sort_order) || 0,
      };
      if (editingStyle) await updateImageStyle(editingStyle.id, payload);
      else await createImageStyle(payload);
      setShowStyleDialog(false);
      await loadStyles();
    } catch (err) {
      toast({ variant: 'destructive', title: '保存风格失败', description: err instanceof Error ? err.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStyle = async (style: ImageStyleListItem, checked: boolean) => {
    try {
      await updateImageStyle(style.id, { is_active: checked });
      await loadStyles();
    } catch (err) {
      toast({ variant: 'destructive', title: '更新状态失败', description: err instanceof Error ? err.message : undefined });
    }
  };

  const openVersionManager = async (style: ImageStyleListItem) => {
    setVersionStyle(style);
    setEditingVersion(null);
    await loadVersions(style.id);
  };

  const createDraft = async () => {
    if (!versionStyle) return;
    try {
      const version = await createImageStyleVersion(versionStyle.id, emptyVersionForm);
      await loadVersions(versionStyle.id);
      openVersionEditor(version);
    } catch (err) {
      toast({ variant: 'destructive', title: '创建草稿失败', description: err instanceof Error ? err.message : undefined });
    }
  };

  const openVersionEditor = (version: ImageStyleVersion) => {
    setEditingVersion(version);
    setVersionForm({
      style_summary: version.style_summary || '',
      style_description: version.style_description || '',
      generation_prompt: version.generation_prompt || '',
      negative_prompt: version.negative_prompt || '',
    });
  };

  const saveVersion = async () => {
    if (!versionStyle || !editingVersion || !canEditVersion) return;
    try {
      setSubmitting(true);
      const updated = await updateImageStyleVersion(versionStyle.id, editingVersion.id, versionForm);
      setEditingVersion(updated);
      await loadVersions(versionStyle.id);
      toast({ title: '草稿已保存' });
    } catch (err) {
      toast({ variant: 'destructive', title: '保存版本失败', description: err instanceof Error ? err.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  const publishVersion = async (version: ImageStyleVersion) => {
    if (!versionStyle) return;
    try {
      const published = await publishImageStyleVersion(versionStyle.id, version.id);
      setEditingVersion(published);
      await loadVersions(versionStyle.id);
      await loadStyles();
      toast({ title: '版本已发布' });
    } catch (err) {
      toast({ variant: 'destructive', title: '发布失败', description: err instanceof Error ? err.message : undefined });
    }
  };

  const loadAssets = async () => {
    try {
      setAssets(await listImageStyleAssets({ is_active: true, limit: 100 }));
      setShowAssetPicker(true);
    } catch (err) {
      toast({ variant: 'destructive', title: '加载图片库失败', description: err instanceof Error ? err.message : undefined });
    }
  };

  const addReferenceImage = async (asset: ImageStyleAsset) => {
    if (!versionStyle || !editingVersion || !canEditVersion || selectedAssetIds.has(asset.id)) return;
    try {
      await createImageStyleReferenceImage(versionStyle.id, editingVersion.id, { asset_id: asset.id });
      const next = await listImageStyleVersions(versionStyle.id);
      setVersions(next);
      setEditingVersion(next.find((item) => item.id === editingVersion.id) || editingVersion);
    } catch (err) {
      toast({ variant: 'destructive', title: '添加参考图失败', description: err instanceof Error ? err.message : undefined });
    }
  };

  const updateReference = async (imageId: number, req: { is_cover?: boolean; sort_order?: number }) => {
    if (!versionStyle || !editingVersion || !canEditVersion) return;
    try {
      await updateImageStyleReferenceImage(versionStyle.id, editingVersion.id, imageId, req);
      const next = await listImageStyleVersions(versionStyle.id);
      setVersions(next);
      setEditingVersion(next.find((item) => item.id === editingVersion.id) || editingVersion);
    } catch (err) {
      toast({ variant: 'destructive', title: '更新参考图失败', description: err instanceof Error ? err.message : undefined });
    }
  };

  const commitReferenceSort = async (imageId: number) => {
    const image = editingVersion?.reference_images.find((item) => item.id === imageId);
    if (!image) return;
    const nextSortOrder = Number(referenceSortValues[imageId]);
    if (!Number.isFinite(nextSortOrder) || nextSortOrder === image.sort_order) {
      setReferenceSortValues((prev) => ({ ...prev, [imageId]: String(image.sort_order) }));
      return;
    }
    await updateReference(imageId, { sort_order: nextSortOrder });
  };

  const deleteReference = async (imageId: number) => {
    if (!versionStyle || !editingVersion || !canEditVersion) return;
    try {
      await deleteImageStyleReferenceImage(versionStyle.id, editingVersion.id, imageId);
      const next = await listImageStyleVersions(versionStyle.id);
      setVersions(next);
      setEditingVersion(next.find((item) => item.id === editingVersion.id) || editingVersion);
    } catch (err) {
      toast({ variant: 'destructive', title: '删除参考图失败', description: err instanceof Error ? err.message : undefined });
    }
  };

  const confirmDeleteVersion = async () => {
    if (!versionStyle || !deleteVersionTarget) return;
    try {
      await deleteImageStyleVersion(versionStyle.id, deleteVersionTarget.id);
      setDeleteVersionTarget(null);
      setEditingVersion(null);
      await loadVersions(versionStyle.id);
    } catch (err) {
      toast({ variant: 'destructive', title: '删除版本失败', description: err instanceof Error ? err.message : undefined });
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack} className="gap-2 text-slate-600">
              <ArrowLeft size={20} /> 返回
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">图片风格管理</h1>
              <p className="text-sm text-slate-500 mt-0.5">创建风格、维护草稿版本并发布生效版本</p>
            </div>
          </div>
          <Button onClick={() => openStyleDialog()} className="gap-2 bg-cyan-600 hover:bg-cyan-700">
            <Plus size={18} /> 创建风格
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          <section>
              {loading ? (
                <LoadingSpinner size={40} color="text-cyan-600" className="py-20" />
              ) : styles.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-lg py-16 text-center">
                  <p className="text-slate-700 font-medium">还没有图片风格</p>
                  <p className="text-sm text-slate-500 mt-1">创建第一个风格后，再进入版本管理添加参考图。</p>
                  <Button onClick={() => openStyleDialog()} className="mt-4 gap-2 bg-cyan-600 hover:bg-cyan-700">
                    <Plus size={16} /> 创建风格
                  </Button>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[88px_1fr_140px_120px_130px_220px] gap-4 px-4 py-3 text-xs font-semibold text-slate-500 bg-slate-100">
                <span>封面</span><span>风格</span><span>当前版本</span><span>状态</span><span>更新时间</span><span>操作</span>
              </div>
              {styles.map((style) => (
                <div key={style.id} className="grid grid-cols-[88px_1fr_140px_120px_130px_220px] gap-4 px-4 py-4 border-t border-slate-100 items-center">
                  <div className="w-16 h-16 bg-slate-100 rounded-md overflow-hidden">
                    {style.cover_image && <img src={toApiUrl(style.cover_image)} alt={style.name} className="w-full h-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{style.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-1">{style.description || '暂无描述'}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {style.tags.slice(0, 5).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                    </div>
                  </div>
                  <Badge variant={style.current_version_no ? 'info' : 'warning'}>{style.current_version_no || '未发布'}</Badge>
                  <div className="flex items-center gap-2">
                    <Switch checked={style.is_active ?? true} onCheckedChange={(checked) => handleToggleStyle(style, checked)} />
                    <span className="text-xs text-slate-500">{style.is_active ? '启用' : '停用'}</span>
                  </div>
                  <span className="text-sm text-slate-500">{style.updated_at ? new Date(style.updated_at).toLocaleDateString('zh-CN') : '-'}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openStyleDialog(style)}><Pencil size={16} /> 编辑</Button>
                    <Button size="sm" variant="outline" onClick={() => openVersionManager(style)}><Images size={16} /> 版本</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          </section>
          <ImageStyleAssetsView embedded />
        </div>
      </main>

      <Dialog open={showStyleDialog} onOpenChange={setShowStyleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingStyle ? '编辑风格' : '创建风格'}</DialogTitle></DialogHeader>
          <form onSubmit={handleStyleSubmit} className="space-y-4">
            <div><Label>名称</Label><Input value={styleForm.name} onChange={(event) => setStyleForm((prev) => ({ ...prev, name: event.target.value }))} /></div>
            <div><Label>描述</Label><Textarea value={styleForm.description} onChange={(event) => setStyleForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} /></div>
            <div><Label>标签</Label><Input value={styleForm.tags} onChange={(event) => setStyleForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder="水彩，温暖，睡前故事" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>排序</Label><Input type="number" value={styleForm.sort_order} onChange={(event) => setStyleForm((prev) => ({ ...prev, sort_order: Number(event.target.value) }))} /></div>
              <div className="flex items-end gap-3 pb-2"><Switch checked={styleForm.is_active} onCheckedChange={(checked) => setStyleForm((prev) => ({ ...prev, is_active: checked }))} /><span className="text-sm text-slate-600">启用</span></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowStyleDialog(false)}>取消</Button>
              <Button type="submit" disabled={submitting}>{submitting && <Loader2 size={16} className="mr-2 animate-spin" />}保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!versionStyle} onOpenChange={(open) => { if (!open) { setVersionStyle(null); setEditingVersion(null); } }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>{versionStyle?.name} · 版本管理</DialogTitle></DialogHeader>
          {!editingVersion ? (
            <div className="space-y-4 overflow-auto">
              <div className="flex justify-end"><Button onClick={createDraft} className="gap-2"><Plus size={16} /> 创建草稿</Button></div>
              {loadingVersions ? <LoadingSpinner size={32} /> : versions.map((version) => (
                <div key={version.id} className="border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{version.version_no}</h3>
                      <Badge variant={version.status === 'published' ? 'success' : 'warning'}>{version.status === 'published' ? '已发布' : '草稿'}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">{version.style_summary || '暂无摘要'}</p>
                    <p className="text-xs text-slate-400 mt-1">{version.reference_images.length} 张参考图</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => openVersionEditor(version)}>{version.status === 'draft' ? <Pencil size={16} /> : <Eye size={16} />}{version.status === 'draft' ? '编辑' : '查看'}</Button>
                    {version.status === 'draft' && <Button variant="outline" onClick={() => publishVersion(version)}>发布</Button>}
                    {version.status === 'draft' && <Button variant="ghost" className="text-red-600" onClick={() => setDeleteVersionTarget(version)}><Trash2 size={16} /></Button>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-auto space-y-5 pr-1">
              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setEditingVersion(null)}>返回版本列表</Button>
                <Badge variant={editingVersion.status === 'published' ? 'success' : 'warning'}>{editingVersion.status === 'published' ? '已发布只读' : '草稿可编辑'}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>画风摘要</Label><Textarea disabled={!canEditVersion} value={versionForm.style_summary} onChange={(event) => setVersionForm((prev) => ({ ...prev, style_summary: event.target.value }))} rows={4} /></div>
                <div><Label>风格描述</Label><Textarea disabled={!canEditVersion} value={versionForm.style_description} onChange={(event) => setVersionForm((prev) => ({ ...prev, style_description: event.target.value }))} rows={4} /></div>
                <div><Label>生成提示词</Label><Textarea disabled={!canEditVersion} value={versionForm.generation_prompt} onChange={(event) => setVersionForm((prev) => ({ ...prev, generation_prompt: event.target.value }))} rows={4} /></div>
                <div><Label>负面提示词</Label><Textarea disabled={!canEditVersion} value={versionForm.negative_prompt} onChange={(event) => setVersionForm((prev) => ({ ...prev, negative_prompt: event.target.value }))} rows={4} /></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-slate-900">参考图</h3>
                  {canEditVersion && <Button variant="outline" onClick={loadAssets}><Images size={16} /> 选择参考图</Button>}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {editingVersion.reference_images.map((image) => (
                    <div key={image.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <div className="aspect-[4/3] bg-slate-100"><img src={toApiUrl(image.url)} alt="" className="w-full h-full object-cover" /></div>
                      <div className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant={image.is_cover ? 'success' : 'muted'}>{image.is_cover ? '封面' : '参考'}</Badge>
                          {canEditVersion && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteReference(image.id)}><Trash2 size={14} /></Button>}
                        </div>
                        <Input
                          disabled={!canEditVersion}
                          type="number"
                          value={referenceSortValues[image.id] ?? String(image.sort_order)}
                          onChange={(event) => setReferenceSortValues((prev) => ({ ...prev, [image.id]: event.target.value }))}
                          onBlur={() => commitReferenceSort(image.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur();
                            }
                          }}
                        />
                        {canEditVersion && !image.is_cover && <Button size="sm" variant="outline" className="w-full" onClick={() => updateReference(image.id, { is_cover: true })}>设为封面</Button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                {canEditVersion && <Button onClick={saveVersion} disabled={submitting}>{submitting && <Loader2 size={16} className="mr-2 animate-spin" />}保存草稿</Button>}
                {canEditVersion && <Button variant="outline" onClick={() => publishVersion(editingVersion)}>发布版本</Button>}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showAssetPicker} onOpenChange={setShowAssetPicker}>
        <DialogContent className="max-w-5xl max-h-[84vh] overflow-auto">
          <DialogHeader><DialogTitle>选择参考图</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                disabled={selectedAssetIds.has(asset.id)}
                onClick={() => addReferenceImage(asset)}
                className="text-left border border-slate-200 rounded-lg overflow-hidden disabled:opacity-45 hover:border-cyan-400"
              >
                <div className="aspect-[4/3] bg-slate-100"><img src={toApiUrl(asset.url)} alt={asset.name} className="w-full h-full object-cover" /></div>
                <div className="p-2"><p className="text-sm font-medium text-slate-900 truncate">{asset.name}</p></div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteVersionTarget}
        title="删除草稿版本"
        description={`确认删除 ${deleteVersionTarget?.version_no || ''}？参考图引用会一并删除，图片库资产会保留。`}
        confirmText="删除"
        cancelText="取消"
        variant="destructive"
        onConfirm={confirmDeleteVersion}
        onCancel={() => setDeleteVersionTarget(null)}
      />
    </div>
  );
};

export default ImageStylesView;
