import React from "react";
import { Eye, EyeOff, LockKeyhole, MessageSquare, Phone, QrCode, User } from "lucide-react";

import { useRouter } from "@/app/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi, saveAuthSession, useAuth } from "@/features/auth";
import { AppShell } from "@/shared/layout/AppShell";
import { useToast } from "@/shared/ui/toast";

export const AuthPage: React.FC = () => {
  const [authMode, setAuthMode] = React.useState<"login" | "register">("login");
  const [username, setUsername] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [smsCode, setSmsCode] = React.useState("");
  const [sliderValue, setSliderValue] = React.useState(0);
  const [countdown, setCountdown] = React.useState(0);
  const [agreed, setAgreed] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isSendingCode, setIsSendingCode] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { refreshUser } = useAuth();

  const sliderVerified = sliderValue >= 100;
  const sendCodeDisabledReason = (() => {
    if (authMode !== "register") return "";
    if (!username.trim()) return "还差一步：请先填写用户名。";
    if (!phone.trim()) return "还差一步：请先填写手机号。";
    if (password.length < 8) return "还差一步：密码至少需要 8 位。";
    if (password !== confirmPassword) return "还差一步：两次输入的密码需要一致。";
    if (!sliderVerified) return "还差一步：请拖动滑块到最右侧。";
    if (countdown > 0) return `验证码 ${countdown} 秒内有效，过期后可重新发送。`;
    if (isSendingCode) return "验证码发送中。";
    return "";
  })();
  const canSendCode = authMode === "register" && !sendCodeDisabledReason;

  React.useEffect(() => {
    if (countdown <= 0) return undefined;

    const timer = window.setInterval(() => {
      setCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown]);

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setSliderValue(value >= 96 ? 100 : value);
  };

  const switchAuthMode = (mode: "login" | "register") => {
    setAuthMode(mode);
    setSmsCode("");
    setSliderValue(0);
    setCountdown(0);
  };

  const handleSendCode = async () => {
    if (sendCodeDisabledReason) {
      showToast(sendCodeDisabledReason, "error");
      return;
    }

    setIsSendingCode(true);
    try {
      const result = await authApi.sendRegisterSmsCode(phone);
      setCountdown(result.cooldown_seconds || result.expires_in_seconds || 60);
      showToast(
        result.dev_code ? `验证码已发送：${result.dev_code}` : `验证码已发送至 ${result.masked_phone}`,
        "success",
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : "验证码发送失败", "error");
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authMode === "register" && !agreed) {
      showToast("请先同意用户协议和隐私政策", "error");
      return;
    }
    if (!username.trim()) {
      showToast("请输入用户名", "error");
      return;
    }
    if (!password) {
      showToast("请输入密码", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const session =
        authMode === "register"
          ? await submitRegister()
          : await authApi.loginWithPassword({
              username,
              password,
            });
      saveAuthSession(session);
      await refreshUser();
      showToast(authMode === "register" ? "注册成功" : "登录成功", "success");
      navigate("/profile");
    } catch (error) {
      showToast(error instanceof Error ? error.message : authMode === "register" ? "注册失败" : "登录失败", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRegister = async () => {
    if (!phone.trim()) {
      throw new Error("请输入手机号");
    }
    if (password.length < 8) {
      throw new Error("密码至少需要 8 位");
    }
    if (password !== confirmPassword) {
      throw new Error("两次输入的密码不一致");
    }
    if (!smsCode.trim()) {
      throw new Error("请输入短信验证码");
    }
    return authApi.register({
      username,
      phone,
      password,
      smsCode,
    });
  };

  return (
    <AppShell hideSearch>
      <main className="mx-auto max-w-[1160px] px-8 py-11 max-sm:px-4">
        <section className="grid grid-cols-[minmax(0,1fr)_420px] gap-8 max-lg:grid-cols-1">
          <div className="app-card p-8 max-sm:p-6">
            <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[rgba(139,198,168,0.16)] px-3 py-1.5 text-[13px] font-bold text-[var(--sage-deep)]">
              <QrCode className="h-4 w-4" />
              扫码快捷登录
            </span>
            <h1 className="font-display mb-3 text-[42px] leading-[1.15] max-sm:text-[30px]">微信扫码登录</h1>
            <p className="max-w-[560px] text-base text-[var(--text-mid)]">
              使用微信扫一扫登录，适合家长和老师在新设备上快速进入阅读与创作流程。
            </p>

            <div className="mt-8 flex justify-center">
              <div className="w-full max-w-[320px] rounded-[var(--radius-xl)] border border-[rgba(212,114,92,0.08)] bg-white p-5 shadow-[var(--shadow-soft)]">
                <div className="relative mx-auto aspect-square w-full max-w-[220px] rounded-[var(--radius-lg)] bg-[linear-gradient(90deg,rgba(61,44,44,0.08)_12px,transparent_12px)_0_0/24px_24px,linear-gradient(rgba(61,44,44,0.08)_12px,transparent_12px)_0_0/24px_24px,white] shadow-[inset_0_0_0_12px_white,0_4px_18px_rgba(61,44,44,0.08)]">
                  <span className="absolute left-6 top-6 h-12 w-12 rounded-lg border-[8px] border-[var(--text-dark)] bg-white" />
                  <span className="absolute right-6 top-6 h-12 w-12 rounded-lg border-[8px] border-[var(--text-dark)] bg-white" />
                  <span className="absolute bottom-6 left-6 h-12 w-12 rounded-lg border-[8px] border-[var(--text-dark)] bg-white" />
                  <img
                    alt=""
                    className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full object-cover shadow-[0_2px_10px_rgba(61,44,44,0.16)]"
                    src="/logo.png"
                  />
                </div>
                <div className="mt-4 text-center">
                  <div className="font-extrabold">打开微信扫码</div>
                  <p className="mt-1 text-[13px] text-[var(--text-light)]">扫码后请在手机上确认登录</p>
                </div>
              </div>
            </div>
          </div>

          <aside className="app-card sticky top-[92px] p-7 max-lg:static">
            <h2 className="font-display mb-1 text-[28px]">
              {authMode === "login" ? "用户名密码登录" : "注册账号"}
            </h2>
            <p className="mb-5 text-[13px] text-[var(--text-light)]">
              {authMode === "login"
                ? "输入用户名和密码即可登录。注册和敏感操作会额外校验手机号。"
                : "创建账号前，先完成滑块验证，再获取 60 秒有效的短信验证码。"}
            </p>

            <div className="mb-5 grid grid-cols-2 gap-2 rounded-[var(--radius-md)] bg-[var(--warm-bg)] p-1.5">
              <button
                className={`h-[42px] rounded-[var(--radius-sm)] text-sm font-bold transition-all ${
                  authMode === "login"
                    ? "bg-white text-[var(--terracotta)] shadow-[0_2px_10px_rgba(61,44,44,0.08)]"
                    : "text-[var(--text-mid)]"
                }`}
                type="button"
                onClick={() => switchAuthMode("login")}
              >
                登录
              </button>
              <button
                className={`h-[42px] rounded-[var(--radius-sm)] text-sm font-bold transition-all ${
                  authMode === "register"
                    ? "bg-white text-[var(--terracotta)] shadow-[0_2px_10px_rgba(61,44,44,0.08)]"
                    : "text-[var(--text-mid)]"
                }`}
                type="button"
                onClick={() => switchAuthMode("register")}
              >
                注册
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <label className="mb-2 block text-[13px] font-bold text-[var(--text-mid)]" htmlFor="auth-username">
                用户名
              </label>
              <div className="relative mb-3">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-light)]" />
                <Input
                  id="auth-username"
                  className="pl-10"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>

              {authMode === "register" ? (
                <>
                  <label className="mb-2 block text-[13px] font-bold text-[var(--text-mid)]" htmlFor="auth-phone">
                    手机号
                  </label>
                  <div className="relative mb-3">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-light)]" />
                    <Input
                      id="auth-phone"
                      className="pl-10"
                      inputMode="tel"
                      maxLength={11}
                      placeholder="请输入手机号"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </div>
                </>
              ) : null}

              <label className="mb-2 block text-[13px] font-bold text-[var(--text-mid)]" htmlFor="auth-password">
                密码
              </label>
              <div className="relative mb-3">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-light)]" />
                <Input
                  id="auth-password"
                  className="pl-10 pr-11"
                  placeholder="请输入密码"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  aria-label={showPassword ? "隐藏密码" : "查看密码"}
                  className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-light)] transition-colors hover:bg-[rgba(61,44,44,0.06)] hover:text-[var(--text-mid)]"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {authMode === "register" ? (
                <>
                  <label
                    className="mb-2 block text-[13px] font-bold text-[var(--text-mid)]"
                    htmlFor="auth-confirm-password"
                  >
                    确认密码
                  </label>
                  <div className="relative mb-3">
                    <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-light)]" />
                    <Input
                      id="auth-confirm-password"
                      className="pl-10 pr-11"
                      placeholder="请再次输入密码"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                    <button
                      aria-label={showConfirmPassword ? "隐藏确认密码" : "查看确认密码"}
                      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-light)] transition-colors hover:bg-[rgba(61,44,44,0.06)] hover:text-[var(--text-mid)]"
                      type="button"
                      onClick={() => setShowConfirmPassword((current) => !current)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="mb-4 rounded-[var(--radius-md)] border border-[rgba(139,198,168,0.32)] bg-[rgba(139,198,168,0.08)] p-3">
                    <div className="mb-2 flex items-center justify-between text-[13px] font-bold text-[var(--sage-deep)]">
                      <span>滑块验证</span>
                      <span>{sliderVerified ? "验证通过" : "发送验证码前完成"}</span>
                    </div>
                    <div className="relative h-[38px] rounded-full border border-[rgba(139,198,168,0.28)] bg-white px-1">
                      <div
                        className="absolute bottom-1 left-1 top-1 rounded-full bg-[linear-gradient(135deg,rgba(139,198,168,0.45),rgba(126,200,227,0.45))] transition-all"
                        style={{ width: `calc(${sliderValue}% - 8px)` }}
                      />
                      <input
                        aria-label="滑块验证"
                        className="auth-slider absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        max={100}
                        min={0}
                        type="range"
                        value={sliderValue}
                        onChange={handleSliderChange}
                      />
                      <span
                        className="pointer-events-none absolute top-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-[var(--sage-deep)] text-sm font-black text-white shadow-[0_2px_10px_rgba(94,160,122,0.28)] transition-all"
                        style={{ left: `calc(${sliderValue}% - ${sliderValue === 100 ? 34 : 0}px + 4px)` }}
                      >
                        {sliderVerified ? "✓" : "›"}
                      </span>
                    </div>
                  </div>

                  <label
                    className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-[var(--text-mid)]"
                    htmlFor="auth-sms"
                  >
                    <MessageSquare className="h-4 w-4" />
                    短信验证码
                  </label>
                  <div className="mb-2 flex gap-2">
                    <Input
                      id="auth-sms"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6 位验证码"
                      value={smsCode}
                      onChange={(event) => setSmsCode(event.target.value)}
                    />
                    <Button
                      className="w-32 shrink-0 px-0"
                      disabled={!canSendCode}
                      title={sendCodeDisabledReason || undefined}
                      type="button"
                      variant="sage"
                      onClick={handleSendCode}
                    >
                      {isSendingCode ? "发送中" : countdown > 0 ? `${countdown}s` : "获取验证码"}
                    </Button>
                  </div>
                  <p
                    className={`mb-5 rounded-[var(--radius-sm)] px-3 py-2 text-xs leading-5 ${
                      canSendCode
                        ? "bg-[rgba(139,198,168,0.12)] text-[var(--sage-deep)]"
                        : "bg-[rgba(212,114,92,0.08)] text-[var(--terracotta)]"
                    }`}
                  >
                    {canSendCode ? "信息已填写完成，可以获取短信验证码。" : sendCodeDisabledReason}
                  </p>
                </>
              ) : null}

              {authMode === "register" ? (
                <label className="mb-5 flex items-start gap-2 text-xs leading-6 text-[var(--text-light)]">
                  <input
                    className="mt-1 accent-[var(--terracotta)]"
                    type="checkbox"
                    checked={agreed}
                    onChange={(event) => setAgreed(event.target.checked)}
                  />
                  <span>
                    我已阅读并同意 <a className="font-bold text-[var(--terracotta)] no-underline">用户协议</a> 和{" "}
                    <a className="font-bold text-[var(--terracotta)] no-underline">隐私政策</a>。
                  </span>
                </label>
              ) : null}

              <Button className="h-12 w-full rounded-[var(--radius-md)] text-[15px]" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "处理中" : authMode === "login" ? "登录" : "注册"}
              </Button>

              <button
                className="mt-4 w-full text-center text-sm font-bold text-[var(--terracotta)]"
                type="button"
                onClick={() => switchAuthMode(authMode === "login" ? "register" : "login")}
              >
                {authMode === "login" ? "没有账号？立即注册" : "已有账号？返回登录"}
              </button>
            </form>
          </aside>
        </section>
      </main>
    </AppShell>
  );
};
