import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImageStylesView from "./ImageStylesView";

// ---- mocks ----

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/services/storybookService", () => ({
  toApiUrl: (url: string) => `/api/v1/oss/${encodeURIComponent(url)}`,
}));

const mockStyles = [
  {
    id: 1, name: "水彩童话", description: "柔和水彩", cover_image: "https://cdn.example.com/cover.png",
    tags: ["水彩", "温暖"], current_version_id: 11, current_version_no: "v1",
    is_active: true, sort_order: 10, updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 2, name: "卡通风", description: null, cover_image: null,
    tags: [], current_version_id: null, current_version_no: null,
    is_active: false, sort_order: 5, updated_at: "2026-01-02T00:00:00Z",
  },
];

const draftVersion = {
  id: 12, image_style_id: 1, version_no: "v2", status: "draft",
  style_summary: "草稿摘要", style_description: "描述", generation_prompt: "提示词",
  negative_prompt: "负面", reference_images: [], creator: "admin",
  created_at: "2026-01-03T00:00:00Z", published_at: null,
};

const publishedVersion = {
  id: 11, image_style_id: 1, version_no: "v1", status: "published",
  style_summary: "已发布摘要", style_description: "描述", generation_prompt: "提示词",
  negative_prompt: "负面", reference_images: [], creator: "admin",
  created_at: "2026-01-01T00:00:00Z", published_at: "2026-01-01T12:00:00Z",
};

const listAdminMock = vi.fn().mockResolvedValue(mockStyles);
const createStyleMock = vi.fn().mockResolvedValue({ id: 3 });
const updateStyleMock = vi.fn().mockResolvedValue({});
const listVersionsMock = vi.fn().mockResolvedValue([publishedVersion, draftVersion]);
const createVersionMock = vi.fn().mockResolvedValue(draftVersion);
const updateVersionMock = vi.fn().mockResolvedValue(draftVersion);
const deleteVersionMock = vi.fn().mockResolvedValue(undefined);
const publishVersionMock = vi.fn().mockResolvedValue({ ...draftVersion, status: "published" });
const listAssetsMock = vi.fn().mockResolvedValue([]);
const createRefImageMock = vi.fn().mockResolvedValue({ id: 50, asset_id: 1 });
const updateRefImageMock = vi.fn().mockResolvedValue({});
const deleteRefImageMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/services/imageStyleService", () => ({
  listAdminImageStyles: (...args: unknown[]) => listAdminMock(...args),
  createImageStyle: (...args: unknown[]) => createStyleMock(...args),
  updateImageStyle: (...args: unknown[]) => updateStyleMock(...args),
  listImageStyleVersions: (...args: unknown[]) => listVersionsMock(...args),
  createImageStyleVersion: (...args: unknown[]) => createVersionMock(...args),
  updateImageStyleVersion: (...args: unknown[]) => updateVersionMock(...args),
  deleteImageStyleVersion: (...args: unknown[]) => deleteVersionMock(...args),
  publishImageStyleVersion: (...args: unknown[]) => publishVersionMock(...args),
  listImageStyleAssets: (...args: unknown[]) => listAssetsMock(...args),
  createImageStyleReferenceImage: (...args: unknown[]) => createRefImageMock(...args),
  updateImageStyleReferenceImage: (...args: unknown[]) => updateRefImageMock(...args),
  deleteImageStyleReferenceImage: (...args: unknown[]) => deleteRefImageMock(...args),
}));

