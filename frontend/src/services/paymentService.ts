/**
 * Payment Service
 * 支付接口封装
 *
 * 对接后端 /api/v1/payment/* 端点
 */
import { getAuthHeaders } from './authService';

const BASE = '/api/v1/payment';

// ── Types ──────────────────────────────────────────────────────────────────

export type PayChannel = 'h5' | 'native';

export interface PayOrderResult {
  order_no: string;
  pay_type: 'h5' | 'native';
  h5_url?: string;    // H5 支付跳转链接
  code_url?: string;  // Native 二维码内容
}

export interface OrderStatus {
  order_no: string;
  /** 充值订单: pending | paid | failed | refunded */
  /** 订阅订单: pending | active | expired | cancelled */
  status: string;
}

// ── 内部请求工具 ───────────────────────────────────────────────────────────

const post = async <T>(path: string, body: unknown): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) {
    const msg = typeof data.detail === 'string' ? data.detail : `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
};

const get = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, { headers: getAuthHeaders() });
  const data = await res.json().catch(() => ({ detail: res.statusText }));
  if (!res.ok) {
    const msg = typeof data.detail === 'string' ? data.detail : `请求失败 (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
};

// ── API ────────────────────────────────────────────────────────────────────

/** 创建积分充值订单 */
export const createRechargeOrder = (
  amount_fen: number,
  pay_channel: PayChannel,
  client_ip = '127.0.0.1',
): Promise<PayOrderResult> =>
  post('/recharge', { amount_fen, pay_channel, client_ip });

/** 创建会员订阅订单 */
export const createSubscriptionOrder = (
  level: 'lite' | 'pro' | 'max',
  months: number,
  amount_fen: number,
  pay_channel: PayChannel,
  client_ip = '127.0.0.1',
): Promise<PayOrderResult> =>
  post('/subscription', { level, months, amount_fen, pay_channel, client_ip });

/** 查询充值订单状态（前端轮询用） */
export const queryRechargeOrder = (order_no: string): Promise<OrderStatus> =>
  get(`/recharge/${order_no}`);

/** 查询订阅订单状态（前端轮询用） */
export const querySubscriptionOrder = (order_no: string): Promise<OrderStatus> =>
  get(`/subscription/${order_no}`);
