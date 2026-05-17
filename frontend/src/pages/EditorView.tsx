import React, { useCallback } from "react";
import { ArrowLeft, Image, Layers, MousePointer2, Save, Type } from "lucide-react";

import { EditorCanvas, PageNavigator } from "@/components/editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  onBack: () => void;
}

const EditorView: React.FC<Props> = ({ onBack }) => {
  const handleSave = useCallback(() => {
    window.console.info("save draft");
  }, []);

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="返回">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-sm font-medium">星空邮差</p>
            <p className="text-xs text-muted-foreground">编辑器</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          保存
        </Button>
      </header>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[72px_1fr_320px]">
        <aside className="flex gap-2 border-b border-border p-3 lg:flex-col lg:border-b-0 lg:border-r">
          {[MousePointer2, Type, Image, Layers].map((Icon, index) => (
            <Button key={index} variant={index === 0 ? "secondary" : "ghost"} size="icon">
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </aside>

        <section className="flex items-center justify-center bg-secondary/30 p-6">
          <EditorCanvas />
        </section>

        <aside className="border-t border-border p-4 lg:border-l lg:border-t-0">
          <Card>
            <CardContent className="space-y-4 p-4">
              <div>
                <h2 className="text-base font-semibold">页面属性</h2>
                <p className="text-sm text-muted-foreground">第 1 页，共 12 页</p>
              </div>
              <PageNavigator pages={6} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
};

export default EditorView;
