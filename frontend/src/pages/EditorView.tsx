/**
 * EditorView - 绘本编辑器主组件
 * 经过模块化重构的版本
 */
import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  deleteStorybook,
  updateStorybookPublicStatus,
  terminateStorybook,
  insertPages,
  generateCover,
  savePage,
  InsufficientPointsError,
  getPageDetail,
  StorybookLayer,
} from '../services/storybookService';
import { exportStorybook, ExportOptions } from '../services/exportService';
import { useToast } from '@/hooks/use-toast';

// 导入重构后的组件
import {
  EditorHeader,
  StorybookList,
  PageNavigator,
  EditorCanvas,
} from '../components/editor';
import { ToolPanelWithSelector } from '../components/editor/tools/ToolPanel';
import { TextEditToolRef, TextLayerViewModel } from '../components/editor/tools/text-edit/types';
import { AIEditRef } from '../components/editor/tools/ai-edit/types';

// 导入对话框组件
import {
  DownloadDialog,
  TerminateConfirmDialog,
  InsertPageDialog,
  GenerateCoverDialog,
  BackCoverDialog,
} from '../components/editor/dialogs';

// 导入 Hooks
import { useEditorState } from '@/hooks/useEditorState';
import { useStorybookLoader } from '@/hooks/useStorybookLoader';
import { useToolManager } from '@/hooks/useToolManager';
import { OptionalToolId } from '@/types/tool';

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

  // ========== 文字工具状态 ==========
  const textEditToolRef = useRef<TextEditToolRef>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  // text-edit 内部管理的状态，由 text-edit Panel 通过回调通知 EditorCanvas
  const [textLayers, setTextLayers] = useState<TextLayerViewModel[]>([]);
  const [textSelectedLayerId, setTextSelectedLayerId] = useState<number | null>(null);
  const [textIsDragging, setTextIsDragging] = useState(false);
  const [textIsResizing, setTextIsResizing] = useState(false);
  const exportAbortControllerRef = useRef<AbortController | null>(null);

  // ========== 页面图层状态（唯一可信数据源） ==========
  const [pageLayers, setPageLayers] = useState<StorybookLayer[]>([]);

  // 刷新当前页面数据（与切页加载逻辑一致）
  const refreshCurrentPage = useCallback(() => {
    const page = editorState.pages[editorState.currentPageIndex];
    if (!page) return;
    getPageDetail(page.id).then(detail => {
      editorState.setCurrentStorybook({
        ...editorState.currentStorybook!,
        pages: editorState.pages.map((p, i) =>
          i === editorState.currentPageIndex
            ? { ...p, image_url: detail.image_url, text: detail.text, storyboard: detail.storyboard }
            : p
        ),
      });
      setPageLayers(detail.layers || []);
    }).catch(() => {});
  }, [editorState.pages, editorState.currentPageIndex, editorState.currentStorybook, editorState.setCurrentStorybook]);

  const handleActiveToolChange = useCallback((toolId: OptionalToolId) => {
    if (toolManager.activeTool === 'text' && toolId !== 'text') {
      void textEditToolRef.current?.commitCurrentEdits();
    }
    toolManager.setActiveTool(toolId);
  }, [toolManager]);

  // 组件卸载前提交
  useEffect(() => {
    return () => {
      void textEditToolRef.current?.commitCurrentEdits();
      exportAbortControllerRef.current?.abort();
    };
  }, []);

  // ========== AI改图工具状态 ==========
  const aiEditToolRef = useRef<AIEditRef>(null);
  const [isAIEditGenerating, setIsAIEditGenerating] = useState(false);

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

  // ========== 切换绘本时清理图层状态 ==========
  const prevStorybookIdRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const currentId = editorState.currentStorybook?.id;
    if (currentId !== undefined && currentId !== prevStorybookIdRef.current) {
      prevStorybookIdRef.current = currentId;
      // 清理上一个绘本的图层和编辑状态
      setTextLayers([]);
      setTextSelectedLayerId(null);
      setTextIsDragging(false);
      setTextIsResizing(false);
      setPageLayers([]);
      prevPageIndexRef.current = -1;
    }
  }, [editorState.currentStorybook?.id]);

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

  const handleExportConfirm = async (options: ExportOptions) => {
    if (!editorState.currentStorybook) return;

    // Commit any in-progress text edits before export
    await textEditToolRef.current?.commitCurrentEdits();

    editorState.setExportState({ isExporting: true, progress: 0 });
    const abortController = new AbortController();
    exportAbortControllerRef.current = abortController;

    try {
      await exportStorybook(
        editorState.currentStorybook,
        options,
        (_stage, progress) => {
          editorState.setExportState({ progress: Math.round(progress) });
        },
        { signal: abortController.signal },
      );
      editorState.setExportState({ progress: 100 });
      editorState.setDialogState('export', false);
      toast({ title: '导出成功' });
    } catch (err) {
      if (err instanceof Error && err.message === '导出已取消') {
        editorState.setDialogState('export', false);
        toast({ title: '已取消导出' });
        return;
      }
      toast({
        variant: 'destructive',
        title: '导出失败',
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      exportAbortControllerRef.current = null;
      editorState.setExportState({ isExporting: false });
    }
  };

  const handleExportCancel = useCallback(() => {
    exportAbortControllerRef.current?.abort();
  }, []);

  const handleTerminate = async () => {
    if (!editorState.currentStorybook || editorState.isTerminating) return;

    try {
      await terminateStorybook(editorState.currentStorybook.id);
      toast({ title: '已中止' });
      stopPolling();
      // 重新加载绘本数据，确保页面状态同步（移除"生成中"的未完成页面）
      await loadStorybook(editorState.currentStorybook.id);
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

  // ========== 页面切换 ==========
  const prevPageIndexRef = useRef<number>(-1);

  // 安全切页：先提交当前编辑，再切换页面索引
  const safeSwitchPage = useCallback((newIndex: number) => {
    if (newIndex === editorState.currentPageIndex) return;
    void (async () => {
      await textEditToolRef.current?.commitCurrentEdits();
      editorState.setCurrentPageIndex(newIndex);
    })();
  }, [editorState.currentPageIndex, editorState.setCurrentPageIndex]);

  // 页面切换
  const handlePageChange = (newIndex: number) => {
    if (newIndex === editorState.currentPageIndex) return;
    safeSwitchPage(newIndex);
  };

  useEffect(() => {
    // 只在页面索引变化时从后台获取最新页面详情
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
        // 存储页面图层（唯一可信数据源）
        setPageLayers(detail.layers || []);
      }).catch(() => {
        // 接口失败时用本地数据兜底
        setPageLayers([]);
      });
      prevPageIndexRef.current = editorState.currentPageIndex;
    }
  }, [editorState.currentPageIndex, editorState.pages]);

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

  // 当前页面 ID（用于传给 text-edit）
  const currentPageId = editorState.pages[editorState.currentPageIndex]?.id;

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
          onExport={() => editorState.setDialogState('export', true)}
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
                isTerminated={editorState.currentStorybook?.status === 'terminated'}
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
                exportProgress={editorState.export.progress}
                isExporting={editorState.export.isExporting}
                onPageIndexChange={safeSwitchPage}
                onTerminateClick={() => editorState.setDialogState('terminate', true)}
                isTerminating={editorState.isTerminating}
                onBack={onBack}
                activeTool={toolManager.activeTool}
                textEditToolRef={textEditToolRef}
                textLayers={textLayers}
                selectedLayerId={textSelectedLayerId}
                isDragging={textIsDragging}
                isResizing={textIsResizing}
                canvasRef={canvasRef}
                aiEditToolRef={aiEditToolRef}
                isAIEditGenerating={isAIEditGenerating}
                pageLayers={pageLayers}
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

                  toast({
                    title: '图片已更新（本地预览）',
                    description: '点击保存按钮将更改保存到服务器',
                  });

                  handleActiveToolChange(null);
                }}
                activeTool={toolManager.activeTool}
                setActiveTool={handleActiveToolChange}
                containerRef={canvasRef}
                textEditToolRef={textEditToolRef}
                pageId={currentPageId}
                initialLayers={pageLayers}
                pageText={editorState.pages[editorState.currentPageIndex]?.text || ''}
                aiEditToolRef={aiEditToolRef}
                onIsAIEditGeneratingChange={setIsAIEditGenerating}
                onTextLayersChange={setTextLayers}
                onTextSelectedLayerChange={setTextSelectedLayerId}
                onTextIsDraggingChange={setTextIsDragging}
                onTextIsResizingChange={setTextIsResizing}
                onLayerPersisted={refreshCurrentPage}
              />
            </>
          )}
        </div>
      </div>

      {/* 对话框 */}
      <DownloadDialog
        open={editorState.dialogs.export}
        onOpenChange={(open) => {
          if (!open && editorState.export.isExporting) {
            handleExportCancel();
            return;
          }
          editorState.setDialogState('export', open);
        }}
        onConfirm={handleExportConfirm}
        onCancelExport={handleExportCancel}
        isExporting={editorState.export.isExporting}
        currentPageIndex={editorState.currentPageIndex}
        pages={editorState.pages}
        exportProgress={editorState.export.progress}
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
    </>
  );
};

export default EditorView;
