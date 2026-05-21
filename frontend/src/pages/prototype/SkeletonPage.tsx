import React from "react";
import { ArrowLeft } from "lucide-react";

import { type AppRoute, useRouter } from "@/app/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/shared/layout/AppShell";
import { AppLink } from "@/shared/ui/AppLink";
import { LoadingSpinner } from "@/shared/ui/loading";
import { Modal } from "@/shared/ui/modal";
import { useToast } from "@/shared/ui/toast";

const routeMeta: Record<AppRoute, { title: string; subtitle: string; eyebrow: string; icon: string }> = {
  "/": { title: "首页", subtitle: "发现好故事", eyebrow: "原型首页", icon: "📖" },
  "/stories": { title: "故事库", subtitle: "按年龄、主题和场景筛选绘本", eyebrow: "故事列表", icon: "📚" },
  "/artstyle": { title: "画风", subtitle: "选择水彩、蜡笔、卡通和睡前氛围", eyebrow: "视觉风格", icon: "🎨" },
  "/characters": { title: "形象", subtitle: "管理孩子、家人和故事角色形象", eyebrow: "角色资产", icon: "🧒" },
  "/membership": { title: "会员", subtitle: "查看生成权益、试听权益和家庭套餐", eyebrow: "会员权益", icon: "👑" },
  "/auth": { title: "欢迎回来", subtitle: "登录或注册后，可以继续阅读和创建专属绘本", eyebrow: "家长与老师账号", icon: "🔐" },
  "/profile": { title: "我的档案", subtitle: "保存孩子档案、阅读进度和个人素材", eyebrow: "个人中心", icon: "🌱" },
  "/create": { title: "创建绘本", subtitle: "从灵感、形象、画风、分镜到声音", eyebrow: "创作流程", icon: "✨" },
  "/player": { title: "绘本播放", subtitle: "沉浸式阅读和语音播放", eyebrow: "阅读器", icon: "▶️" },
  "/book-detail": { title: "绘本详情", subtitle: "查看简介、试看和推荐内容", eyebrow: "详情页", icon: "📘" },
  "/share": { title: "分享", subtitle: "生成家人可访问的分享入口", eyebrow: "分享页", icon: "🔗" },
  "/share/public": { title: "公开分享", subtitle: "只读播放家人分享的绘本", eyebrow: "分享播放", icon: "🔗" },
  "/admin": { title: "运营后台", subtitle: "聚合审核、统计和审计入口", eyebrow: "后台", icon: "🛠️" },
  "/voices": { title: "声音", subtitle: "选择旁白音色或录制家人声音", eyebrow: "声音库", icon: "🎙️" },
};

