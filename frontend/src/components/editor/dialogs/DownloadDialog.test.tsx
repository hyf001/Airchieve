import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DownloadDialog } from './DownloadDialog';
import {
  DEFAULT_EXPORT_OPTIONS,
  type ExportOptions,
  type LongImageEstimate,
} from '@/services/exportService';
import type { StorybookPage } from '@/services/storybookService';

const { estimateLongImageMock } = vi.hoisted(() => ({
  estimateLongImageMock: vi.fn<() => Promise<LongImageEstimate>>(),
}));

vi.mock('@/services/exportService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/exportService')>();

  return {
    ...actual,
    estimateLongImage: estimateLongImageMock,
  };
});

const pages: StorybookPage[] = [
  {
    id: 1,
    text: 'Cover page',
    image_url: '/images/cover.png',
    page_type: 'cover',
  },
  {
    id: 2,
    text: 'First content page',
    image_url: '/images/page-1.png',
    page_type: 'content',
  },
  {
    id: 3,
    text: 'Back cover',
    image_url: '/images/back-cover.png',
    page_type: 'back_cover',
  },
];

const longImageEstimate: LongImageEstimate = {
  pageWidth: 800,
  pageHeight: 600,
  totalPages: pages.length,
  longHeight: 1800,
  willSplit: true,
  parts: 2,
};

const renderDialog = (
  props: Partial<ComponentProps<typeof DownloadDialog>> = {},
) => {
  const defaultProps: ComponentProps<typeof DownloadDialog> = {
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
    onCancelExport: vi.fn(),
    pages,
    isExporting: false,
    currentPageIndex: 1,
  };

  return render(<DownloadDialog {...defaultProps} {...props} />);
};

describe('DownloadDialog', () => {
  beforeEach(() => {
    estimateLongImageMock.mockReturnValue(new Promise(() => {}));
  });

  it('renders pdf export options and the current page preview by default', async () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: '导出作品' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'PDF' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('纸张尺寸')).toBeInTheDocument();
    expect(screen.getByText('纸张方向')).toBeInTheDocument();
    expect(screen.getByText('图片适配方式')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();

    const dialog = screen.getByRole('dialog', { name: '导出作品' });
    expect(within(dialog).getByRole('presentation')).toHaveAttribute(
      'src',
      '/images/page-1.png',
    );
    expect(screen.getByText('1')).toBeInTheDocument();

    await waitFor(() => expect(estimateLongImageMock).toHaveBeenCalledWith(pages));
  });

  it('updates the pdf preview when navigating pages', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: '上一页' }));

    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.queryByText('2 / 3')).not.toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();

    const dialog = screen.getByRole('dialog', { name: '导出作品' });
    expect(within(dialog).getByRole('presentation')).toHaveAttribute(
      'src',
      '/images/cover.png',
    );
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
  });

  it('shows long image estimates after switching to png', async () => {
    const user = userEvent.setup();
    estimateLongImageMock.mockResolvedValue(longImageEstimate);
    renderDialog();

    await user.click(screen.getByRole('tab', { name: 'PNG' }));

    expect(screen.queryByText('纸张尺寸')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '上一页' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'PNG' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('导出方式')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '长图' })).toHaveAttribute('aria-selected', 'true');

    expect(await screen.findByText('800 x 600 px')).toBeInTheDocument();
    expect(screen.getByText('3 页')).toBeInTheDocument();
    expect(screen.getByText('800 x 1800 px')).toBeInTheDocument();
    expect(screen.getByText('长图高度超过限制，将自动分为 2 个文件导出')).toBeInTheDocument();
    expect(screen.getAllByRole('presentation')).toHaveLength(pages.length);
  });

  it('submits zip export mode for image formats', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.click(screen.getByRole('tab', { name: 'PNG' }));
    await user.click(screen.getByRole('tab', { name: '压缩包' }));
    await user.click(screen.getByRole('button', { name: '导出' }));

    expect(onConfirm).toHaveBeenCalledWith({
      ...DEFAULT_EXPORT_OPTIONS,
      format: 'png',
      exportMode: 'zip',
    } satisfies ExportOptions);
  });

  it('submits the selected export options', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });

    await user.click(screen.getByRole('tab', { name: '横版' }));
    await user.click(screen.getByRole('tab', { name: '铺满裁切' }));
    await user.click(screen.getAllByRole('switch')[0]);
    await user.click(screen.getByRole('button', { name: '导出' }));

    expect(onConfirm).toHaveBeenCalledWith({
      ...DEFAULT_EXPORT_OPTIONS,
      orientation: 'landscape',
      fitMode: 'cover',
      safeMargin: true,
    } satisfies ExportOptions);
  });

  it('supports cancelling an active export without submitting again', async () => {
    const user = userEvent.setup();
    const onCancelExport = vi.fn();
    const onConfirm = vi.fn();
    renderDialog({ isExporting: true, onCancelExport, onConfirm });

    expect(screen.getByRole('button', { name: '导出中 0%' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '取消导出' }));

    expect(onCancelExport).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