describe("ImageStylesView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAdminMock.mockResolvedValue(mockStyles);
    listVersionsMock.mockResolvedValue([publishedVersion, draftVersion]);
  });

  it("renders style list with names and statuses", async () => {
    render(<ImageStylesView onBack={vi.fn()} />);
    expect(await screen.findByText("水彩童话")).toBeInTheDocument();
    expect(screen.getByText("卡通风")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("未发布")).toBeInTheDocument();
  });

  it("opens create style dialog", async () => {
    const user = userEvent.setup();
    render(<ImageStylesView onBack={vi.fn()} />);
    await screen.findByText("水彩童话");

    await user.click(screen.getByText("创建风格"));
    expect(screen.getByText("名称")).toBeInTheDocument();
  });

  it("creates a new style and reloads list", async () => {
    const user = userEvent.setup();
    render(<ImageStylesView onBack={vi.fn()} />);
    await screen.findByText("水彩童话");

    await user.click(screen.getByText("创建风格"));
    const nameInput = screen.getByPlaceholderText(/水彩/).closest("form")!
      .querySelector("input")!;
    await user.type(nameInput, "新风");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(createStyleMock).toHaveBeenCalled());
  });

  it("opens version manager when clicking version button", async () => {
    const user = userEvent.setup();
    render(<ImageStylesView onBack={vi.fn()} />);
    await screen.findByText("水彩童话");

    const versionButtons = screen.getAllByRole("button").filter((b) => b.textContent?.includes("版本"));
    await user.click(versionButtons[0]);

    await waitFor(() => expect(listVersionsMock).toHaveBeenCalledWith(1));
    expect(await screen.findByText(/版本管理/)).toBeInTheDocument();
  });

  it("shows draft and published versions in version list", async () => {
    const user = userEvent.setup();
    render(<ImageStylesView onBack={vi.fn()} />);
    await screen.findByText("水彩童话");

    const versionButtons = screen.getAllByRole("button").filter((b) => b.textContent?.includes("版本"));
    await user.click(versionButtons[0]);

    expect(await screen.findByText("已发布")).toBeInTheDocument();
    expect(screen.getByText("草稿")).toBeInTheDocument();
  });

  it("publishes a draft version", async () => {
    const user = userEvent.setup();
    publishVersionMock.mockResolvedValue({ ...draftVersion, status: "published" });
    render(<ImageStylesView onBack={vi.fn()} />);
    await screen.findByText("水彩童话");

    const versionButtons = screen.getAllByRole("button").filter((b) => b.textContent?.includes("版本"));
    await user.click(versionButtons[0]);
    await screen.findByText("草稿");

    const publishButtons = screen.getAllByRole("button").filter((b) => b.textContent === "发布");
    await user.click(publishButtons[0]);

    await waitFor(() => expect(publishVersionMock).toHaveBeenCalledWith(1, 12));
  });

  it("enters draft edit view and shows save button", async () => {
    const user = userEvent.setup();
    render(<ImageStylesView onBack={vi.fn()} />);
    await screen.findByText("水彩童话");

    const versionButtons = screen.getAllByRole("button").filter((b) => b.textContent?.includes("版本"));
    await user.click(versionButtons[0]);
    await screen.findByText("草稿");

    const editButtons = screen.getAllByRole("button").filter((b) => b.textContent.includes("编辑"));
    await user.click(editButtons[0]);

    expect(await screen.findByText("草稿可编辑")).toBeInTheDocument();
    expect(screen.getByText("保存草稿")).toBeInTheDocument();
  });

  it("published version shows view-only badge", async () => {
    const user = userEvent.setup();
    render(<ImageStylesView onBack={vi.fn()} />);
    await screen.findByText("水彩童话");

    const versionButtons = screen.getAllByRole("button").filter((b) => b.textContent?.includes("版本"));
    await user.click(versionButtons[0]);
    await screen.findByText("已发布");

    const viewButtons = screen.getAllByRole("button").filter((b) => b.textContent.includes("查看"));
    await user.click(viewButtons[0]);

    expect(await screen.findByText("已发布只读")).toBeInTheDocument();
    expect(screen.queryByText("保存草稿")).not.toBeInTheDocument();
  });

  it("deletes a draft version via confirm dialog", async () => {
    const user = userEvent.setup();
    render(<ImageStylesView onBack={vi.fn()} />);
    await screen.findByText("水彩童话");

    const versionButtons = screen.getAllByRole("button").filter((b) => b.textContent?.includes("版本"));
    await user.click(versionButtons[0]);
    await screen.findByText("草稿");

    const trashButtons = screen.getAllByRole("button").filter(
      (b) => b.querySelector("svg") && b.classList.contains("text-red-600")
    );
    await user.click(trashButtons[0]);

    expect(screen.getByText(/确认删除/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => expect(deleteVersionMock).toHaveBeenCalledWith(1, 12));
  });

  it("toggles style active state", async () => {
    const user = userEvent.setup();
    updateStyleMock.mockResolvedValue({});
    render(<ImageStylesView onBack={vi.fn()} />);
    await screen.findByText("水彩童话");

    const switches = screen.getAllByRole("switch");
    await user.click(switches[1]); // toggle inactive style

    await waitFor(() => expect(updateStyleMock).toHaveBeenCalledWith(2, { is_active: true }));
  });
});
