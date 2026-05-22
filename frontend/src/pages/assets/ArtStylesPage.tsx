import React, { useEffect, useMemo, useState } from "react";
import { Check, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ArtStyle } from "@/entities/asset";
import { useTaxonomyGroup } from "@/entities/taxonomy";
import { artStyleLibraryApi } from "@/features/art-style-library";
import { useAuth } from "@/features/auth";
import { cn } from "@/lib/utils";
import { AppShell } from "@/shared/layout/AppShell";
import { useToast } from "@/shared/ui/toast";

const recommendedCode = "cartoon";
const examples = ["像宫崎骏动画的风格", "温暖的粉色调，像棉花糖", "简约北欧风", "复古拼贴画风格", "梦幻星空紫色调"];
const ageLabels: Record<string, string> = {
  age_0_2: "0-2岁",
  age_3_4: "3-4岁",
  age_5_6: "5-6岁",
  age_7_8: "7-8岁",
  age_9_10: "9-10岁",
  "0-3": "0-3岁",
  "2-4": "2-4岁",
  "3-6": "3-6岁",
  "4-6": "4-6岁",
  "6+": "6岁以上",
};

export const ArtStylesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"system" | "custom">("system");
  const [artStyles, setArtStyles] = useState<ArtStyle[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const { isAuthenticated } = useAuth();
  const { labelMap: ageLabelMap } = useTaxonomyGroup("age_range");
  const { showToast } = useToast();

  const systemStyles = useMemo(() => artStyles.filter((style) => style.owner_user_id === null), [artStyles]);
  const customStyles = useMemo(() => artStyles.filter((style) => style.owner_user_id !== null), [artStyles]);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await artStyleLibraryApi.list();
      setArtStyles(response.items);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "画风库加载失败", "error");
      setArtStyles([]);
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelect = (style: ArtStyle) => {
    setSelectedId((current) => (current === style.id ? null : style.id));
    showToast(`已选择「${style.name}」画风`, "success");
  };

  const handleCreateCustom = async () => {
    const prompt = customPrompt.trim();
    if (!prompt) {
      showToast("请先描述你想要的画风", "error");
      return;
    }
    if (!isAuthenticated) {
      showToast("登录后可以生成自定义画风", "error");
      return;
    }

    setIsCreating(true);
    try {
      const style = await artStyleLibraryApi.createCustom({
        name: prompt.length > 16 ? `${prompt.slice(0, 16)}...` : prompt,
        description: prompt,
        prompt,
      });
      setSelectedId(style.id);
      setCustomPrompt("");
      await load();
      showToast("自定义画风已生成，可在创作中使用", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "自定义画风生成失败", "error");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AppShell>
      <main className="mx-auto max-w-[1280px] px-8 pb-12 max-sm:px-4">
        <header className="relative py-12 text-center max-sm:py-8">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[260px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(245,166,35,0.08),transparent_70%)]" />
          <h1 className="font-display relative text-[38px] leading-tight text-[var(--text-dark)] max-sm:text-[30px]">画风选择</h1>
          <p className="relative mx-auto mt-2 max-w-[520px] text-base leading-7 text-[var(--text-mid)]">
            选择你喜欢的画风，让绘本拥有独特的视觉风格。
          </p>
        </header>

        <div className="mb-8 flex justify-center">
          <div className="inline-flex rounded-full border border-[rgba(212,114,92,0.12)] bg-white p-1 shadow-[var(--shadow-soft)]">
            <TabButton active={activeTab === "system"} onClick={() => setActiveTab("system")}>
              系统画风
              <span className="rounded-full bg-[rgba(245,166,35,0.14)] px-2 py-0.5 text-xs text-[var(--honey)]">{systemStyles.length}</span>
            </TabButton>
            <TabButton active={activeTab === "custom"} onClick={() => setActiveTab("custom")}>
              自定义画风
              <span className="rounded-full bg-[rgba(139,198,168,0.16)] px-2 py-0.5 text-xs text-[var(--sage-deep)]">{customStyles.length}</span>
            </TabButton>
          </div>
        </div>

        {activeTab === "system" ? (
          <>
            <section>
              <SectionTitle title="系统画风" badge={`${systemStyles.length} 种精选`} />
              {isLoading ? (
                <div className="app-card p-7 text-sm text-[var(--text-light)]">正在加载画风库...</div>
              ) : systemStyles.length ? (
                <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
                  {systemStyles.map((style) => (
                    <StyleCard
                      key={style.id}
                      ageLabelMap={ageLabelMap}
                      selected={selectedId === style.id}
                      style={style}
                      onSelect={() => handleSelect(style)}
                    />
                  ))}
                </div>
              ) : (
                <div className="app-card p-7 text-sm text-[var(--text-light)]">画风库暂无数据，管理员配置后会展示在这里。</div>
              )}
            </section>
          </>
        ) : null}

        {activeTab === "custom" ? (
          <section id="custom-style">
          <SectionTitle title="自定义画风" />
          {isLoading ? (
            <div className="app-card mb-6 p-7 text-sm text-[var(--text-light)]">正在加载自定义画风...</div>
          ) : customStyles.length ? (
            <div className="mb-8 grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {customStyles.map((style) => (
                <StyleCard
                  key={style.id}
                  ageLabelMap={ageLabelMap}
                  selected={selectedId === style.id}
                  style={style}
                  onSelect={() => handleSelect(style)}
                />
              ))}
            </div>
          ) : (
            <div className="app-card mb-6 p-7 text-sm text-[var(--text-light)]">还没有自定义画风，可以先写一段描述生成。</div>
          )}
          <div className="app-card rounded-[20px] p-8 max-sm:p-5">
            <h3 className="font-display text-[22px] text-[var(--text-dark)]">描述你想要的画风</h3>
            <p className="mt-2 text-sm text-[var(--text-mid)]">用文字描述心中理想的画风，AI 会生成独一无二的艺术风格。</p>
            <textarea
              className="mt-4 min-h-[96px] w-full resize-y rounded-[14px] border-2 border-[rgba(61,44,44,0.1)] bg-[var(--cream)] px-4 py-3 text-sm text-[var(--text-dark)] outline-none transition focus:border-[var(--honey)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(245,166,35,0.1)]"
              placeholder="描述你想要的画风...例如：温暖的秋天色调，像油画一样的质感，画面细腻柔和"
              value={customPrompt}
              onChange={(event) => setCustomPrompt(event.target.value)}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  className="rounded-full border border-[rgba(61,44,44,0.08)] bg-white px-3.5 py-1.5 text-xs text-[var(--text-mid)] transition hover:border-[var(--honey)] hover:bg-[rgba(245,166,35,0.05)] hover:text-[var(--honey)]"
                  type="button"
                  onClick={() => setCustomPrompt(example)}
                >
                  {example}
                </button>
              ))}
            </div>
            <Button className="mt-5" disabled={isCreating} onClick={() => void handleCreateCustom()}>
              <Sparkles className="h-4 w-4" />
              {isCreating ? "生成中..." : "生成自定义画风"}
            </Button>
          </div>
        </section>
        ) : null}
      </main>
    </AppShell>
  );
};

