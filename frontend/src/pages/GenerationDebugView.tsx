import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Beaker, ImageIcon, PanelLeftClose, PanelLeftOpen, Play, Plus, Save, Search, Sparkles, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { toApiUrl } from '@/services/storybookService';
import { uploadImageStyleAsset } from '@/services/imageStyleService';
import {
  createDebugRun,
  getDebugPageContext,
  GenerationDebugInputResource,
  GenerationDebugPageItem,
  GenerationDebugPromptPreview,
  GenerationDebugRun,
  GenerationDebugStoryboard,
  GenerationDebugStorybookItem,
  GenerationDebugVisualAnchor,
  listDebugPages,
  listDebugRuns,
  PageGenerationDebugParams,
  previewDebugPrompt,
  searchDebugStorybooks,
  updateDebugRun,
} from '@/services/generationDebugService';

interface Props {
  onBack: () => void;
}

const splitLines = (value: string): string[] =>
  value.split('\n').map((item) => item.trim()).filter(Boolean);

const joinLines = (value: string[]): string => value.join('\n');

const parseAnchorJson = (value: string): GenerationDebugVisualAnchor[] => {
  const parsed = JSON.parse(value) as GenerationDebugVisualAnchor[];
  if (!Array.isArray(parsed)) throw new Error('视觉锚点必须是数组 JSON');
  return parsed;
};

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-medium text-slate-300">{label}</Label>
    {children}
  </div>
);

const debugInputClassName = "bg-slate-900/80 border-white/15 text-slate-100 placeholder:text-slate-500 caret-teal-300 selection:bg-teal-400/30 focus-visible:border-teal-400/70 focus-visible:ring-teal-400/40";
const debugTextareaClassName = `${debugInputClassName} leading-relaxed`;
const debugSelectTriggerClassName = "bg-slate-900/80 border-white/15 text-slate-100 focus:ring-teal-400/40 [&_svg]:text-slate-300 [&_svg]:opacity-100";
const debugButtonToneClassName = "border-teal-300/60 bg-teal-400/10 text-teal-50 hover:bg-teal-400/20 hover:text-white disabled:border-slate-500/40 disabled:bg-slate-800/80 disabled:text-slate-300 disabled:opacity-100";
const debugActionButtonClassName = `flex-1 ${debugButtonToneClassName}`;

const getStatusBadgeClassName = (status: string): string => {
  const normalized = status.toLowerCase();
  if (normalized === 'finished') return 'border-emerald-300/50 bg-emerald-400/15 text-emerald-100';
  if (normalized === 'error' || normalized === 'failed') return 'border-red-300/50 bg-red-400/15 text-red-100';
  if (normalized === 'running' || normalized === 'processing') return 'border-sky-300/50 bg-sky-400/15 text-sky-100';
  return 'border-slate-300/40 bg-slate-300/10 text-slate-100';
};

const ImageResourceCard: React.FC<{ resource: GenerationDebugInputResource }> = ({ resource }) => (
  <div className="overflow-hidden rounded-md border border-white/10 bg-slate-900/70">
    <div className="aspect-video bg-slate-950">
      <img
        src={toApiUrl(resource.url)}
        alt={resource.role}
        className="h-full w-full object-cover"
      />
    </div>
    <div className="space-y-0.5 px-2 py-1.5">
      <div className="truncate text-xs font-medium text-teal-200">{resource.sort_order + 1}. {resource.role}</div>
      {resource.note && <div className="truncate text-[11px] text-slate-400">{resource.note}</div>}
    </div>
  </div>
);

const uploadReferenceFiles = async (files: FileList | null): Promise<string[]> => {
  if (!files) return [];
  const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
  const assets = await Promise.all(
    imageFiles.map((file) => uploadImageStyleAsset(file, { name: file.name })),
  );
  return assets.map((asset) => asset.url);
};

interface ReferenceImagesFieldProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
}

