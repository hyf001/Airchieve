import React, { useCallback } from "react";
import { BookOpen, Plus, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import AuthPanel from "@/components/auth/AuthPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { demoStorybooks } from "@/constants/storybooks";

interface Props {
  onOpenEditor: () => void;
}

const HomeView: React.FC<Props> = ({ onOpenEditor }) => {
  const handleCreate = useCallback(() => {
    onOpenEditor();
  }, [onOpenEditor]);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
        <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              AIrchieve Web
            </div>
            <h1 className="text-3xl font-semibold tracking-normal">绘本工作台</h1>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            新建绘本
          </Button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="grid content-start gap-4 md:grid-cols-2">
            {demoStorybooks.map((storybook) => (
              <Card key={storybook.id} className="glass-card">
                <CardHeader>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <CardTitle>{storybook.title}</CardTitle>
                  <CardDescription>{storybook.updatedAt}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{storybook.pages} 页</span>
                  <span className="rounded-md bg-secondary px-2 py-1 text-secondary-foreground">
                    {storybook.status}
                  </span>
                </CardContent>
              </Card>
            ))}
          </section>
          <aside className="lg:sticky lg:top-6">
            <AuthPanel />
          </aside>
        </div>
      </div>
    </main>
  );
};

export default HomeView;