const TabButton: React.FC<React.PropsWithChildren<{ active: boolean; onClick: () => void }>> = ({ active, children, onClick }) => (
  <button
    className={cn(
      "inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold transition max-sm:px-3",
      active ? "bg-[var(--terracotta)] text-white shadow-[0_3px_12px_rgba(212,114,92,0.24)]" : "text-[var(--text-mid)] hover:bg-[rgba(212,114,92,0.06)]",
    )}
    type="button"
    onClick={onClick}
  >
    {children}
  </button>
);

const SectionTitle: React.FC<{ title: string; badge?: string }> = ({ title, badge }) => (
  <h2 className="font-display mb-6 flex items-center gap-2 text-[24px] text-[var(--text-dark)]">
    {title}
    {badge ? (
      <span className="rounded-full bg-[linear-gradient(135deg,var(--honey),var(--peach))] px-2.5 py-1 text-xs font-bold text-white">
        {badge}
      </span>
    ) : null}
  </h2>
);

const StyleCard: React.FC<{
  ageLabelMap: Record<string, string>;
  style: ArtStyle;
  selected: boolean;
  onSelect: () => void;
}> = ({ ageLabelMap, style, selected, onSelect }) => (
  <article
    className={cn(
      "group relative overflow-hidden rounded-[20px] border-[2.5px] bg-white shadow-[var(--shadow-soft)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(61,44,44,0.12)]",
      selected ? "border-[var(--honey)] shadow-[0_0_0_3px_rgba(245,166,35,0.15),0_8px_32px_rgba(61,44,44,0.12)]" : "border-transparent",
    )}
  >
    {style.code === recommendedCode ? (
      <span className="absolute right-3.5 top-3.5 z-10 rounded-full bg-[linear-gradient(135deg,#FF6B6B,var(--terracotta))] px-3 py-1 text-xs font-bold text-white shadow-[0_2px_8px_rgba(212,114,92,0.3)]">
        推荐
      </span>
    ) : null}
    <button className="block w-full text-left" type="button" onClick={onSelect}>
      <div className="relative h-[200px] overflow-hidden bg-[linear-gradient(135deg,rgba(245,166,35,0.16),rgba(126,200,227,0.18))]">
        {style.example_url ? (
          <img alt={`${style.name}示例图`} className="h-full w-full object-cover" src={style.example_url} />
        ) : (
          <div className="flex h-full items-center justify-center text-sm font-bold text-[var(--text-light)]">暂无示例图</div>
        )}
      </div>
      <span
        className={cn(
          "absolute left-3.5 top-3.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--honey),var(--peach))] text-white shadow-[0_2px_8px_rgba(245,166,35,0.3)] transition",
          selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      >
        <Check className="h-4 w-4" />
      </span>
      <div className="p-5">
        <h3 className="font-display text-xl text-[var(--text-dark)]">{style.name}</h3>
        <p className="mt-2 min-h-[68px] text-[13px] leading-6 text-[var(--text-mid)]">{style.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {style.age_range_codes.map((code) => (
            <AgeTag key={code} code={code} label={ageLabelMap[code] ?? ageLabels[code]} />
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              style.access_level === "vip"
                ? "bg-[linear-gradient(135deg,rgba(245,166,35,0.15),rgba(255,138,101,0.15))] text-[var(--peach)]"
                : "bg-[rgba(139,198,168,0.15)] text-[var(--sage-deep)]",
            )}
          >
            {style.access_level === "vip" ? "VIP" : "免费"}
          </span>
          <span
            className={cn(
              "rounded-xl border-2 px-4 py-2 text-xs font-bold transition",
              selected
                ? "border-transparent bg-[linear-gradient(135deg,var(--honey),var(--peach))] text-white"
                : "border-[var(--honey)] text-[var(--honey)] group-hover:bg-[var(--honey)] group-hover:text-white",
            )}
          >
            {selected ? "已选择" : "选择此画风"}
          </span>
        </div>
      </div>
    </button>
  </article>
);

const AgeTag: React.FC<{ code: string; label?: string }> = ({ code, label }) => {
  const tone =
    code.includes("0") || code.includes("2")
      ? "bg-[rgba(139,198,168,0.15)] text-[var(--sage-deep)]"
      : code.includes("6+")
        ? "bg-[rgba(126,200,227,0.15)] text-[var(--sky-deep)]"
        : "bg-[rgba(245,166,35,0.12)] text-[var(--honey)]";
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", tone)}>{label ?? code}</span>;
};
