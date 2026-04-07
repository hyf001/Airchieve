/**
 * EditorView - 绘本编辑器主组件
 * 经过模块化重构的版本
 */

import React, { useEffect } from 'react';
import {
  deleteStorybook,
  updateStorybookPublicStatus,
  downloadStorybookImage,
  terminateStorybook,
  insertPages,
  generateCover,
  InsufficientPointsError,
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
                onIndexChange={editorState.setCurrentPageIndex}
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
              />

              {/* 右侧：工具栏 */}
              <ToolPanelWithSelector
                storybookId={editorState.currentStorybook.id}
                baseImageUrl={editorState.pages[editorState.currentPageIndex]?.image_url || ''}
                onPageEdited={(imageUrl: string) => {
                  // 处理图片编辑完成
                  console.log('图片编辑完成:', imageUrl);
                }}
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
    </>
  );
};

export default EditorView;
