import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Coins,
  Crown,
  Sparkles,
  CheckCircle2,
  Star,
  Zap,
  Infinity,
  ShieldCheck,
  Gift,
  Loader2,
  X,
  QrCode,
  Smartphone,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  createRechargeOrder,
  createSubscriptionOrder,
  queryRechargeOrder,
  querySubscriptionOrder,
  type PayChannel,
} from '../services/paymentService';

interface UserProfileViewProps {
  onBack: () => void;
}

// ── 充值套餐 ───────────────────────────────────────────────────────────────
const RECHARGE_PACKAGES: { yuan: number; points: number; popular?: true }[] = [
  { yuan: 10,  points: 30 },
  { yuan: 30,  points: 90 },
  { yuan: 50,  points: 150, popular: true },
  { yuan: 100, points: 300 },
];

// ── 会员套餐 ───────────────────────────────────────────────────────────────
const MEMBERSHIP_PLANS: MembershipPlan[] = [
  {
    level: 'lite' as const,
    name: 'Lite',
    price: 19,
    price_fen: 1900,
    color: 'from-sky-500 to-cyan-400',
    borderHover: 'hover:border-sky-300',
    features: ['每月 50 次绘本创作', '标准画质输出', '优先生成队列', '无广告体验'],
    icon: <Zap size={20} />,
  },
  {
    level: 'pro' as const,
    name: 'Pro',
    price: 39,
    price_fen: 3900,
    popular: true,
    color: 'from-indigo-600 to-violet-500',
    borderHover: 'hover:border-indigo-300',
    features: ['每月 150 次绘本创作', '高清画质输出', '最高优先生成队列', '专属风格模版', '作品商业授权'],
    icon: <Star size={20} />,
  },
  {
    level: 'max' as const,
    name: 'Max',
    price: 69,
    price_fen: 6900,
    color: 'from-amber-500 to-orange-400',
    borderHover: 'hover:border-amber-300',
    features: ['无限次绘本创作', '超清画质输出', '最高优先生成队列', '全部专属模版', '作品商业授权', '专属客服支持'],
    icon: <Infinity size={20} />,
  },
];

type MembershipPlan = {
  level: 'lite' | 'pro' | 'max';
  name: string;
  price: number;
  price_fen: number;
  popular?: true;
  color: string;
  borderHover: string;
  features: readonly string[];
  icon: React.ReactElement;
};

const MEMBERSHIP_LABEL: Record<string, string> = {
  free: '免费版', lite: 'Lite 会员', pro: 'Pro 会员', max: 'Max 会员',
};

// ── 工具 ───────────────────────────────────────────────────────────────────

