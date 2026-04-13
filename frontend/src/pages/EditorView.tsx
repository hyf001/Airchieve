/**
 * EditorView - 绘本编辑器主组件
 * 经过模块化重构的版本
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  deleteStorybook,
  updateStorybookPublicStatus,
  downloadStorybookImage,
  terminateStorybook,
  insertPages,
  generateCover,
  savePage,
  InsufficientPointsError,
  getPageDetail,
} from '../services/storybookService';
import { useToast } from '@/hooks/use-toast';

// 导入重构后的组件
import {
  EditorHeader,
  StorybookList,
  PageNavigator,
  EditorCanvas,
} from '../components/editor';
import { ToolPanelWithSelector } from '../components/editor/tools/ToolPanel';
import { TextEditToolRef, TextLayer } from '../components/editor/tools/text-edit/types';
import { AIEditRef } from '../components/editor/tools/ai-edit/types';

// 导入对话框组件
import {
  DownloadDialog,
  TerminateConfirmDialog,
  InsertPageDialog,
  GenerateCoverDialog,
  BackCoverDialog,
} from '../components/editor/dialogs';
import { ConfirmDialog } from '@/components/ConfirmDialog';

// 导入 Hooks
import { useEditorState } from '@/hooks/useEditorState';
import { useStorybookLoader } from '@/hooks/useStorybookLoader';
import { useToolManager } from '@/hooks/useToolManager';

interface EditorViewProps {
  storybookId?: number;
  onBack: () => void;
  onCreateNew: () => void;
}

/**
 * EditorView 主组件
 */
