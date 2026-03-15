import React, { useEffect, useRef, useState } from 'react';
import { Loader2, QrCode, Eye, EyeOff, Sparkles } from 'lucide-react';
import {
  loginByPassword, loginBySms, register, sendSmsCode,
  type TokenResponse,
} from '../services/authService';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

// ============ Types ============

type TabId = 'password' | 'sms' | 'wechat';

interface Props {
  onSuccess: (res: TokenResponse) => void;
  onClose?: () => void;
}

// ============ Sub-components ============

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
  const [showPwd,  setShowPwd]    = useState(false);
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (isRegister && !nickname.trim()) { setError('请输入昵称'); return; }
    if (account.trim().length < 2)     { setError('账号至少 2 位'); return; }
    if (password.length < 6)           { setError('密码至少 6 位'); return; }
    setLoading(true);
    try {
      const res = isRegister
        ? await register(nickname.trim(), account.trim(), password)
        : await loginByPassword(account.trim(), password);
      onSuccess(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isRegister && (
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600">昵称</Label>
          <Input
            value={nickname} onChange={(e) => setNickname(e.target.value)}
            placeholder="您的显示名称" autoComplete="nickname" disabled={loading}
            className="bg-slate-50 focus:bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600">账号</Label>
        <Input
          value={account} onChange={(e) => setAccount(e.target.value)}
          placeholder="输入账号" autoComplete="username" disabled={loading}
          className="bg-slate-50 focus:bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600">密码</Label>
        <div className="relative">
          <Input
            type={showPwd ? 'text' : 'password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder={isRegister ? '至少 6 位' : '输入密码'}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            disabled={loading}
            className="bg-slate-50 focus:bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-100 pr-9"
          />
          <button
            type="button" tabIndex={-1}
            onClick={() => setShowPwd((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <ErrorMsg msg={error} />
      <Button type="submit" disabled={loading} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700">
        {loading && <Loader2 size={16} className="animate-spin" />}
        {isRegister ? '立即注册' : '登录'}
      </Button>
      <p className="text-center text-xs text-slate-500">
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
  const [phone,     setPhone]     = useState('');
  const [code,      setCode]      = useState('');
  const [loading,   setLoading]   = useState(false);
  const [sending,   setSending]   = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error,     setError]     = useState<string | null>(null);
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600">手机号</Label>
        <div className="flex gap-2">
          <Input
            type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="输入 11 位手机号" autoComplete="tel" disabled={loading}
            className="bg-slate-50 focus:bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
          />
          <Button
            type="button" variant="outline" size="sm"
            onClick={handleSend}
            disabled={sending || countdown > 0 || loading}
            className="whitespace-nowrap border-indigo-200 text-indigo-600 hover:bg-indigo-50 min-w-[80px]"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> :
             countdown > 0 ? `${countdown}s` : '发送验证码'}
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-slate-600">验证码</Label>
        <Input
          value={code} onChange={(e) => setCode(e.target.value)}
          placeholder="输入验证码" autoComplete="one-time-code" disabled={loading}
          className="bg-slate-50 focus:bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-100"
        />
      </div>
      <ErrorMsg msg={error} />
      <Button type="submit" disabled={loading} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700">
        {loading && <Loader2 size={16} className="animate-spin" />}
        登录 / 注册
      </Button>
      <p className="text-xs text-slate-400 text-center">未注册的手机号将自动创建账号</p>
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
    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
      微信登录即将开放
    </span>
  </div>
);

// ============ Modal ============

const LoginModal: React.FC<Props> = ({ onSuccess, onClose }) => {
  const [tab, setTab] = useState<TabId>('password');

  const titleMap: Record<TabId, string> = {
    password: '欢迎回来',
    sms: '手机验证',
    wechat: '微信登录',
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <DialogContent className="max-w-sm bg-white text-slate-900 rounded-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="px-7 pt-7 pb-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                          bg-indigo-100 text-indigo-700 text-xs font-medium mb-3">
            <Sparkles size={12} />
            <span>AIrchieve</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">{titleMap[tab]}</h2>
          <p className="text-sm text-slate-500 mt-1">登录后开始创作您的绘本故事</p>
        </div>

        {/* Tabs + Form */}
        <div className="px-7 py-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
            <TabsList className="w-full bg-transparent border-b border-slate-100 rounded-none h-auto p-0 mb-6 gap-0">
              {(['password', 'sms', 'wechat'] as TabId[]).map((t) => (
                <TabsTrigger
                  key={t}
                  value={t}
                  className="flex-1 py-2.5 text-sm rounded-none border-b-2 border-transparent
                             data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600
                             data-[state=active]:bg-transparent data-[state=active]:shadow-none
                             text-slate-500 hover:text-slate-700"
                >
                  {t === 'password' ? '账号登录' : t === 'sms' ? '验证码' : '微信'}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="password"><PasswordTab onSuccess={onSuccess} /></TabsContent>
            <TabsContent value="sms"><SmsTab onSuccess={onSuccess} /></TabsContent>
            <TabsContent value="wechat"><WechatTab /></TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="px-7 pb-6">
          <p className="text-center text-[11px] text-slate-400 leading-relaxed">
            登录即表示您同意我们的
            <span className="text-indigo-500 cursor-pointer hover:underline mx-0.5">服务条款</span>
            和
            <span className="text-indigo-500 cursor-pointer hover:underline mx-0.5">隐私政策</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
