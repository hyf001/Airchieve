export type AppView = "home" | "editor";

export interface StorybookSummary {
  id: number;
  title: string;
  status: "draft" | "generating" | "finished";
  pages: number;
  updatedAt: string;
}
