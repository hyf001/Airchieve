export type AppView = "home" | "editor";

export interface StorybookSummary {
  id: string;
  title: string;
  status: "draft" | "generating" | "finished";
  pages: number;
  updatedAt: string;
}