const EditorView: React.FC<EditorViewProps> = ({ storybookId, onBack, onCreateNew }) => {
  const { toast } = useToast();

  // ========== 状态管理 ==========
  const editorState = useEditorState();

  // ========== 工具栏状态 ==========
  const toolManager = useToolManager();

  // ========== 文字图层状态 ==========
  const textEditToolRef = useRef<TextEditToolRef>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [textLayers, setTextLayers] = useState<TextLayer[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  // ========== AI改图工具状态 ==========
  const aiEditToolRef = useRef<AIEditRef>(null);
  const [isAIEditGenerating, setIsAIEditGenerating] = useState(false);

  // ========== 历史记录状态（撤销/重做） ==========
  const [historyState, setHistoryState] = useState<{
    history: Array<{ image_url: string; text: string }>;
    index: number;
  }>({
    history: [],
    index: -1,
  });
  const [isSavingPage, setIsSavingPage] = useState(false);

  // ========== 数据加载 ==========
  const { loadStorybook, loadStorybookList, startPolling, stopPolling } = useStorybookLoader({
    setCurrentStorybook: editorState.setCurrentStorybook,
    setStorybookList: editorState.setStorybookList,
    updateStorybookInList: editorState.updateStorybookInList,
    setCurrentPageIndex: editorState.setCurrentPageIndex,
    setLoading: editorState.setLoading,
    setError: editorState.setError,
  });

  // ========== 业务操作 ==========
  const handleDelete = async (id: number) => {
    try {
      await deleteStorybook(id);
      const newList = await loadStorybookList();
      if (editorState.currentStorybook?.id === id) {
        stopPolling();
        editorState.setCurrentStorybook(null);
      }
      // 如果还有其他绘本，加载第一个
      if (newList.length > 0) {
        loadStorybook(newList[0].id);
      }
    } catch {
      toast({ variant: 'destructive', title: '删除失败' });
    }
  };

  const handleTogglePublic = async (id: number, currentIsPublic: boolean) => {
    try {
      await updateStorybookPublicStatus(id, !currentIsPublic);
      editorState.updateStorybookInList(id, { is_public: !currentIsPublic });
    } catch {
      toast({ variant: 'destructive', title: '更新公开状态失败' });
    }
  };

  const handleDownloadConfirm = async (watermark: boolean) => {
    if (!editorState.currentStorybook) return;
    editorState.setDialogState('download', false);
    editorState.setDownloadState({ isDownloading: true, progress: 0 });

    try {
      await downloadStorybookImage(editorState.currentStorybook, watermark);
      toast({ title: '下载成功' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '下载失败',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      editorState.setDownloadState({ isDownloading: false, progress: 100 });
    }
  };

  const handleTerminate = async () => {
    if (!editorState.currentStorybook || editorState.isTerminating) return;

    try {
      const res = await terminateStorybook(editorState.currentStorybook.id);
      toast({ title: res.message || '已中止' });
      stopPolling();
      editorState.setCurrentStorybook({ ...editorState.currentStorybook, status: 'terminated' });
      editorState.updateStorybookInList(editorState.currentStorybook.id, { status: 'terminated' });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '中止失败',
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleInsertPages = async (position: number, count: number, instruction?: string) => {
    if (!editorState.currentStorybook) return;

    try {
      await insertPages(editorState.currentStorybook.id, position, count, instruction);
      editorState.setCurrentStorybook({ ...editorState.currentStorybook, status: 'updating' });
      startPolling(editorState.currentStorybook.id);
      toast({ title: '开始生成新页面' });
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        toast({ variant: 'destructive', title: '积分不足', description: err.message });
      } else {
        toast({
          variant: 'destructive',
          title: '插入页失败',
          description: err instanceof Error ? err.message : undefined,
        });
      }
    }
  };

  const handleGenerateCover = async (selectedPages: number[]) => {
    if (!editorState.currentStorybook) return;

    try {
      await generateCover(editorState.currentStorybook.id, selectedPages);
      editorState.setCurrentStorybook({ ...editorState.currentStorybook, status: 'updating' });
      startPolling(editorState.currentStorybook.id);
      toast({ title: '封面生成中', description: '请稍候，生成完成后将自动刷新' });
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        toast({ variant: 'destructive', title: '积分不足', description: err.message });
      } else {
        toast({
          variant: 'destructive',
          title: '生成失败',
          description: err instanceof Error ? err.message : undefined,
        });
      }
    }
  };

  // ========== 历史记录管理 ==========
  // 当页面切换时，初始化历史记录
  const prevPageIndexRef = useRef<number>(-1);

  // 页面切换：有未保存修改时提示
  const handlePageChange = (newIndex: number) => {
    if (newIndex === editorState.currentPageIndex) return;
    const hasUnsaved = historyState.index > 0;
    if (hasUnsaved) {
      editorState.setDialogState('unsavedSwitch', true);
      pendingPageIndexRef.current = newIndex;
    } else {
      editorState.setCurrentPageIndex(newIndex);
    }
  };

  const pendingPageIndexRef = useRef<number>(-1);

  // 确认切换：放弃修改，切换页面
  const confirmPageSwitch = () => {
    const idx = pendingPageIndexRef.current;
    if (idx >= 0) {
      editorState.setCurrentPageIndex(idx);
      pendingPageIndexRef.current = -1;
    }
    editorState.setDialogState('unsavedSwitch', false);
  };

  // 取消切换：留在当前页
  const cancelPageSwitch = () => {
    pendingPageIndexRef.current = -1;
    editorState.setDialogState('unsavedSwitch', false);
  };

  useEffect(() => {
    // 只在页面索引变化时从后台获取最新页面详情并初始化历史记录
    if (editorState.pages.length > 0 && editorState.currentPageIndex >= 0 && editorState.currentPageIndex !== prevPageIndexRef.current) {
      const page = editorState.pages[editorState.currentPageIndex];
      // 从后台获取最新页面详情
      getPageDetail(page.id).then(detail => {
        // 更新当前页面的数据到 storybook state
        editorState.setCurrentStorybook({
          ...editorState.currentStorybook!,
          pages: editorState.pages.map((p, i) =>
            i === editorState.currentPageIndex
              ? { ...p, image_url: detail.image_url, text: detail.text, storyboard: detail.storyboard }
              : p
          ),
        });
        setHistoryState({
          history: [{ image_url: detail.image_url, text: detail.text || '' }],
          index: 0,
        });
      }).catch(() => {
        // 接口失败时用本地数据兜底
        setHistoryState({
          history: [{ image_url: page.image_url, text: page.text || '' }],
          index: 0,
        });
      });
      prevPageIndexRef.current = editorState.currentPageIndex;
    }
  }, [editorState.currentPageIndex, editorState.pages]);

  // 记录新的历史状态
  const pushHistory = (imageUrl: string, text: string) => {
    setHistoryState(prev => {
      // 如果当前不在历史记录末尾，删除后面的记录
      const newHistory = prev.history.slice(0, prev.index + 1);
      newHistory.push({ image_url: imageUrl, text });
      // 限制历史记录长度（最多20条）
      const trimmedHistory = newHistory.length > 20 ? newHistory.slice(-20) : newHistory;
      return {
        history: trimmedHistory,
        index: trimmedHistory.length - 1,
      };
    });
  };

  // 撤销
  const handleUndo = () => {
    if (historyState.index > 0) {
      const newIndex = historyState.index - 1;
      const entry = historyState.history[newIndex];
      setHistoryState(prev => ({ ...prev, index: newIndex }));
      const updatedPages = [...editorState.pages];
      updatedPages[editorState.currentPageIndex] = {
        ...updatedPages[editorState.currentPageIndex],
        image_url: entry.image_url,
        text: entry.text,
      };
      editorState.setCurrentStorybook({
        ...editorState.currentStorybook!,
        pages: updatedPages,
      });
    }
  };

  // 重做
  const handleRedo = () => {
    if (historyState.index < historyState.history.length - 1) {
      const newIndex = historyState.index + 1;
      const entry = historyState.history[newIndex];
      setHistoryState(prev => ({ ...prev, index: newIndex }));
      const updatedPages = [...editorState.pages];
      updatedPages[editorState.currentPageIndex] = {
        ...updatedPages[editorState.currentPageIndex],
        image_url: entry.image_url,
        text: entry.text,
      };
      editorState.setCurrentStorybook({
        ...editorState.currentStorybook!,
        pages: updatedPages,
      });
    }
  };

  // 保存页面
  const handleSavePage = async () => {
    if (!editorState.currentStorybook || isSavingPage) return;

    const currentPage = editorState.pages[editorState.currentPageIndex];
    if (!currentPage) return;

    setIsSavingPage(true);
    try {
      const updatedPage = await savePage(
        editorState.currentStorybook.id,
        editorState.currentPageIndex,
        currentPage.text || '',
        currentPage.image_url
      );

      // 更新本地状态
      const updatedPages = [...editorState.pages];
      updatedPages[editorState.currentPageIndex] = updatedPage;
      editorState.setCurrentStorybook({
        ...editorState.currentStorybook,
        pages: updatedPages,
      });

      toast({
        title: '保存成功',
        description: '页面已保存到服务器',
      });

      // 保存成功后清空历史
      setHistoryState({
        history: [{ image_url: updatedPage.image_url, text: updatedPage.text || '' }],
        index: 0,
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: '保存失败',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsSavingPage(false);
    }
  };

  // ========== 初始化加载 ==========
  useEffect(() => {
    const initialize = async () => {
      const list = await loadStorybookList();
      if (storybookId) {
        await loadStorybook(storybookId);
      } else if (list.length > 0) {
        await loadStorybook(list[0].id);
      } else {
        editorState.setLoading(false);
      }
    };

    initialize();
  }, [storybookId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ========== 下载进度模拟 ==========
  useEffect(() => {
    if (!editorState.download.isDownloading) {
      if (editorState.download.progress > 0) {
        editorState.setDownloadState({ progress: 100 });
      }
      return;
    }
    editorState.setDownloadState({ progress: 5 });
    const id = setInterval(() => {
      const newProgress = Math.min(99, editorState.download.progress + (99 - editorState.download.progress) * 0.06 + 0.35);
      editorState.setDownloadState({ progress: newProgress });
      if (newProgress >= 99) {
        clearInterval(id);
      }
    }, 400);
    return () => clearInterval(id);
  }, [editorState.download.isDownloading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ========== 渲染 ==========
  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden bg-[#FAF3ED]">
        {/* 顶部导航栏 */}
        <EditorHeader
          currentStorybook={editorState.currentStorybook}
          pages={editorState.pages}
          isCreating={editorState.isCreating}
          canReadPages={editorState.canReadPages}
          onBack={onBack}
          onCreateNew={onCreateNew}
          onInsertPage={() => editorState.setDialogState('insertPage', true)}
          onGenerateCover={() => editorState.setDialogState('cover', true)}
          onGenerateBackCover={() => editorState.setDialogState('backCover', true)}
          onDownload={() => editorState.setDialogState('download', true)}
          canUndo={historyState.index > 0}
          canRedo={historyState.index < historyState.history.length - 1}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSavePage={handleSavePage}
          isSavingPage={isSavingPage}
        />

        {/* 主工作区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧：绘本列表 */}
          <StorybookList
            storybookList={editorState.storybookList}
            currentStorybookId={editorState.currentStorybook?.id}
            onSelectStorybook={loadStorybook}
            onDeleteStorybook={(id, e) => {
              e.stopPropagation();
              handleDelete(id);
            }}
            onTogglePublic={handleTogglePublic}
            onCreateNew={onCreateNew}
          />

          {/* 中间区域 */}
          {editorState.currentStorybook && (
            <>
              {/* 页面导航 */}
              <PageNavigator
                pages={editorState.pages}
                currentIndex={editorState.currentPageIndex}
                onIndexChange={handlePageChange}
              />

              {/* 画布区域 */}
              <EditorCanvas
                currentStorybook={editorState.currentStorybook}
                currentPageIndex={editorState.currentPageIndex}
                isCreating={editorState.isCreating}
                pages={editorState.pages}
                canReadPages={editorState.canReadPages}
                loading={editorState.loading}
                error={editorState.error}
                downloadProgress={editorState.download.progress}
                isDownloading={editorState.download.isDownloading}
                onPageIndexChange={editorState.setCurrentPageIndex}
                onTerminateClick={() => editorState.setDialogState('terminate', true)}
                isTerminating={editorState.isTerminating}
                onBack={onBack}
                activeTool={toolManager.activeTool}
                textEditToolRef={textEditToolRef}
                textLayers={textLayers}
                selectedLayerId={selectedLayerId}
                isDragging={isDragging}
                isResizing={isResizing}
                canvasRef={canvasRef}
                aiEditToolRef={aiEditToolRef}
                isAIEditGenerating={isAIEditGenerating}
                onTextApply={async () => {
                  // 自动应用文字（本地预览，不保存到后端）
                  if (textEditToolRef.current && textLayers.length > 0) {
                    // 使用 OSS 代理 URL
                    const originalUrl = editorState.pages[editorState.currentPageIndex]?.image_url || '';
                    const imageUrl = originalUrl.replace('https://airchieve.oss-cn-beijing.aliyuncs.com', '/api/v1/oss');

                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;

                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.src = imageUrl;

                    await new Promise<void>((resolve) => {
                      img.onload = () => resolve();
                      img.onerror = () => {
                        console.error('Failed to load image for text apply');
                        resolve();
                      };
                    });

                    if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                      console.error('Image dimensions invalid');
                      return;
                    }

                    const container = canvasRef.current;
                    if (!container) {
                      console.error('Container not found');
                      return;
                    }
                    const containerRect = container.getBoundingClientRect();
                    const containerWidth = containerRect.width;

                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const scale = img.naturalWidth / containerWidth;

                    ctx.drawImage(img, 0, 0);
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';

                    textLayers.forEach(layer => {
                      const scaledX = layer.x * scale;
                      const scaledY = layer.y * scale;
                      const scaledFontSize = layer.fontSize * scale;
                      const scaledWidth = layer.width * scale;
                      const scaledHeight = layer.height * scale;

                      ctx.font = `${layer.bold ? 'bold' : ''} ${scaledFontSize}px ${layer.fontFamily}`;
                      ctx.fillStyle = layer.color;
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';

                      ctx.shadowColor = 'rgba(0,0,0,0.85)';
                      ctx.shadowBlur = 4 * scale;
                      ctx.shadowOffsetX = 0;
                      ctx.shadowOffsetY = 1 * scale;

                      const text = layer.text || '';
                      const wrapText = (text: string, maxWidth: number): string[] => {
                        const paragraphs = text.split('\n');
                        const lines: string[] = [];
                        paragraphs.forEach(paragraph => {
                          const words = paragraph.split('');
                          let currentLine = '';
                          for (let i = 0; i < words.length; i++) {
                            const testLine = currentLine + words[i];
                            const metrics = ctx.measureText(testLine);
                            const testWidth = metrics.width;
                            if (testWidth > maxWidth && currentLine.length > 0) {
                              lines.push(currentLine);
                              currentLine = words[i];
                            } else {
                              currentLine = testLine;
                            }
                          }
                          if (currentLine) {
                            lines.push(currentLine);
                          }
                        });
                        return lines;
                      };

                      const padding = scaledFontSize * 0.5;
                      const maxWidth = scaledWidth - padding * 2;
                      const lines = wrapText(text, maxWidth);
                      const lineHeight = scaledFontSize * 1.2;
                      const totalHeight = lines.length * lineHeight;
                      const startY = scaledY + (scaledHeight - totalHeight) / 2 + lineHeight / 2;

                      lines.forEach((line, index) => {
                        const x = scaledX + scaledWidth / 2;
                        const y = startY + index * lineHeight;
                        ctx.fillText(line, x, y);
                      });
                    });

                    const resultImageUrl = canvas.toDataURL('image/png');
                    console.log('文字自动应用完成:', resultImageUrl);

                    // 更新本地页面图片（不保存到后端）
                    const updatedPages = [...editorState.pages];
                    updatedPages[editorState.currentPageIndex] = {
                      ...updatedPages[editorState.currentPageIndex],
                      image_url: resultImageUrl,
                    };

                    // 更新当前绘本的 pages
                    editorState.setCurrentStorybook({
                      ...editorState.currentStorybook!,
                      pages: updatedPages,
                    });

                    // 记录到历史
                    pushHistory(resultImageUrl, editorState.pages[editorState.currentPageIndex]?.text || '');

                    toast({
                      title: '文字已应用（本地预览）',
                      description: '点击保存按钮将更改保存到服务器',
                    });

                    // 清空文字图层，防止重复应用
                    setTextLayers([]);

                    // 取消选中工具
                    toolManager.setActiveTool(null);
                  }
                }}
              />

              {/* 右侧：工具栏 */}
              <ToolPanelWithSelector
                storybookId={editorState.currentStorybook.id}
                baseImageUrl={editorState.pages[editorState.currentPageIndex]?.image_url || ''}
                onPageEdited={(imageUrl: string) => {
                  // 本地预览：更新页面图片，不保存到后端
                  const currentPage = editorState.pages[editorState.currentPageIndex];
                  if (!currentPage) return;

                  const updatedPages = [...editorState.pages];
                  updatedPages[editorState.currentPageIndex] = {
                    ...updatedPages[editorState.currentPageIndex],
                    image_url: imageUrl,
                  };
                  editorState.setCurrentStorybook({
                    ...editorState.currentStorybook!,
                    pages: updatedPages,
                  });

                  pushHistory(imageUrl, currentPage.text || '');

                  toast({
                    title: '图片已更新（本地预览）',
                    description: '点击保存按钮将更改保存到服务器',
                  });

                  toolManager.setActiveTool(null);
                }}
                activeTool={toolManager.activeTool}
                setActiveTool={toolManager.setActiveTool}
                containerRef={canvasRef}
                textEditToolRef={textEditToolRef}
                aiEditToolRef={aiEditToolRef}
                onIsAIEditGeneratingChange={setIsAIEditGenerating}
                onLayersChange={setTextLayers}
                onSelectedLayerChange={setSelectedLayerId}
                onIsDraggingChange={setIsDragging}
                onIsResizingChange={setIsResizing}
                initialText={editorState.pages[editorState.currentPageIndex]?.text || ''}
              />
            </>
          )}
        </div>
      </div>

      {/* 对话框 */}
      <DownloadDialog
        open={editorState.dialogs.download}
        onOpenChange={(open) => editorState.setDialogState('download', open)}
        onConfirm={handleDownloadConfirm}
      />

      <TerminateConfirmDialog
        open={editorState.dialogs.terminate}
        onOpenChange={(open) => editorState.setDialogState('terminate', open)}
        onConfirm={handleTerminate}
      />

      <InsertPageDialog
        open={editorState.dialogs.insertPage}
        onOpenChange={(open) => editorState.setDialogState('insertPage', open)}
        storybook={editorState.currentStorybook}
        onInsert={handleInsertPages}
      />

      <GenerateCoverDialog
        open={editorState.dialogs.cover}
        onOpenChange={(open) => editorState.setDialogState('cover', open)}
        storybook={editorState.currentStorybook}
        onGenerate={handleGenerateCover}
      />

      <BackCoverDialog
        open={editorState.dialogs.backCover}
        onOpenChange={(open) => editorState.setDialogState('backCover', open)}
        storybook={editorState.currentStorybook}
        onBackCoverCreated={async () => {
          if (editorState.currentStorybook) {
            await loadStorybook(editorState.currentStorybook.id);
          }
        }}
      />

      {/* 未保存提示对话框 */}
      <ConfirmDialog
        open={editorState.dialogs.unsavedSwitch}
        title="未保存的修改"
        description="当前页面有未保存的修改，切换页面将丢失这些修改。是否继续？"
        confirmText="放弃修改"
        cancelText="留在当前页"
        onConfirm={confirmPageSwitch}
        onCancel={cancelPageSwitch}
      />
    </>
  );
};

export default EditorView;