function formatExpiry(isoStr: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 到期`;
}

/** 判断是否手机端（用于自动选择支付渠道） */
function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

/** 将 code_url 转为二维码图片 URL（使用免费公共 QR 服务，无需安装 npm 包） */
function qrImageUrl(data: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

// ── 支付状态 ───────────────────────────────────────────────────────────────
type PayState = 'idle' | 'creating' | 'polling' | 'success' | 'failed' | 'timeout';

interface QrModal {
  order_no:  string;
  code_url:  string;
  type:      'recharge' | 'subscription';
  label:     string;
}

// ── 主组件 ─────────────────────────────────────────────────────────────────

const UserProfileView: React.FC<UserProfileViewProps> = ({ onBack }) => {
  const { user, refreshUser } = useAuth();

  const [activeTab,       setActiveTab]       = useState<'recharge' | 'membership'>('recharge');
  const [selectedRecharge, setSelectedRecharge] = useState<number | null>(null);
  const [selectedPlan,    setSelectedPlan]    = useState<'lite' | 'pro' | 'max' | null>(null);

  const [payState,  setPayState]  = useState<PayState>('idle');
  const [qrModal,   setQrModal]   = useState<QrModal | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组件卸载时清除轮询
  useEffect(() => () => { if (pollTimer.current) clearTimeout(pollTimer.current); }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // ── 轮询订单状态 ──────────────────────────────────────────────────────────
  const startPolling = useCallback((
    order_no: string,
    type: 'recharge' | 'subscription',
    maxAttempts = 90,          // 90 × 2s = 3 分钟
  ) => {
    setPayState('polling');
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setPayState('timeout');
        showToast('支付超时，如已支付请稍后刷新页面');
        return;
      }
      attempts++;

      try {
        const res = type === 'recharge'
          ? await queryRechargeOrder(order_no)
          : await querySubscriptionOrder(order_no);

        const done = res.status === 'paid' || res.status === 'active';
        const fail = res.status === 'failed' || res.status === 'cancelled';

        if (done) {
          setPayState('success');
          setQrModal(null);
          showToast('支付成功 🎉');
          await refreshUser();
          return;
        }
        if (fail) {
          setPayState('failed');
          showToast('支付失败，请重试');
          return;
        }
      } catch {
        // 网络错误继续轮询
      }

      pollTimer.current = setTimeout(poll, 2000);
    };

    pollTimer.current = setTimeout(poll, 2000);
  }, [refreshUser]);

  // ── 停止轮询 ──────────────────────────────────────────────────────────────
  const stopPolling = () => {
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
    setPayState('idle');
    setQrModal(null);
  };

  // ── 充值 ──────────────────────────────────────────────────────────────────
  const handleRecharge = async () => {
    if (selectedRecharge === null) { showToast('请先选择充值套餐'); return; }
    if (payState === 'creating' || payState === 'polling') return;

    const amount_fen  = selectedRecharge * 100;
    const channel: PayChannel = isMobileDevice() ? 'h5' : 'native';

    setPayState('creating');
    try {
      const order = await createRechargeOrder(amount_fen, channel);

      if (order.pay_type === 'h5' && order.h5_url) {
        // H5：直接跳转，微信支付完成后用户回到页面，触发轮询
        window.location.href = order.h5_url;
        startPolling(order.order_no, 'recharge');
      } else if (order.pay_type === 'native' && order.code_url) {
        const pkg = RECHARGE_PACKAGES.find(p => p.yuan === selectedRecharge)!;
        setQrModal({
          order_no: order.order_no,
          code_url: order.code_url,
          type:     'recharge',
          label:    `充值 ¥${selectedRecharge} → ${pkg.points} 积分`,
        });
        startPolling(order.order_no, 'recharge');
      }
    } catch (e) {
      setPayState('failed');
      showToast(e instanceof Error ? e.message : '创建订单失败，请重试');
    }
  };

  // ── 订阅 ──────────────────────────────────────────────────────────────────
  const handleSubscribe = async () => {
    if (!selectedPlan) { showToast('请先选择会员套餐'); return; }
    if (payState === 'creating' || payState === 'polling') return;

    const plan    = MEMBERSHIP_PLANS.find(p => p.level === selectedPlan)!;
    const channel: PayChannel = isMobileDevice() ? 'h5' : 'native';

    setPayState('creating');
    try {
      const order = await createSubscriptionOrder(selectedPlan, 1, plan.price_fen, channel);

      if (order.pay_type === 'h5' && order.h5_url) {
        window.location.href = order.h5_url;
        startPolling(order.order_no, 'subscription');
      } else if (order.pay_type === 'native' && order.code_url) {
        setQrModal({
          order_no: order.order_no,
          code_url: order.code_url,
          type:     'subscription',
          label:    `${plan.name} 会员 1 个月 — ¥${plan.price}`,
        });
        startPolling(order.order_no, 'subscription');
      }
    } catch (e) {
      setPayState('failed');
      showToast(e instanceof Error ? e.message : '创建订单失败，请重试');
    }
  };

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500">请先登录</div>
    );
  }

  const isMember   = user.membership_level !== 'free';
  const isWorking  = payState === 'creating' || payState === 'polling';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-slate-800 text-white text-sm rounded-xl shadow-lg animate-in slide-in-from-top-2 duration-200">
          {toast}
        </div>
      )}

      {/* ── QR 弹窗 ── */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-72 relative animate-in zoom-in-90 duration-200">
            <button
              onClick={stopPolling}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
            >
              <X size={16} />
            </button>

            <div className="text-center">
              <QrCode size={20} className="text-indigo-500 mx-auto mb-2" />
              <p className="font-semibold text-slate-800 text-sm mb-1">微信扫码支付</p>
              <p className="text-xs text-slate-500 mb-4">{qrModal.label}</p>

              {/* 二维码 */}
              <div className="p-2 border-2 border-slate-100 rounded-xl inline-block">
                <img
                  src={qrImageUrl(qrModal.code_url, 180)}
                  alt="支付二维码"
                  className="w-44 h-44 block"
                />
              </div>

              {/* 状态 */}
              <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                {payState === 'polling' && (
                  <>
                    <Loader2 size={14} className="text-indigo-500 animate-spin" />
                    <span className="text-slate-500">等待支付...</span>
                  </>
                )}
                {payState === 'success' && (
                  <>
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    <span className="text-emerald-600 font-medium">支付成功！</span>
                  </>
                )}
                {payState === 'timeout' && (
                  <span className="text-amber-600 text-xs">二维码已过期，请关闭后重新发起</span>
                )}
              </div>

              <p className="text-[11px] text-slate-400 mt-3">
                使用微信扫一扫完成支付，支付后自动刷新
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-slate-200/60">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="font-semibold text-slate-800">个人主页</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* ── 用户信息卡 ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-20 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
          <div className="px-6 pb-6 -mt-10">
            <div className="w-16 h-16 rounded-2xl border-4 border-white shadow-md bg-indigo-100 flex items-center justify-center overflow-hidden">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.nickname} className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-bold text-indigo-600">
                  {user.nickname?.[0]?.toUpperCase() ?? '?'}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{user.nickname}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {user.role === 'admin' && (
                    <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 text-xs font-medium flex items-center gap-1">
                      <ShieldCheck size={11} /> 管理员
                    </span>
                  )}
                  {user.status === 'active' ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium flex items-center gap-1">
                      <CheckCircle2 size={11} /> 正常
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-medium">
                      {user.status}
                    </span>
                  )}
                  {isMember && (
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1">
                      <Crown size={11} /> {MEMBERSHIP_LABEL[user.membership_level]}
                    </span>
                  )}
                </div>
                {isMember && user.membership_expire_at && (
                  <p className="text-xs text-slate-400 mt-1">{formatExpiry(user.membership_expire_at)}</p>
                )}
              </div>

              <div className="flex gap-3">
                <div className="text-center px-4 py-2 rounded-xl bg-amber-50 border border-amber-100">
                  <Coins size={18} className="text-amber-500 mx-auto mb-0.5" />
                  <div className="text-lg font-bold text-amber-600">{user.points_balance}</div>
                  <div className="text-[11px] text-amber-500">积分</div>
                </div>
                <div className="text-center px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                  <Gift size={18} className="text-emerald-500 mx-auto mb-0.5" />
                  <div className="text-lg font-bold text-emerald-600">{user.free_creation_remaining}</div>
                  <div className="text-[11px] text-emerald-500">免费次数</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tab 切换 ── */}
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {(['recharge', 'membership'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'recharge' ? (
                <span className="flex items-center justify-center gap-1.5"><Coins size={15} /> 充值积分</span>
              ) : (
                <span className="flex items-center justify-center gap-1.5"><Crown size={15} /> 会员订阅</span>
              )}
            </button>
          ))}
        </div>

        {/* ── 充值积分 Tab ── */}
        {activeTab === 'recharge' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Coins size={18} className="text-amber-500" />
                  <h3 className="font-semibold text-slate-800">选择充值套餐</h3>
                </div>
                {/* 支付渠道提示 */}
                <span className="flex items-center gap-1 text-xs text-slate-400">
                  {isMobileDevice()
                    ? <><Smartphone size={12} /> 微信 H5 支付</>
                    : <><QrCode size={12} /> 扫码支付</>}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-5">1 元 = 3 积分，积分可用于绘本创作消耗</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {RECHARGE_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.yuan}
                    onClick={() => { setSelectedRecharge(pkg.yuan); setPayState('idle'); }}
                    disabled={isWorking}
                    className={`relative flex flex-col items-center justify-center py-5 rounded-xl border-2 transition-all duration-200 ${
                      selectedRecharge === pkg.yuan
                        ? 'border-amber-400 bg-amber-50 shadow-md shadow-amber-100'
                        : 'border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/40'
                    } disabled:opacity-50`}
                  >
                    {pkg.popular && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-400 text-white text-[10px] font-bold whitespace-nowrap">
                        最划算
                      </span>
                    )}
                    <span className="text-2xl font-bold text-slate-800">¥{pkg.yuan}</span>
                    <span className="text-sm text-amber-600 font-medium mt-0.5">+{pkg.points} 积分</span>
                    {selectedRecharge === pkg.yuan && (
                      <CheckCircle2 size={14} className="text-amber-500 mt-1.5" />
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={handleRecharge}
                disabled={selectedRecharge === null || isWorking}
                className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-semibold text-sm shadow-md shadow-amber-100 hover:from-amber-500 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {payState === 'creating' ? (
                  <><Loader2 size={16} className="animate-spin" /> 创建订单中...</>
                ) : selectedRecharge ? (
                  `立即充值 ¥${selectedRecharge} → ${RECHARGE_PACKAGES.find(p => p.yuan === selectedRecharge)?.points} 积分`
                ) : '请选择套餐'}
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">积分使用说明</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• 每次绘本创作消耗积分（根据页数和画质不同）</li>
                <li>• 积分不设有效期，充值后永久有效</li>
                <li>• 会员用户每月享有专属创作额度，超出后消耗积分</li>
              </ul>
            </div>
          </div>
        )}

        {/* ── 会员订阅 Tab ── */}
        {activeTab === 'membership' && (
          <div className="space-y-4">
            {isMember && (
              <div className="flex items-center gap-2 p-4 rounded-xl bg-indigo-50 border border-indigo-100 text-sm text-indigo-700">
                <Crown size={16} />
                <span>
                  您当前是 <strong>{MEMBERSHIP_LABEL[user.membership_level]}</strong>
                  {user.membership_expire_at && `，${formatExpiry(user.membership_expire_at)}`}
                </span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              {MEMBERSHIP_PLANS.map((plan) => {
                const isCurrent = user.membership_level === plan.level;
                const isSelected = selectedPlan === plan.level;

                return (
                  <button
                    key={plan.level}
                    onClick={() => { setSelectedPlan(isSelected ? null : plan.level); setPayState('idle'); }}
                    disabled={isWorking}
                    className={`relative flex flex-col text-left rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
                      isSelected
                        ? 'border-indigo-400 shadow-lg shadow-indigo-100'
                        : `border-slate-200 bg-white ${plan.borderHover} hover:shadow-md`
                    } disabled:opacity-50`}
                  >
                    {plan.popular && (
                      <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center gap-0.5">
                        <Sparkles size={9} /> 最受欢迎
                      </span>
                    )}
                    <div className={`bg-gradient-to-br ${plan.color} p-4 text-white`}>
                      <div className="flex items-center gap-2 mb-1">
                        {plan.icon}
                        <span className="font-bold text-lg">{plan.name}</span>
                      </div>
                      <div className="flex items-end gap-1">
                        <span className="text-3xl font-extrabold">¥{plan.price}</span>
                        <span className="text-sm opacity-80 mb-1">/ 月</span>
                      </div>
                    </div>
                    <div className="p-4 flex-1">
                      <ul className="space-y-2">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                            <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="px-4 pb-4">
                      {isCurrent ? (
                        <div className="w-full py-2 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-semibold text-center border border-emerald-200">
                          当前套餐
                        </div>
                      ) : (
                        <div className={`w-full py-2 rounded-lg text-xs font-semibold text-center transition-colors ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isSelected ? '已选择 ✓' : '选择此套餐'}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleSubscribe}
              disabled={!selectedPlan || isWorking}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold text-sm shadow-md shadow-indigo-200 hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {payState === 'creating' ? (
                <><Loader2 size={16} className="animate-spin" /> 创建订单中...</>
              ) : selectedPlan ? (
                `订阅 ${MEMBERSHIP_PLANS.find(p => p.level === selectedPlan)?.name} 会员 — ¥${MEMBERSHIP_PLANS.find(p => p.level === selectedPlan)?.price}/月`
              ) : '请选择会员套餐'}
            </button>

            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold text-slate-600 mb-2">订阅说明</p>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• 会员按月订阅，到期后自动停止，不自动续费</li>
                <li>• 同套餐续费：在原到期时间上顺延</li>
                <li>• 升级套餐：从购买时间重新计算有效期</li>
                <li>• 会员期间创作次数超出后，可使用积分补充</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileView;
