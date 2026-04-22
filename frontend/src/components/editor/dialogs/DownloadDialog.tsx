import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ExportOptions,
  DEFAULT_EXPORT_OPTIONS,
  ExportFormat,
  PaperSize,
  PaperOrientation,
  FitMode,
  PAPER_SIZES,
  JPG_QUALITY_OPTIONS,
  estimateLongImage,
  LongImageEstimate,
} from '@/services/exportService';
import { StorybookPage } from '@/services/storybookService';

interface DownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: ExportOptions) => void;
  onCancelExport?: () => void;
  pages: StorybookPage[];
  isExporting?: boolean;
  currentPageIndex?: number;
  exportProgress?: number;
}

const PAPER_OPTIONS: { value: PaperSize; label: string }[] = [
  { value: 'original', label: '原图尺寸' },
  { value: 'a4', label: 'A4 (210 x 297mm)' },
  { value: 'a5', label: 'A5 (148 x 210mm)' },
  { value: 'square-210', label: '方形 (210 x 210mm)' },
];

const ORIENTATION_OPTIONS: { value: PaperOrientation; label: string }[] = [
  { value: 'auto', label: '自动' },
  { value: 'portrait', label: '竖版' },
  { value: 'landscape', label: '横版' },
];

const FIT_OPTIONS: { value: FitMode; label: string }[] = [
  { value: 'contain', label: '完整显示' },
  { value: 'cover', label: '铺满裁切' },
];

const FORMAT_LABELS: Record<ExportFormat, string> = {
  pdf: 'PDF',
  png: 'PNG 长图',
  jpg: 'JPG 长图',
};

const getPaperRatio = (options: ExportOptions, estimate: LongImageEstimate | null) => {
  const pageW = estimate?.pageWidth || 16;
  const pageH = estimate?.pageHeight || 9;
  let width = pageW;
  let height = pageH;

  if (options.paperSize !== 'original') {
    const paper = PAPER_SIZES[options.paperSize];
    width = paper.width;
    height = paper.height;
  }

  if (options.orientation !== 'auto') {
    const short = Math.min(width, height);
    const long = Math.max(width, height);
    return options.orientation === 'portrait' ? short / long : long / short;
  }

  const pageRatio = pageW / pageH;
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  const portraitRatio = short / long;
  const landscapeRatio = long / short;
  return Math.abs(pageRatio - portraitRatio) < Math.abs(pageRatio - landscapeRatio)
    ? portraitRatio
    : landscapeRatio;
};

const getCurrentPreviewPage = (pages: StorybookPage[], currentPageIndex: number) => {
  if (pages.length === 0) return null;
  return pages[Math.min(Math.max(currentPageIndex, 0), pages.length - 1)];
};

