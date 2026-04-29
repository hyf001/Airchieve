import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Beaker, ImageIcon, Play, Save, Search, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { toApiUrl } from '@/services/storybookService';
import {
  createDebugRun,
  getDebugPageContext,
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
    <Label className="text-xs text-slate-400">{label}</Label>
    {children}
  </div>
);

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
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索绘本" className="w-56 bg-slate-900/70 border-white/10" />
          <Button variant="outline" onClick={loadStorybooks}><Search size={16} /></Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 grid grid-cols-[280px_260px_minmax(0,1fr)] overflow-hidden">
        <aside className="border-r border-white/10 overflow-auto p-3 space-y-2">
          {storybooks.map((item) => (
            <button
              key={item.id}
              onClick={() => void selectStorybook(item.id)}
              className={`w-full text-left p-3 rounded-md border ${selectedStorybookId === item.id ? 'border-teal-400 bg-teal-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
            >
              <div className="font-medium truncate">{item.title}</div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <Badge variant="outline">{item.status}</Badge>
                <span>{item.page_count} 页</span>
                <span>{item.cli_type}</span>
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
            <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-400 mb-2">正式图</div>
                    {officialImage && <img src={toApiUrl(officialImage)} className="w-full rounded-md border border-white/10" />}
                  </div>
                  <div>
                    <div className="text-sm text-slate-400 mb-2">调试结果</div>
                    {runs[0]?.output_image_url ? <img src={toApiUrl(runs[0].output_image_url)} className="w-full rounded-md border border-white/10" /> : <div className="aspect-video rounded-md border border-white/10 bg-white/5" />}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <FormField label="模型">
                    <Select value={params.cli_type} onValueChange={(value) => updateParams({ cli_type: value })}>
                      <SelectTrigger className="bg-slate-900/70 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="gemini">Gemini</SelectItem><SelectItem value="doubao">豆包</SelectItem></SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="图片比例">
                    <Select value={params.aspect_ratio} onValueChange={(value) => updateParams({ aspect_ratio: value })}>
                      <SelectTrigger className="bg-slate-900/70 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="16:9">16:9</SelectItem><SelectItem value="4:3">4:3</SelectItem><SelectItem value="1:1">1:1</SelectItem></SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="尺寸">
                    <Select value={params.image_size} onValueChange={(value) => updateParams({ image_size: value })}>
                      <SelectTrigger className="bg-slate-900/70 border-white/10"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="1k">1k</SelectItem><SelectItem value="2k">2k</SelectItem><SelectItem value="4k">4k</SelectItem></SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="画风名">
                    <Input value={params.style_name} onChange={(e) => updateParams({ style_name: e.target.value })} className="bg-slate-900/70 border-white/10" />
                  </FormField>
                </div>

                <div className="space-y-3">
                  <FormField label="当前页文本">
                    <Textarea value={params.story_text} onChange={(e) => updateParams({ story_text: e.target.value })} className="min-h-24 bg-slate-900/70 border-white/10" />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="故事上下文，每行一页">
                      <Textarea value={joinLines(params.story_context)} onChange={(e) => updateParams({ story_context: splitLines(e.target.value) })} className="min-h-32 bg-slate-900/70 border-white/10" />
                    </FormField>
                    <FormField label="图片调整指令">
                      <Textarea value={params.image_instruction} onChange={(e) => updateParams({ image_instruction: e.target.value })} className="min-h-32 bg-slate-900/70 border-white/10" />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="分镜摘要">
                      <Textarea value={params.storyboard?.summary ?? ''} onChange={(e) => updateStoryboard({ summary: e.target.value })} className="min-h-20 bg-slate-900/70 border-white/10" />
                    </FormField>
                    <FormField label="画面目标">
                      <Textarea value={params.storyboard?.visual_brief ?? ''} onChange={(e) => updateStoryboard({ visual_brief: e.target.value })} className="min-h-20 bg-slate-900/70 border-white/10" />
                    </FormField>
                    <FormField label="必须出现，每行一个">
                      <Textarea value={joinLines(params.storyboard?.must_include ?? [])} onChange={(e) => updateStoryboard({ must_include: splitLines(e.target.value) })} className="min-h-20 bg-slate-900/70 border-white/10" />
                    </FormField>
                    <FormField label="避免出现，每行一个">
                      <Textarea value={joinLines(params.storyboard?.avoid ?? [])} onChange={(e) => updateStoryboard({ avoid: splitLines(e.target.value) })} className="min-h-20 bg-slate-900/70 border-white/10" />
                    </FormField>
                    <FormField label="锚点 ID，每行一个">
                      <Textarea value={joinLines(params.storyboard?.anchor_refs ?? [])} onChange={(e) => updateStoryboard({ anchor_refs: splitLines(e.target.value) })} className="min-h-20 bg-slate-900/70 border-white/10" />
                    </FormField>
                    <FormField label="构图">
                      <Textarea value={params.storyboard?.composition ?? ''} onChange={(e) => updateStoryboard({ composition: e.target.value })} className="min-h-20 bg-slate-900/70 border-white/10" />
                    </FormField>
                  </div>
                  <FormField label="视觉锚点 JSON">
                    <Textarea value={anchorJson} onChange={(e) => setAnchorJson(e.target.value)} className="min-h-32 font-mono text-xs bg-slate-900/70 border-white/10" />
                  </FormField>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="画风正向 prompt">
                      <Textarea value={params.style_generation_prompt} onChange={(e) => updateParams({ style_generation_prompt: e.target.value })} className="min-h-28 bg-slate-900/70 border-white/10" />
                    </FormField>
                    <FormField label="画风负向 prompt">
                      <Textarea value={params.style_negative_prompt} onChange={(e) => updateParams({ style_negative_prompt: e.target.value })} className="min-h-28 bg-slate-900/70 border-white/10" />
                    </FormField>
                    <FormField label="画风参考图 URL，每行一个">
                      <Textarea value={joinLines(params.style_reference_images)} onChange={(e) => updateParams({ style_reference_images: splitLines(e.target.value) })} className="min-h-24 bg-slate-900/70 border-white/10" />
                    </FormField>
                    <FormField label="角色参考图 URL，每行一个">
                      <Textarea value={joinLines(params.character_reference_images)} onChange={(e) => updateParams({ character_reference_images: splitLines(e.target.value) })} className="min-h-24 bg-slate-900/70 border-white/10" />
                    </FormField>
                    <FormField label="上一页替代图 URL">
                      <Input value={params.previous_page_image ?? ''} onChange={(e) => updateParams({ previous_page_image: e.target.value.trim() || null })} className="bg-slate-900/70 border-white/10" />
                    </FormField>
                    <FormField label="页面参考图 URL，每行一个">
                      <Textarea value={joinLines(params.selected_reference_page_images)} onChange={(e) => updateParams({ selected_reference_page_images: splitLines(e.target.value) })} className="min-h-20 bg-slate-900/70 border-white/10" />
                    </FormField>
                  </div>
                </div>

                {preview && (
                  <div className="space-y-3">
                    <pre className="whitespace-pre-wrap text-sm bg-slate-950 border border-white/10 rounded-md p-3">{preview.prompt}</pre>
                    <div className="grid grid-cols-2 gap-2">
                      {preview.input_resources.map((resource) => (
                        <div key={`${resource.role}-${resource.sort_order}`} className="text-xs border border-white/10 rounded-md p-2 bg-white/5">
                          <div className="text-teal-300">{resource.sort_order + 1}. {resource.role}</div>
                          <div className="truncate text-slate-400">{resource.url}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <aside className="space-y-3">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePreview} disabled={previewing} className="flex-1"><Sparkles size={16} /> {previewing ? '预览中' : '预览 Prompt'}</Button>
                  <Button variant="gradient" onClick={handleRun} disabled={running} className="flex-1"><Play size={16} /> 生成调试图</Button>
                </div>
                <div className="space-y-2">
                  {runs.map((run) => (
                    <div key={run.id} className="rounded-md border border-white/10 bg-white/5 p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <Badge variant="outline">{run.status}</Badge>
                        <span className="text-slate-400">#{run.id}</span>
                      </div>
                      {run.error_message && <div className="text-sm text-red-300">{run.error_message}</div>}
                      {run.output_image_url && <img src={toApiUrl(run.output_image_url)} className="rounded border border-white/10" />}
                      <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={run.rating ?? ''}
                          onChange={(e) => handleRunPatch(run.id, { rating: e.target.value ? Number(e.target.value) : null })}
                          placeholder="评分"
                          className="bg-slate-900/70 border-white/10"
                        />
                        <Input
                          value={run.tags.join(', ')}
                          onChange={(e) => handleRunPatch(run.id, { tags: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
                          placeholder="标签，逗号分隔"
                          className="bg-slate-900/70 border-white/10"
                        />
                      </div>
                      <Textarea
                        value={run.notes}
                        onChange={(e) => handleRunPatch(run.id, { notes: e.target.value })}
                        placeholder="备注"
                        className="min-h-16 bg-slate-900/70 border-white/10"
                      />
                      <Button variant="outline" size="sm" onClick={() => void handleSaveRun(run)} disabled={savingRunId === run.id}>
                        <Save size={14} /> 保存记录
                      </Button>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default GenerationDebugView;
