import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImageStyleAssetsView from "./ImageStyleAssetsView";

// ---- mocks ----

const toastMock = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/services/storybookService", () => ({
  toApiUrl: (url: string) => `/api/v1/oss/${encodeURIComponent(url)}`,
}));

const mockAssets = [
  {
    id: 1, url: "https://cdn.example.com/a.png", object_key: "a.png",
    name: "水彩参考", description: null, tags: ["水彩"], style_type: "水彩",
    color_tags: [], texture_tags: [], scene_tags: [], subject_tags: [],
    composition_tags: [], age_group_tags: [], content_type: "image/png",
    file_size: 1024, width: 100, height: 80, is_active: true,
    reference_count: 2, creator: "admin", modifier: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: 2, url: "https://cdn.example.com/b.png", object_key: "b.png",
    name: "停用图", description: null, tags: [], style_type: null,
    color_tags: [], texture_tags: [], scene_tags: [], subject_tags: [],
    composition_tags: [], age_group_tags: [], content_type: "image/png",
    file_size: 2048, width: null, height: null, is_active: false,
    reference_count: 0, creator: "admin", modifier: null,
    created_at: "2026-01-02T00:00:00Z", updated_at: "2026-01-02T00:00:00Z",
  },
];

const listMock = vi.fn().mockResolvedValue(mockAssets);
const updateMock = vi.fn().mockResolvedValue({ ...mockAssets[1], is_active: true });
const deleteMock = vi.fn().mockResolvedValue(undefined);
const uploadMock = vi.fn().mockResolvedValue(mockAssets[0]);

vi.mock("@/services/imageStyleService", () => ({
  listImageStyleAssets: (...args: unknown[]) => listMock(...args),
  updateImageStyleAsset: (...args: unknown[]) => updateMock(...args),
  deleteImageStyleAsset: (...args: unknown[]) => deleteMock(...args),
  uploadImageStyleAsset: (...args: unknown[]) => uploadMock(...args),
}));

describe("ImageStyleAssetsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue(mockAssets);
  });

  it("renders title and upload button", async () => {
    render(<ImageStyleAssetsView onBack={vi.fn()} />);
    expect(screen.getByText("风格图片库")).toBeInTheDocument();
    expect(screen.getByText("上传图片")).toBeInTheDocument();
    await waitFor(() => expect(listMock).toHaveBeenCalled());
  });

  it("renders asset cards after loading", async () => {
    render(<ImageStyleAssetsView onBack={vi.fn()} />);
    expect(await screen.findByText("水彩参考")).toBeInTheDocument();
    expect(screen.getByText("停用图")).toBeInTheDocument();
  });

  it("shows file input when upload button is clicked", async () => {
    const user = userEvent.setup();
    render(<ImageStyleAssetsView onBack={vi.fn()} />);
    await screen.findByText("水彩参考");

    await user.click(screen.getByText("上传图片"));
    expect(screen.getByText("上传图片资产")).toBeInTheDocument();
    expect(screen.getByText("图片文件")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<ImageStyleAssetsView onBack={onBack} />);
    await screen.findByText("水彩参考");

    await user.click(screen.getByText("返回"));
    expect(onBack).toHaveBeenCalled();
  });

  it("toggles asset active state via switch", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue({ ...mockAssets[1], is_active: true });
    render(<ImageStyleAssetsView onBack={vi.fn()} />);
    const switches = await screen.findAllByRole("switch");
    // second asset is inactive, click to activate
    await user.click(switches[1]);

    expect(updateMock).toHaveBeenCalledWith(2, { is_active: true });
  });

  it("opens delete confirm dialog and calls delete on confirm", async () => {
    const user = userEvent.setup();
    render(<ImageStyleAssetsView onBack={vi.fn()} />);
    const deleteButtons = (await screen.findAllByRole("button")).filter(
      (btn) => btn.querySelector('[data-testid="trash-icon"]') || btn.innerHTML.includes("Trash2")
    );
    // use the last delete button (for the unreferenced asset)
    const trashButtons = screen.getAllByRole("button").filter((b) => {
      const svg = b.querySelector("svg");
      return svg && b.classList.contains("text-red-600");
    });
    await user.click(trashButtons[1]); // second asset has 0 references

    expect(screen.getByText(/确认删除/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(2));
  });
});
