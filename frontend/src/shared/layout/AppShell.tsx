import React from "react";
import { LogOut, Search, UserRound } from "lucide-react";

import { type AppRoute, useRouter } from "@/app/router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth";
import { cn } from "@/lib/utils";
import { AppLink } from "@/shared/ui/AppLink";

const navItems: Array<{ label: string; to: AppRoute }> = [
  { label: "故事库", to: "/stories" },
  { label: "画风", to: "/artstyle" },
  { label: "角色", to: "/characters" },
  { label: "声音", to: "/voices" },
  { label: "分享", to: "/share" },
  { label: "会员", to: "/membership" },
];

interface AppShellProps {
  children: React.ReactNode;
  hideSearch?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({ children, hideSearch = false }) => {
  const { path, navigate } = useRouter();
  const { isAuthenticated, logout, user } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement | null>(null);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    navigate("/");
  };

  React.useEffect(() => {
    if (!isUserMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  return (
    <div className="min-h-screen bg-[var(--warm-bg)] text-[var(--text-dark)]">
      <nav className="sticky top-0 z-[100] border-b border-[rgba(212,114,92,0.1)] bg-[rgba(255,248,240,0.92)] px-8 backdrop-blur-2xl max-sm:px-4">
        <div className="mx-auto flex h-[68px] max-w-[1320px] items-center gap-6 max-md:gap-3">
          <AppLink
            to="/"
            className="font-display flex shrink-0 items-center gap-2 text-[26px] text-[var(--terracotta)] no-underline max-sm:text-[22px]"
            aria-label="毛毛虫绘本首页"
          >
            <img
              alt=""
              className="h-10 w-10 rounded-full object-cover shadow-[0_3px_12px_rgba(245,166,35,0.3)] max-sm:h-9 max-sm:w-9"
              src="/logo.png"
            />
            <BrandWordmark />
          </AppLink>

          {hideSearch ? (
            <div className="flex-1" />
          ) : (
            <div className="relative max-w-[420px] flex-1 max-md:max-w-[200px] max-sm:hidden">
              <input
                className="h-[42px] w-full rounded-[22px] border-2 border-[rgba(212,114,92,0.15)] bg-white px-[18px] pr-11 text-sm text-[var(--text-dark)] outline-none transition-all placeholder:text-[var(--text-light)] focus:border-[var(--peach)] focus:shadow-[0_0_0_4px_rgba(255,138,101,0.12)]"
                placeholder="搜索绘本、故事、主题..."
                type="search"
              />
              <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-light)]" />
            </div>
          )}

          <div className="flex items-center gap-1.5 max-md:hidden">
            {navItems.map((item) => (
              <AppLink
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-[var(--radius-sm)] px-3.5 py-2 text-sm font-medium text-[var(--text-mid)] no-underline transition-all hover:bg-[rgba(212,114,92,0.08)] hover:text-[var(--terracotta)]",
                  path === item.to && "bg-[rgba(212,114,92,0.12)] font-semibold text-[var(--terracotta)]",
                )}
              >
                {item.label}
              </AppLink>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {user?.role === "admin" ? (
              <Button asChild variant="ghost" className="max-sm:hidden">
                <AppLink to="/admin">后台</AppLink>
              </Button>
            ) : null}
            <Button asChild variant="ghost" className="max-sm:hidden">
              <AppLink to="/profile">我的档案</AppLink>
            </Button>
            {isAuthenticated ? (
              <div ref={userMenuRef} className="relative">
                <button
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                  aria-label={`当前账号：${user?.display_name ?? "已登录"}`}
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[linear-gradient(135deg,var(--sage),var(--sky))] text-sm font-black text-white shadow-[0_2px_8px_rgba(139,198,168,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(139,198,168,0.38)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[rgba(139,198,168,0.22)]"
                  title={user?.display_name ?? "已登录"}
                  type="button"
                  onClick={() => setIsUserMenuOpen((value) => !value)}
                >
                  {user?.avatar_url ? (
                    <img alt="" className="h-full w-full object-cover" src={user.avatar_url} />
                  ) : (
                    (user?.display_name ?? "家").slice(0, 1)
                  )}
                </button>

                {isUserMenuOpen ? (
                  <div
                    className="absolute right-0 top-[calc(100%+10px)] w-44 rounded-[var(--radius-sm)] border border-[rgba(212,114,92,0.14)] bg-white p-2 shadow-[0_12px_32px_rgba(74,55,40,0.14)]"
                    role="menu"
                  >
                    <AppLink
                      to="/profile"
                      className="flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold text-[var(--text-mid)] no-underline transition-colors hover:bg-[rgba(212,114,92,0.07)] hover:text-[var(--terracotta)]"
                      role="menuitem"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <UserRound className="h-4 w-4" />
                      我的档案
                    </AppLink>
                    <button
                      className="mt-1 flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-left text-sm font-semibold text-[var(--text-mid)] transition-colors hover:bg-[rgba(212,114,92,0.07)] hover:text-[var(--terracotta)]"
                      role="menuitem"
                      type="button"
                      onClick={() => void handleLogout()}
                    >
                      <LogOut className="h-4 w-4" />
                      退出登录
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <Button asChild>
                <AppLink to="/auth">登录</AppLink>
              </Button>
            )}
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
};

const brandLetters = [
  { char: "毛", className: "-rotate-[9deg] translate-y-[2px]" },
  { char: "毛", className: "rotate-[6deg] -translate-y-[3px]" },
  { char: "虫", className: "-rotate-[5deg] translate-y-[1px]" },
  { char: "绘", className: "rotate-[7deg] -translate-y-[2px] ml-1" },
  { char: "本", className: "-rotate-[6deg] translate-y-[2px]" },
];

const BrandWordmark: React.FC = () => (
  <span className="inline-flex items-baseline gap-[1px] leading-none" aria-hidden="true">
    {brandLetters.map((letter, index) => (
      <span
        key={`${letter.char}-${index}`}
        className={cn(
          "inline-block origin-bottom transition-transform hover:-translate-y-1",
          letter.className,
        )}
      >
        {letter.char}
      </span>
    ))}
  </span>
);
