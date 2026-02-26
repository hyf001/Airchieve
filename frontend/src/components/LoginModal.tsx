import React, { useEffect, useRef, useState } from 'react';
import { Loader2, QrCode, Eye, EyeOff, Sparkles } from 'lucide-react';
import {
  loginByPassword, loginBySms, register, sendSmsCode,
  type TokenResponse,
} from '../services/authService';

// ============ Types ============

type TabId = 'password' | 'sms' | 'wechat';

interface Props {
  onSuccess: (res: TokenResponse) => void;
}

// ============ Sub-components ============

const TabBar: React.FC<{
  active: TabId;
  onChange: (t: TabId) => void;
}> = ({ active, onChange }) => {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'password', label: '账号登录' },
    { id: 'sms',      label: '验证码' },
    { id: 'wechat',   label: '微信' },
  ];
  return (
    <div className="flex border-b border-slate-100 mb-6">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors relative
            ${active === t.id ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {t.label}
          {active === t.id && (
            <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
};

const Field: React.FC<{
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  suffix?: React.ReactNode;
}> = ({ label, type = 'text', value, onChange, placeholder, autoComplete, disabled, suffix }) => {
  const [showPwd, setShowPwd] = useState(false);
  const inputType = type === 'password' ? (showPwd ? 'text' : 'password') : type;

  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
      <div className="relative flex items-center">
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-200
                     bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2
                     focus:ring-indigo-100 outline-none transition-all duration-200
                     disabled:opacity-60 disabled:cursor-not-allowed
                     placeholder:text-slate-400"
        />
        {type === 'password' && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPwd((p) => !p)}
            className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
        {suffix && <div className="absolute right-2">{suffix}</div>}
      </div>
    </div>
  );
};

const SubmitBtn: React.FC<{
  loading: boolean;
  label: string;
}> = ({ loading, label }) => (
  <button
    type="submit"
    disabled={loading}
    className="w-full py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold
               hover:bg-indigo-700 active:scale-[0.98] transition-all duration-200
               disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
  >
    {loading && <Loader2 size={16} className="animate-spin" />}
    {label}
  </button>
);

const ErrorMsg: React.FC<{ msg: string | null }> = ({ msg }) =>
  msg ? (
    <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-1">
      {msg}
    </p>
  ) : null;

// ============ Tabs ============

const PasswordTab: React.FC<{ onSuccess: (r: TokenResponse) => void }> = ({ onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [nickname, setNickname]   = useState('');
  const [account,  setAccount]    = useState('');
  const [password, setPassword]   = useState('');
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // 前端校验，避免无谓的 422
    if (isRegister && !nickname.trim()) { setError('请输入昵称'); return; }
    if (account.trim().length < 2)     { setError('账号至少 2 位'); return; }
    if (password.length < 6)           { setError('密码至少 6 位'); return; }

    setLoading(true);
    try {
      let res: TokenResponse;
      if (isRegister) {
        res = await register(nickname.trim(), account.trim(), password);
      } else {
        res = await loginByPassword(account.trim(), password);
      }
      onSuccess(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {isRegister && (
        <Field
          label="昵称"
          value={nickname}
          onChange={setNickname}
          placeholder="你的显示名称"
          autoComplete="nickname"
          disabled={loading}
        />
      )}
      <Field
        label="账号"
        value={account}
        onChange={setAccount}
        placeholder="输入账号"
        autoComplete={isRegister ? 'username' : 'username'}
        disabled={loading}
      />
      <Field
        label="密码"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder={isRegister ? '至少 6 位' : '输入密码'}
        autoComplete={isRegister ? 'new-password' : 'current-password'}
        disabled={loading}
      />
      <ErrorMsg msg={error} />
      <SubmitBtn loading={loading} label={isRegister ? '立即注册' : '登录'} />
      <p className="text-center text-xs text-slate-500 mt-4">
        {isRegister ? '已有账号？' : '没有账号？'}
        <button
          type="button"
          onClick={() => { setIsRegister((v) => !v); setError(null); }}
          className="text-indigo-600 hover:underline ml-1 font-medium"
        >
          {isRegister ? '立即登录' : '立即注册'}
        </button>
      </p>
    </form>
  );
};

const SmsTab: React.FC<{ onSuccess: (r: TokenResponse) => void }> = ({ onSuccess }) => {
  const [phone,    setPhone]    = useState('');
  const [code,     setCode]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [sending,  setSending]  = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error,    setError]    = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleSend = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) { setError('请输入正确的 11 位手机号'); return; }
    setError(null);
    setSending(true);
    try {
      const res = await sendSmsCode(phone);
      setCountdown(60);
      timerRef.current = setInterval(() => {
        setCountdown((c) => { if (c <= 1) { clearInterval(timerRef.current!); return 0; } return c - 1; });
      }, 1000);
      // 开发模式：展示调试验证码
      if (res.debug_code) setError(`【开发模式】验证码：${res.debug_code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!code.trim()) { setError('请输入验证码'); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await loginBySms(phone, code);
      onSuccess(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">手机号</label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="输入 11 位手机号"
            autoComplete="tel"
            disabled={loading}
            className="flex-1 px-3 py-2.5 text-sm rounded-lg border border-slate-200
                       bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-2
                       focus:ring-indigo-100 outline-none transition-all duration-200
                       disabled:opacity-60 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || countdown > 0 || loading}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-indigo-200
                       text-indigo-600 hover:bg-indigo-50 transition-colors whitespace-nowrap
                       disabled:opacity-50 disabled:cursor-not-allowed min-w-[80px]"
          >
            {sending ? <Loader2 size={14} className="animate-spin mx-auto" /> :
             countdown > 0 ? `${countdown}s` : '发送验证码'}
          </button>
        </div>
      </div>
      <Field
        label="验证码"
        value={code}
        onChange={setCode}
        placeholder="输入验证码"
        autoComplete="one-time-code"
        disabled={loading}
      />
      <ErrorMsg msg={error} />
      <SubmitBtn loading={loading} label="登录 / 注册" />
      <p className="text-xs text-slate-400 text-center mt-3">
        未注册的手机号将自动创建账号
      </p>
    </form>
  );
};

const WechatTab: React.FC = () => (
  <div className="flex flex-col items-center py-6 gap-4">
    <div className="w-44 h-44 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300
                    flex flex-col items-center justify-center gap-2 text-slate-400">
      <QrCode size={48} strokeWidth={1} />
      <span className="text-xs">二维码加载中…</span>
    </div>
    <p className="text-sm text-slate-500 text-center leading-relaxed max-w-[220px]">
      使用微信扫描二维码登录
    </p>
    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200
                     rounded-full px-3 py-1">
      微信登录即将开放
    </span>
  </div>
);

// ============ Modal ============

const LoginModal: React.FC<Props> = ({ onSuccess }) => {
  const [tab, setTab] = useState<TabId>('password');

  return (
    /* 全屏蒙层 */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl
                   animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-7 pt-7 pb-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                          bg-indigo-100 text-indigo-700 text-xs font-medium mb-3">
            <Sparkles size={12} />
            <span>AIrchieve</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {tab === 'password' ? '欢迎回来' : tab === 'sms' ? '手机验证' : '微信登录'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">登录后开始创作你的绘本故事</p>
        </div>

        {/* Tabs + Form */}
        <div className="px-7 py-4">
          <TabBar active={tab} onChange={setTab} />

          {tab === 'password' && <PasswordTab onSuccess={onSuccess} />}
          {tab === 'sms'      && <SmsTab onSuccess={onSuccess} />}
          {tab === 'wechat'   && <WechatTab />}
        </div>

        {/* Footer */}
        <div className="px-7 pb-6 mt-1">
          <p className="text-center text-[11px] text-slate-400 leading-relaxed">
            登录即表示你同意我们的
            <span className="text-indigo-500 cursor-pointer hover:underline mx-0.5">服务条款</span>
            和
            <span className="text-indigo-500 cursor-pointer hover:underline mx-0.5">隐私政策</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