export const DownloadDialog: React.FC<DownloadDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  onCancelExport,
  pages,
  isExporting = false,
  currentPageIndex = 0,
  exportProgress = 0,
}) => {
  const [options, setOptions] = useState<ExportOptions>({ ...DEFAULT_EXPORT_OPTIONS });
  const [longImageEstimate, setLongImageEstimate] = useState<LongImageEstimate | null>(null);
  const [previewIndex, setPreviewIndex] = useState(currentPageIndex);

  const isPdf = options.format === 'pdf';
  const isJpg = options.format === 'jpg';
  const previewPage = getCurrentPreviewPage(pages, previewIndex);
  const paperRatio = getPaperRatio(options, longImageEstimate);

  useEffect(() => {
    if (!open) return;
    setOptions({ ...DEFAULT_EXPORT_OPTIONS });
    setPreviewIndex(Math.min(Math.max(currentPageIndex, 0), Math.max(pages.length - 1, 0)));
  }, [open, currentPageIndex, pages.length]);

  useEffect(() => {
    if (!open) return;
    let ignore = false;
    estimateLongImage(pages).then((estimate) => {
      if (!ignore) setLongImageEstimate(estimate);
    });
    return () => {
      ignore = true;
    };
  }, [open, pages]);

  const updateOption = useCallback(<K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(options);
  }, [options, onConfirm]);

  const contentPageNumber = useMemo(() => {
    const page = pages[previewIndex];
    if (!page || page.page_type === 'cover' || page.page_type === 'back_cover') return null;
    return pages.slice(0, previewIndex + 1).filter(p => p.page_type !== 'cover' && p.page_type !== 'back_cover').length;
  }, [pages, previewIndex]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>导出作品</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 py-2 md:grid-cols-[280px_1fr]">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>导出格式</Label>
              <Tabs
                value={options.format}
                onValueChange={(value) => updateOption('format', value as ExportFormat)}
              >
                <TabsList className="grid w-full grid-cols-3">
                  {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((format) => (
                    <TabsTrigger key={format} value={format} className="data-[state=active]:text-[#00CDD4]">
                      {FORMAT_LABELS[format]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {isPdf && (
              <>
                <div className="space-y-2">
                  <Label>纸张尺寸</Label>
                  <Select
                    value={options.paperSize}
                    onValueChange={(value) => updateOption('paperSize', value as PaperSize)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAPER_OPTIONS.map((paper) => (
                        <SelectItem key={paper.value} value={paper.value}>
                          {paper.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>纸张方向</Label>
                  <Tabs
                    value={options.orientation}
                    onValueChange={(value) => updateOption('orientation', value as PaperOrientation)}
                  >
                    <TabsList className="grid w-full grid-cols-3">
                      {ORIENTATION_OPTIONS.map((orient) => (
                        <TabsTrigger key={orient.value} value={orient.value} className="data-[state=active]:text-[#00CDD4]">
                          {orient.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                <div className="space-y-2">
                  <Label>图片适配方式</Label>
                  <Tabs
                    value={options.fitMode}
                    onValueChange={(value) => updateOption('fitMode', value as FitMode)}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      {FIT_OPTIONS.map((fit) => (
                        <TabsTrigger key={fit.value} value={fit.value} className="data-[state=active]:text-[#00CDD4]">
                          {fit.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>打印安全边距</Label>
                    <p className="text-xs text-slate-400">开启后内容不会贴边</p>
                  </div>
                  <Switch
                    checked={options.safeMargin}
                    onCheckedChange={(checked) => updateOption('safeMargin', checked)}
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <Label>正文页页码</Label>
                    <p className="text-xs text-slate-400">封面和封底不显示页码</p>
                  </div>
                  <Switch
                    checked={options.showPageNumbers}
                    onCheckedChange={(checked) => updateOption('showPageNumbers', checked)}
                  />
                </div>
              </>
            )}

            {isJpg && (
              <div className="space-y-2">
                <Label>图片质量</Label>
                <Select
                  value={String(options.jpgQuality)}
                  onValueChange={(value) => updateOption('jpgQuality', Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JPG_QUALITY_OPTIONS.map((q) => (
                      <SelectItem key={q.value} value={String(q.value)}>
                        {q.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>预览</Label>
              {isPdf && pages.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={previewIndex <= 0}
                    onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))}
                  >
                    上一页
                  </Button>
                  <span className="text-xs text-slate-400">{previewIndex + 1} / {pages.length}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={previewIndex >= pages.length - 1}
                    onClick={() => setPreviewIndex((index) => Math.min(pages.length - 1, index + 1))}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </div>

            {isPdf ? (
              <div className="flex h-[300px] items-center justify-center rounded-md border bg-slate-50 p-4">
                <div
                  className="relative max-h-full max-w-full bg-white shadow-sm"
                  style={{
                    aspectRatio: paperRatio,
                    width: paperRatio >= 1 ? '100%' : undefined,
                    height: paperRatio < 1 ? '100%' : undefined,
                    padding: options.safeMargin ? 12 : 0,
                  }}
                >
                  {previewPage?.image_url && (
                    <img
                      src={previewPage.image_url}
                      alt=""
                      className={options.fitMode === 'cover' ? 'h-full w-full object-cover' : 'h-full w-full object-contain'}
                    />
                  )}
                  {options.showPageNumbers && contentPageNumber !== null && (
                    <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-slate-400">
                      {contentPageNumber}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-[300px] overflow-y-auto rounded-md border bg-slate-50">
                {pages.map((page) => (
                  <img key={page.id} src={page.image_url} alt="" className="block w-full" />
                ))}
              </div>
            )}

            {!isPdf && longImageEstimate && (
              <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>单页尺寸</span>
                  <span>{longImageEstimate.pageWidth} x {longImageEstimate.pageHeight} px</span>
                </div>
                <div className="flex justify-between">
                  <span>长图尺寸</span>
                  <span>{longImageEstimate.pageWidth} x {longImageEstimate.longHeight} px</span>
                </div>
                {longImageEstimate.willSplit && (
                  <div className="text-xs text-amber-600">
                    长图高度超过限制，将自动分为 {longImageEstimate.parts} 个文件导出
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          {isExporting ? (
            <Button variant="outline" onClick={onCancelExport}>
              取消导出
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
          )}
          <Button variant="gradient" onClick={handleConfirm} disabled={isExporting}>
            {isExporting ? `导出中 ${exportProgress}%` : '导出'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadDialog;