export const SkeletonPage: React.FC<{ route: AppRoute }> = ({ route }) => {
  const [modalOpen, setModalOpen] = React.useState(false);
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const meta = routeMeta[route];
  const useTopBar = route === "/create" || route === "/player";

  const content = (
    <main className="mx-auto max-w-[1160px] px-8 py-11 max-sm:px-4">
      <section className="grid grid-cols-[minmax(0,1fr)_360px] gap-8 max-lg:grid-cols-1">
        <div>
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[rgba(139,198,168,0.16)] px-3 py-1.5 text-[13px] font-bold text-[var(--sage-deep)]">
            {meta.icon} {meta.eyebrow}
          </span>
          <h1 className="font-display mb-3 text-[42px] leading-[1.15] max-sm:text-[30px]">{meta.title}</h1>
          <p className="max-w-[560px] text-base text-[var(--text-mid)]">{meta.subtitle}</p>

          <div className="mt-8 grid max-w-[620px] grid-cols-2 gap-3.5 max-sm:grid-cols-1">
            {["路由骨架", "基础 UI", "请求封装", "全局反馈"].map((label, index) => (
              <div key={label} className="app-card p-[18px]">
                <div className="mb-2 text-2xl">{["🧭", "🧩", "🔌", "🍯"][index]}</div>
                <div className="mb-1 text-[15px] font-extrabold">{label}</div>
                <p className="text-[13px] leading-normal text-[var(--text-light)]">
                  A 组共享基础已按原型暖色视觉建立，可供后续业务页面接入。
                </p>
              </div>
            ))}
          </div>

          <div className="mt-7 rounded-[var(--radius-xl)] border border-[rgba(75,163,199,0.12)] bg-[linear-gradient(135deg,rgba(126,200,227,0.18),rgba(179,157,219,0.18))] p-6">
            <div className="mb-3.5 font-extrabold">页面接入顺序</div>
            <div className="grid gap-2.5 text-sm text-[var(--text-mid)]">
              {["复用 AppShell 与导航", "接入 shared/ui 基础组件", "通过 apiClient 请求后端", "使用 Toast、Modal、Loading 表达全局状态"].map((step, index) => (
                <div key={step} className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-black text-[var(--sky-deep)] shadow-[0_2px_8px_rgba(75,163,199,0.16)]">
                    {index + 1}
                  </span>
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="app-card sticky top-[92px] p-7 max-lg:static">
          <h2 className="font-display mb-1 text-[28px]">基础组件预览</h2>
          <p className="mb-5 text-[13px] text-[var(--text-light)]">按钮、输入、弹窗、Toast 和 Loading 的原型风格。</p>
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-[var(--radius-md)] bg-[var(--warm-bg)] p-1.5">
            <button className="h-[42px] rounded-[var(--radius-sm)] bg-white text-sm font-bold text-[var(--terracotta)] shadow-[0_2px_10px_rgba(61,44,44,0.08)]">
              手机号
            </button>
            <button className="h-[42px] rounded-[var(--radius-sm)] text-sm font-bold text-[var(--text-mid)]">微信</button>
          </div>
          <label className="mb-2 block text-[13px] font-bold text-[var(--text-mid)]">手机号</label>
          <Input className="mb-3" placeholder="请输入手机号" type="tel" />
          <label className="mb-2 block text-[13px] font-bold text-[var(--text-mid)]">短信验证码</label>
          <div className="mb-4 flex gap-2">
            <Input placeholder="6 位验证码" />
            <Button variant="sage" className="w-32 shrink-0 px-0">
              获取验证码
            </Button>
          </div>
          <div className="mb-4 rounded-[var(--radius-md)] border border-[rgba(139,198,168,0.32)] bg-[rgba(139,198,168,0.08)] p-3">
            <div className="mb-2 flex items-center justify-between text-[13px] font-bold text-[var(--sage-deep)]">
              <span>真人验证</span>
              <span>拖动到最右侧</span>
            </div>
            <div className="h-[38px] rounded-full border border-[rgba(139,198,168,0.28)] bg-white" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => showToast("已保存页面状态", "success")}>Toast</Button>
            <Button variant="outline" onClick={() => setModalOpen(true)}>
              Modal
            </Button>
            <LoadingSpinner label="Loading" />
          </div>
        </aside>
      </section>
      <Modal
        open={modalOpen}
        title="共享弹窗"
        description="用于后续登录确认、素材删除、生成提示等全局场景。"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={() => setModalOpen(false)}>确认</Button>
          </>
        }
      />
    </main>
  );

  if (useTopBar) {
    return (
      <div className="min-h-screen bg-[var(--warm-bg)] text-[var(--text-dark)]">
        <header className="flex items-center gap-4 border-b border-[rgba(212,114,92,0.08)] bg-[rgba(255,248,240,0.95)] px-8 py-3.5 backdrop-blur-xl max-sm:px-4">
          <button
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[rgba(212,114,92,0.08)] px-3.5 py-2 text-[13px] font-medium text-[var(--text-mid)] hover:bg-[rgba(212,114,92,0.15)] hover:text-[var(--terracotta)]"
            onClick={() => navigate("/")}
            type="button"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <div className="font-display flex-1 text-xl">{meta.title}</div>
          <Button asChild variant="outline">
            <AppLink to="/">首页</AppLink>
          </Button>
        </header>
        {content}
      </div>
    );
  }

  return <AppShell>{content}</AppShell>;
};