const ReferenceImagesField: React.FC<ReferenceImagesFieldProps> = ({ label, value, onChange }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploading(true);
    try {
      const urls = await uploadReferenceFiles(event.target.files);
      if (urls.length > 0) onChange([...value, ...urls]);
    } catch (error) {
      toast({ variant: 'destructive', title: '上传失败', description: error instanceof Error ? error.message : '请换张图片重试' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }, [onChange, toast, value]);

  const handleAddUrl = useCallback(() => {
    const nextUrl = urlInput.trim();
    if (!nextUrl) return;
    onChange([...value, nextUrl]);
    setUrlInput('');
  }, [onChange, urlInput, value]);

  const handleRemove = useCallback((index: number) => {
    onChange(value.filter((_, itemIndex) => itemIndex !== index));
  }, [onChange, value]);

  return (
    <FormField label={label}>
      <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-2">
        {value.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {value.map((url, index) => (
              <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-md border border-white/10 bg-slate-950">
                <div className="aspect-video">
                  <img src={toApiUrl(url)} alt={`${label} ${index + 1}`} className="h-full w-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-slate-950/80 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-white/10 bg-slate-950/50 text-xs text-slate-400">
            暂无图片
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="粘贴图片 URL"
            className={debugInputClassName}
          />
          <Button type="button" variant="outline" size="icon" onClick={handleAddUrl} className={debugButtonToneClassName}>
            <Plus size={14} />
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`w-full ${debugButtonToneClassName}`}
        >
          <Upload size={14} /> {uploading ? '上传中' : '上传图片'}
        </Button>
      </div>
    </FormField>
  );
};

interface SingleReferenceImageFieldProps {
  label: string;
  description: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

const SingleReferenceImageField: React.FC<SingleReferenceImageFieldProps> = ({ label, description, value, onChange }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [urlInput, setUrlInput] = useState(value ?? '');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setUrlInput(value ?? '');
  }, [value]);

  const handleUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploading(true);
    try {
      const urls = await uploadReferenceFiles(event.target.files);
      if (urls[0]) onChange(urls[0]);
    } catch (error) {
      toast({ variant: 'destructive', title: '上传失败', description: error instanceof Error ? error.message : '请换张图片重试' });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }, [onChange, toast]);

  const handleApplyUrl = useCallback(() => {
    onChange(urlInput.trim() || null);
  }, [onChange, urlInput]);

  return (
    <FormField label={label}>
      <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-2">
        {value ? (
          <div className="group relative overflow-hidden rounded-md border border-white/10 bg-slate-950">
            <div className="aspect-video">
              <img src={toApiUrl(value)} alt={label} className="h-full w-full object-cover" />
            </div>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-slate-950/80 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-white/10 bg-slate-950/50 text-xs text-slate-400">
            使用默认上一页图片
          </div>
        )}
        <p className="text-xs leading-relaxed text-slate-400">{description}</p>
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="粘贴替代图 URL"
            className={debugInputClassName}
          />
          <Button type="button" variant="outline" size="icon" onClick={handleApplyUrl} className={debugButtonToneClassName}>
            <Plus size={14} />
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`w-full ${debugButtonToneClassName}`}
        >
          <Upload size={14} /> {uploading ? '上传中' : '上传替代图'}
        </Button>
      </div>
    </FormField>
  );
};

const GenerationDebugView: React.FC<Props> = ({ onBack }) => {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState('');
  const [storybooks, setStorybooks] = useState<GenerationDebugStorybookItem[]>([]);
  const [pages, setPages] = useState<GenerationDebugPageItem[]>([]);
  const [selectedStorybookId, setSelectedStorybookId] = useState<number | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [params, setParams] = useState<PageGenerationDebugParams | null>(null);
  const [officialImage, setOfficialImage] = useState('');
  const [preview, setPreview] = useState<GenerationDebugPromptPreview | null>(null);
  const [runs, setRuns] = useState<GenerationDebugRun[]>([]);
  const [anchorJson, setAnchorJson] = useState('[]');
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState(false);
  const [savingRunId, setSavingRunId] = useState<number | null>(null);
  const [storybookListCollapsed, setStorybookListCollapsed] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [resultDialogRun, setResultDialogRun] = useState<GenerationDebugRun | null>(null);

  const loadStorybooks = useCallback(async () => {
    try {
      setStorybooks(await searchDebugStorybooks(keyword));
    } catch (error) {
      toast({ variant: 'destructive', title: '加载失败', description: error instanceof Error ? error.message : '无法搜索绘本' });
    }
  }, [keyword, toast]);

  useEffect(() => {
    void loadStorybooks();
  }, []);

  const syncParams = useCallback((next: PageGenerationDebugParams) => {
    setParams(next);
    setAnchorJson(JSON.stringify(next.visual_anchors, null, 2));
  }, []);

  const selectStorybook = useCallback(async (storybookId: number) => {
    setSelectedStorybookId(storybookId);
    setSelectedPageId(null);
    setParams(null);
    setPreview(null);
    setRuns([]);
    setPages(await listDebugPages(storybookId));
  }, []);

  const selectPage = useCallback(async (pageId: number) => {
    setLoading(true);
    try {
      const context = await getDebugPageContext(pageId);
      setSelectedPageId(pageId);
      syncParams(context.debug_params);
      setOfficialImage(context.display_context.image_url);
      setPreview(null);
      setRuns(await listDebugRuns(pageId));
    } catch (error) {
      toast({ variant: 'destructive', title: '加载页面失败', description: error instanceof Error ? error.message : '无法加载页面上下文' });
    } finally {
      setLoading(false);
    }
  }, [syncParams, toast]);

  const updateParams = (patch: Partial<PageGenerationDebugParams>) => {
    setParams((prev) => prev ? { ...prev, ...patch } : prev);
  };

  const updateStoryboard = (patch: Partial<GenerationDebugStoryboard>) => {
    setParams((prev) => {
      if (!prev) return prev;
      const storyboard = prev.storyboard ?? {
        summary: '',
        visual_brief: '',
        anchor_refs: [],
        must_include: [],
        composition: '',
        avoid: [],
      };
      return { ...prev, storyboard: { ...storyboard, ...patch } };
    });
  };

  const paramsForSubmit = useCallback((): PageGenerationDebugParams | null => {
    if (!params) return null;
    try {
      return { ...params, visual_anchors: parseAnchorJson(anchorJson) };
    } catch (error) {
      toast({ variant: 'destructive', title: '视觉锚点格式错误', description: error instanceof Error ? error.message : '请检查 JSON' });
      return null;
    }
  }, [anchorJson, params, toast]);

  const handlePreview = useCallback(async () => {
    if (!selectedPageId) return;
    const nextParams = paramsForSubmit();
    if (!nextParams) return;
    syncParams(nextParams);
    setPreviewing(true);
    try {
      setPreview(await previewDebugPrompt(selectedPageId, nextParams));
      setPreviewDialogOpen(true);
    } catch (error) {
      toast({ variant: 'destructive', title: '预览失败', description: error instanceof Error ? error.message : '请重试' });
    } finally {
      setPreviewing(false);
    }
  }, [paramsForSubmit, selectedPageId, syncParams, toast]);

  const handleRun = useCallback(async () => {
    if (!selectedPageId) return;
    const nextParams = paramsForSubmit();
    if (!nextParams) return;
    syncParams(nextParams);
    setRunning(true);
    try {
      const run = await createDebugRun(selectedPageId, nextParams);
      setRuns((prev) => [run, ...prev]);
      setResultDialogRun(run);
      if (run.status === 'error') {
        toast({ variant: 'destructive', title: '生成失败', description: run.error_message || '模型生成失败' });
      }
    } finally {
      setRunning(false);
    }
  }, [paramsForSubmit, selectedPageId, syncParams, toast]);

  const handleRunPatch = useCallback((runId: number, patch: Partial<GenerationDebugRun>) => {
    setRuns((prev) => prev.map((run) => run.id === runId ? { ...run, ...patch } : run));
  }, []);

  const handleSaveRun = useCallback(async (run: GenerationDebugRun) => {
    setSavingRunId(run.id);
    try {
      const updated = await updateDebugRun(run.id, {
        rating: run.rating,
        tags: run.tags,
        notes: run.notes,
      });
      setRuns((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      toast({ title: '调试记录已保存' });
    } catch (error) {
      toast({ variant: 'destructive', title: '保存失败', description: error instanceof Error ? error.message : '请重试' });
    } finally {
      setSavingRunId(null);
    }
  }, [toast]);

  return (
    <div className="h-screen bg-[#061428] text-slate-100 flex flex-col overflow-hidden">
      <header className="h-14 border-b border-white/10 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft size={18} /></Button>
          <div className="flex items-center gap-2 font-semibold"><Beaker size={18} className="text-teal-300" /> 生成调试</div>
        </div>
        <div className="flex items-center gap-2">
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索绘本" className={`w-56 ${debugInputClassName}`} />
          <Button variant="outline" size="icon" onClick={loadStorybooks} className={debugButtonToneClassName}><Search size={16} /></Button>
        </div>
      </header>

      <main className={`min-h-0 flex-1 grid ${storybookListCollapsed ? 'grid-cols-[52px_260px_minmax(0,1fr)]' : 'grid-cols-[280px_260px_minmax(0,1fr)]'} overflow-hidden transition-[grid-template-columns] duration-200`}>
        <aside className={`border-r border-white/10 overflow-auto ${storybookListCollapsed ? 'p-2' : 'p-3'} space-y-2`}>
          <div className={`flex items-center ${storybookListCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
            {!storybookListCollapsed && <div className="text-sm font-medium text-slate-200">绘本列表</div>}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setStorybookListCollapsed((prev) => !prev)}
              className={debugButtonToneClassName}
              title={storybookListCollapsed ? '展开绘本列表' : '收起绘本列表'}
            >
              {storybookListCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </Button>
          </div>
          {!storybookListCollapsed && storybooks.map((item) => (
              <button
                key={item.id}
                onClick={() => void selectStorybook(item.id)}
                className={`w-full text-left p-3 rounded-md border ${selectedStorybookId === item.id ? 'border-teal-400 bg-teal-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
              >
                <div className="font-medium truncate">{item.title}</div>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                  <Badge variant="outline" className={getStatusBadgeClassName(item.status)}>{item.status}</Badge>
                  <span className="text-slate-300">{item.page_count} 页</span>
                  <span className="text-slate-300">{item.cli_type}</span>
                </div>
              </button>
            ))}
        </aside>

        <aside className="border-r border-white/10 overflow-auto p-3 space-y-2">
          {pages.map((page) => (
            <button
              key={page.id}
              onClick={() => void selectPage(page.id)}
              className={`w-full text-left p-2 rounded-md border ${selectedPageId === page.id ? 'border-teal-400 bg-teal-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
            >
              <div className="flex gap-2">
                {page.image_url ? <img src={toApiUrl(page.image_url)} className="w-16 h-10 object-cover rounded" /> : <div className="w-16 h-10 bg-slate-800 rounded flex items-center justify-center"><ImageIcon size={16} /></div>}
                <div className="min-w-0">
                  <div className="text-sm">正文 {page.content_page_index + 1}</div>
                  <div className="text-xs text-slate-400 truncate">{page.text}</div>
                </div>
              </div>
            </button>
          ))}
        </aside>

        <section className="overflow-auto p-4">
          {!params || loading ? (
            <div className="h-full flex items-center justify-center text-slate-400">选择一个正文页开始调试</div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-2">正式图</div>
                    {officialImage && <img src={toApiUrl(officialImage)} className="w-full rounded-md border border-white/10" />}
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-2">调试结果</div>
                    {runs[0]?.output_image_url ? (
                      <button
                        type="button"
                        onClick={() => setResultDialogRun(runs[0])}
                        className="group relative block w-full overflow-hidden rounded-md border border-white/10 bg-slate-950"
                      >
                        <img src={toApiUrl(runs[0].output_image_url)} className="w-full object-cover opacity-80 transition-opacity group-hover:opacity-100" />
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/40 text-sm font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                          查看调试结果
                        </div>
                      </button>
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-white/10 bg-white/5 text-sm text-slate-400">
                        生成后弹窗查看结果
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <FormField label="模型">
                    <Select value={params.cli_type} onValueChange={(value) => updateParams({ cli_type: value })}>
                      <SelectTrigger className={debugSelectTriggerClassName}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="gemini">Gemini</SelectItem><SelectItem value="doubao">豆包</SelectItem></SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="图片比例">
                    <Select value={params.aspect_ratio} onValueChange={(value) => updateParams({ aspect_ratio: value })}>
                      <SelectTrigger className={debugSelectTriggerClassName}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="16:9">16:9</SelectItem><SelectItem value="4:3">4:3</SelectItem><SelectItem value="1:1">1:1</SelectItem></SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="尺寸">
                    <Select value={params.image_size} onValueChange={(value) => updateParams({ image_size: value })}>
                      <SelectTrigger className={debugSelectTriggerClassName}><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="1k">1k</SelectItem><SelectItem value="2k">2k</SelectItem><SelectItem value="4k">4k</SelectItem></SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="画风名">
                    <Input value={params.style_name} onChange={(e) => updateParams({ style_name: e.target.value })} className={debugInputClassName} />
                  </FormField>
                </div>

                <div className="space-y-3">
                  <FormField label="当前页文本">
                    <Textarea value={params.story_text} onChange={(e) => updateParams({ story_text: e.target.value })} className={`min-h-24 ${debugTextareaClassName}`} />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="故事上下文，每行一页">
                      <Textarea value={joinLines(params.story_context)} onChange={(e) => updateParams({ story_context: splitLines(e.target.value) })} className={`min-h-32 ${debugTextareaClassName}`} />
                    </FormField>
                    <FormField label="图片调整指令">
                      <Textarea value={params.image_instruction} onChange={(e) => updateParams({ image_instruction: e.target.value })} className={`min-h-32 ${debugTextareaClassName}`} />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="分镜摘要">
                      <Textarea value={params.storyboard?.summary ?? ''} onChange={(e) => updateStoryboard({ summary: e.target.value })} className={`min-h-20 ${debugTextareaClassName}`} />
                    </FormField>
                    <FormField label="画面目标">
                      <Textarea value={params.storyboard?.visual_brief ?? ''} onChange={(e) => updateStoryboard({ visual_brief: e.target.value })} className={`min-h-20 ${debugTextareaClassName}`} />
                    </FormField>
                    <FormField label="必须出现，每行一个">
                      <Textarea value={joinLines(params.storyboard?.must_include ?? [])} onChange={(e) => updateStoryboard({ must_include: splitLines(e.target.value) })} className={`min-h-20 ${debugTextareaClassName}`} />
                    </FormField>
                    <FormField label="避免出现，每行一个">
                      <Textarea value={joinLines(params.storyboard?.avoid ?? [])} onChange={(e) => updateStoryboard({ avoid: splitLines(e.target.value) })} className={`min-h-20 ${debugTextareaClassName}`} />
                    </FormField>
                    <FormField label="锚点 ID，每行一个">
                      <Textarea value={joinLines(params.storyboard?.anchor_refs ?? [])} onChange={(e) => updateStoryboard({ anchor_refs: splitLines(e.target.value) })} className={`min-h-20 ${debugTextareaClassName}`} />
                    </FormField>
                    <FormField label="构图">
                      <Textarea value={params.storyboard?.composition ?? ''} onChange={(e) => updateStoryboard({ composition: e.target.value })} className={`min-h-20 ${debugTextareaClassName}`} />
                    </FormField>
                  </div>
                  <FormField label="视觉锚点 JSON">
                    <Textarea value={anchorJson} onChange={(e) => setAnchorJson(e.target.value)} className={`min-h-32 font-mono text-xs ${debugTextareaClassName}`} />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="画风正向 prompt">
                      <Textarea value={params.style_generation_prompt} onChange={(e) => updateParams({ style_generation_prompt: e.target.value })} className={`min-h-28 ${debugTextareaClassName}`} />
                    </FormField>
                    <FormField label="画风负向 prompt">
                      <Textarea value={params.style_negative_prompt} onChange={(e) => updateParams({ style_negative_prompt: e.target.value })} className={`min-h-28 ${debugTextareaClassName}`} />
                    </FormField>
                    <ReferenceImagesField
                      label="画风参考图"
                      value={params.style_reference_images}
                      onChange={(value) => updateParams({ style_reference_images: value })}
                    />
                    <ReferenceImagesField
                      label="角色参考图"
                      value={params.character_reference_images}
                      onChange={(value) => updateParams({ character_reference_images: value })}
                    />
                    <SingleReferenceImageField
                      label="上一页替代图"
                      description="覆盖默认上一正文页图片，作为当前页的连续性参考；留空则使用系统自动选择的上一页图。"
                      value={params.previous_page_image}
                      onChange={(value) => updateParams({ previous_page_image: value })}
                    />
                    <ReferenceImagesField
                      label="页面参考图"
                      value={params.selected_reference_page_images}
                      onChange={(value) => updateParams({ selected_reference_page_images: value })}
                    />
                  </div>
                </div>
                <div className="rounded-md border border-white/10 bg-white/5 p-3">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handlePreview}
                      disabled={previewing}
                      className={debugActionButtonClassName}
                    >
                      <Sparkles size={16} /> {previewing ? '预览中' : '预览 Prompt'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRun}
                      disabled={running}
                      className={debugActionButtonClassName}
                    >
                      <Play size={16} /> 生成调试图
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">预览 Prompt 和生成结果会通过弹窗展示。</div>
                </div>
              </div>

              {runs.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-200">调试记录</div>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
                  {runs.map((run) => (
                    <div key={run.id} className="rounded-md border border-white/10 bg-white/5 p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="outline" className={getStatusBadgeClassName(run.status)}>{run.status}</Badge>
                        <span className="text-slate-400">#{run.id}</span>
                      </div>
                      {run.error_message && <div className="text-sm text-red-300">{run.error_message}</div>}
                      {run.output_image_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResultDialogRun(run)}
                          className={`w-full ${debugButtonToneClassName}`}
                        >
                          <ImageIcon size={14} /> 查看结果图
                        </Button>
                      )}
                      <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={run.rating ?? ''}
                          onChange={(e) => handleRunPatch(run.id, { rating: e.target.value ? Number(e.target.value) : null })}
                          placeholder="评分"
                          className={debugInputClassName}
                        />
                        <Input
                          value={run.tags.join(', ')}
                          onChange={(e) => handleRunPatch(run.id, { tags: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                          placeholder="标签，逗号分隔"
                          className={debugInputClassName}
                        />
                      </div>
                      <Textarea
                        value={run.notes}
                        onChange={(e) => handleRunPatch(run.id, { notes: e.target.value })}
                        placeholder="备注"
                        className={`min-h-16 ${debugTextareaClassName}`}
                      />
                      <Button variant="outline" size="sm" onClick={() => void handleSaveRun(run)} disabled={savingRunId === run.id}>
                        <Save size={14} /> 保存记录
                      </Button>
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-hidden border border-white/10 bg-[#061428] text-slate-100">
          <DialogHeader>
            <DialogTitle>预览 Prompt</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_320px] gap-4">
              <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-slate-950/90 p-4 text-sm leading-relaxed text-slate-100">
                {preview.prompt}
              </pre>
              <div className="max-h-[70vh] space-y-3 overflow-auto">
                <div className="text-sm font-medium text-slate-100">输入图片</div>
                {preview.input_resources.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {preview.input_resources.map((resource) => (
                      <ImageResourceCard key={`${resource.role}-${resource.sort_order}`} resource={resource} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-white/10 bg-white/5 px-3 py-8 text-center text-sm text-slate-400">
                    没有输入图片
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(resultDialogRun)} onOpenChange={(open) => !open && setResultDialogRun(null)}>
        <DialogContent className="max-h-[88vh] max-w-5xl overflow-auto border border-white/10 bg-[#061428] text-slate-100">
          <DialogHeader>
            <DialogTitle>生成调试结果</DialogTitle>
          </DialogHeader>
          {resultDialogRun && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <Badge variant="outline" className={getStatusBadgeClassName(resultDialogRun.status)}>{resultDialogRun.status}</Badge>
                <span className="text-slate-400">#{resultDialogRun.id}</span>
              </div>
              {resultDialogRun.error_message && (
                <div className="rounded-md border border-red-300/30 bg-red-400/10 p-3 text-sm text-red-100">
                  {resultDialogRun.error_message}
                </div>
              )}
              {resultDialogRun.output_image_url ? (
                <img
                  src={toApiUrl(resultDialogRun.output_image_url)}
                  alt="生成调试结果"
                  className="mx-auto max-h-[72vh] rounded-md border border-white/10 object-contain"
                />
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-white/10 bg-white/5 text-sm text-slate-400">
                  暂无结果图
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GenerationDebugView;
