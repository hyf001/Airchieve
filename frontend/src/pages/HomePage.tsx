import React from "react";

import { Button } from "@/components/ui/button";
import { AppShell } from "@/shared/layout/AppShell";
import { AppLink } from "@/shared/ui/AppLink";

const continueItems = [
  { title: "月亮邮局", page: "读到第 8 页", width: "62%", className: "from-[#FFE0B2] to-[#FFB74D]" },
  { title: "森林里的小裁缝", page: "读到第 3 页", width: "28%", className: "from-[#C8E6C9] to-[#81C784]" },
  { title: "会唱歌的云朵", page: "读到第 12 页", width: "86%", className: "from-[#E1BEE7] to-[#BA68C8]" },
];

const scenes = ["睡前", "勇气", "朋友", "自然", "想象", "习惯"];
const sceneEmoji = ["🌙", "🦁", "🤝", "🌿", "✨", "🌱"];

const books = [
  ["小兔子的雨天", "🐰", "免费", "bc1"],
  ["星星采集员", "⭐", "VIP", "bc2"],
  ["蓝鲸的歌", "🐋", "免费", "bc3"],
  ["太阳面包店", "☀️", "VIP", "bc4"],
  ["云朵巴士", "☁️", "免费", "bc5"],
];

const quickCreate = [
  ["从一句话开始", "💬", "输入灵感生成故事"],
  ["上传孩子照片", "🧒", "定制主角形象"],
  ["选择画风", "🎨", "水彩、蜡笔、睡前"],
  ["录制声音", "🎙️", "家人声音陪伴"],
];

export const HomePage: React.FC = () => (
  <AppShell>
    <section className="mx-auto mt-8 max-w-[1320px] px-8 max-sm:px-4">
      <div className="relative flex h-[380px] items-end overflow-hidden rounded-[var(--radius-xl)] bg-[linear-gradient(135deg,#FFECD2_0%,#FCB69F_50%,#F5A623_100%)] shadow-[var(--shadow-soft)] max-md:h-auto max-md:min-h-[280px]">
        <div className="absolute inset-0 overflow-hidden">
          <span className="absolute -top-[60px] right-[10%] h-[300px] w-[300px] rounded-full bg-[var(--sage)] opacity-15" />
          <span className="absolute -bottom-10 left-[5%] h-[200px] w-[200px] rounded-full bg-[var(--sky)] opacity-15" />
          <span className="absolute right-[30%] top-[20%] h-[120px] w-[120px] rounded-full bg-[var(--lavender)] opacity-15" />
          <span className="absolute bottom-[30%] left-[40%] h-20 w-20 rounded-full bg-white opacity-20" />
        </div>

        <div className="absolute right-[60px] top-1/2 h-[280px] w-[320px] -translate-y-1/2 max-md:hidden">
          <div className="absolute bottom-2.5 left-5 h-[220px] w-[180px] -rotate-[8deg] rounded-xl bg-[linear-gradient(160deg,#B39DDB,#7E57C2)] shadow-[0_8px_32px_rgba(0,0,0,0.1)]" />
          <div className="absolute bottom-5 left-[60px] h-[210px] w-[170px] rotate-2 rounded-xl bg-[linear-gradient(160deg,#8BC6A8,#4CAF50)] shadow-[0_8px_32px_rgba(0,0,0,0.1)]" />
          <div className="absolute bottom-[30px] left-[100px] z-[2] h-60 w-[190px] -rotate-2 rounded-xl bg-[linear-gradient(160deg,#FF8A65,#F4511E)] shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
            <span className="absolute bottom-5 left-2 top-5 w-[3px] rounded-sm bg-white/30" />
            <span className="absolute left-6 right-4 top-[50px] h-1 rounded-sm bg-white/25" />
            <span className="absolute left-6 top-[62px] h-1 w-[70%] rounded-sm bg-white/25" />
            <span className="absolute left-6 top-[74px] h-1 w-1/2 rounded-sm bg-white/25" />
          </div>
          <span className="absolute right-[50px] top-2.5 animate-[float_3s_ease-in-out_infinite] text-[28px]">⭐</span>
          <span className="absolute right-40 top-[60px] animate-[float_3s_ease-in-out_0.5s_infinite] text-xl">✨</span>
          <span className="absolute bottom-20 right-[260px] animate-[float_3s_ease-in-out_1s_infinite] text-2xl">🌙</span>
        </div>

        <div className="relative z-[3] w-[55%] p-12 max-md:w-full max-md:p-6">
          <span className="mb-3.5 inline-block rounded-full bg-white/30 px-3.5 py-1 text-xs font-semibold backdrop-blur">
            🎉 本周精选
          </span>
          <h1 className="font-display mb-2.5 text-4xl leading-[1.3] max-md:text-[26px]">
            每个孩子都值得
            <br />
            一个专属故事
          </h1>
          <p className="mb-6 max-w-[400px] text-[15px] text-[var(--text-mid)]">
            用AI为你的孩子生成独一无二的绘本故事，选择喜欢的画风和声音，让阅读变得更有温度
          </p>
          <div className="flex gap-3 max-sm:flex-col">
            <Button asChild size="lg" className="bg-white text-[var(--terracotta)] shadow-[0_4px_16px_rgba(0,0,0,0.1)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.15)]">
              <AppLink to="/player">📖 开始阅读</AppLink>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 bg-white/20 text-[var(--text-dark)] backdrop-blur">
              <AppLink to="/create">✨ 创建绘本</AppLink>
            </Button>
          </div>
        </div>
      </div>
    </section>

    <section className="mx-auto mt-7 max-w-[1320px] px-8 max-sm:px-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-[13px] font-semibold text-[var(--text-light)]">年龄：</span>
        {["全部", "3-5岁", "6-8岁", "9-12岁"].map((age, index) => (
          <button
            key={age}
            className={`rounded-3xl border-[1.5px] px-5 py-2 text-[13px] font-semibold transition-all ${
              index === 0
                ? "border-transparent bg-[linear-gradient(135deg,var(--peach),var(--terracotta))] text-white shadow-[0_3px_12px_rgba(212,114,92,0.25)]"
                : "border-[rgba(212,114,92,0.12)] bg-white text-[var(--text-mid)]"
            }`}
          >
            {age}
          </button>
        ))}
      </div>
    </section>

    <HomeSection title="继续阅读" more="查看全部">
      <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
        {continueItems.map((item) => (
          <AppLink key={item.title} to="/player" className="app-card app-card-hover flex items-center gap-3.5 p-3.5 text-inherit no-underline">
            <span className={`h-20 w-20 shrink-0 rounded-[var(--radius-sm)] bg-gradient-to-br ${item.className}`} />
            <span className="min-w-0 flex-1">
              <span className="mb-1 block truncate text-sm font-semibold">{item.title}</span>
              <span className="mb-2 block text-xs text-[var(--text-light)]">{item.page}</span>
              <span className="block h-1 overflow-hidden rounded-sm bg-[rgba(212,114,92,0.12)]">
                <span className="block h-full rounded-sm bg-[linear-gradient(90deg,var(--peach),var(--terracotta))]" style={{ width: item.width }} />
              </span>
            </span>
          </AppLink>
        ))}
      </div>
    </HomeSection>

    <HomeSection title="场景入口" more="更多主题">
      <div className="grid grid-cols-6 gap-3 max-md:grid-cols-3">
        {scenes.map((scene, index) => (
          <AppLink key={scene} to="/stories" className="app-card app-card-hover px-2.5 py-5 text-center text-inherit no-underline">
            <span className="mb-2 block text-[32px]">{sceneEmoji[index]}</span>
            <span className="text-[13px] font-semibold text-[var(--text-mid)]">{scene}</span>
          </AppLink>
        ))}
      </div>
    </HomeSection>

    <HomeSection title="推荐绘本" more="进入故事库">
      <div className="grid grid-cols-5 gap-[18px] max-md:grid-cols-2 max-sm:gap-2.5">
        {books.map(([title, emoji, badge], index) => (
          <AppLink key={title} to="/book-detail" className="app-card app-card-hover overflow-hidden text-inherit no-underline">
            <span className={`relative flex aspect-[3/4] items-center justify-center bg-gradient-to-br text-5xl ${
              index === 0 ? "from-[#FFCDD2] to-[#E57373]" : index === 1 ? "from-[#C8E6C9] to-[#81C784]" : index === 2 ? "from-[#BBDEFB] to-[#64B5F6]" : index === 3 ? "from-[#FFF9C4] to-[#FFEE58]" : "from-[#E1BEE7] to-[#AB47BC]"
            }`}>
              {emoji}
              <span className={`absolute right-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-bold text-white ${badge === "VIP" ? "bg-[linear-gradient(135deg,var(--honey),#F4A020)]" : "bg-[rgba(139,198,168,0.9)]"}`}>
                {badge}
              </span>
            </span>
            <span className="block p-3.5 pb-4">
              <span className="mb-1.5 block truncate text-sm font-bold">{title}</span>
              <span className="inline-flex rounded-[10px] bg-[rgba(212,114,92,0.08)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-mid)]">
                睡前故事
              </span>
            </span>
          </AppLink>
        ))}
      </div>
    </HomeSection>

    <HomeSection title="快速创建" more="创建中心">
      <div className="grid grid-cols-4 gap-3.5 max-md:grid-cols-2">
        {quickCreate.map(([label, icon, sub]) => (
          <AppLink key={label} to="/create" className="app-card app-card-hover relative overflow-hidden px-[18px] py-6 text-center text-inherit no-underline">
            <span className="absolute left-0 right-0 top-0 h-[3px] bg-[var(--peach)]" />
            <span className="mb-2.5 block text-4xl">{icon}</span>
            <span className="mb-1 block text-sm font-bold">{label}</span>
            <span className="text-xs text-[var(--text-light)]">{sub}</span>
          </AppLink>
        ))}
      </div>
    </HomeSection>

    <footer className="mx-auto mt-10 max-w-[1320px] px-8 pb-8 text-center text-xs text-[var(--text-light)]">
      <div className="mb-3 flex justify-center gap-5 text-[13px] text-[var(--text-mid)]">
        <AppLink to="/share" className="text-inherit no-underline">分享</AppLink>
        <AppLink to="/membership" className="text-inherit no-underline">会员</AppLink>
        <AppLink to="/auth" className="text-inherit no-underline">登录</AppLink>
      </div>
      <p>毛毛虫绘本 · 原型风格前端骨架</p>
    </footer>
  </AppShell>
);

const HomeSection: React.FC<React.PropsWithChildren<{ title: string; more: string }>> = ({
  title,
  more,
  children,
}) => (
  <section className="mx-auto mt-9 max-w-[1320px] px-8 max-sm:px-4">
    <div className="mb-[18px] flex items-center justify-between">
      <h2 className="font-display flex items-center gap-2 text-[22px]">{title}</h2>
      <AppLink to="/stories" className="text-[13px] font-medium text-[var(--text-light)] no-underline hover:text-[var(--terracotta)]">
        {more}
      </AppLink>
    </div>
    {children}
  </section>
);
