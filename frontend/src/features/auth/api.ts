import { apiClient } from "@/shared/api/client";

export interface MembershipSummary {
  plan: string;
  status: string;
}

export interface UserRead {
  id: number;
  display_name: string;
  avatar_url: string | null;
  role: string;
  status: string;
  default_child_profile_id: number | null;
  phone_masked: string | null;
  wechat_bound: boolean;
  membership_summary?: MembershipSummary;
}

export interface AuthTokenRead {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  session_id: number;
  return_to: string | null;
  user: UserRead;
}

export interface SmsCodeSendResult {
  cooldown_seconds: number;
  expires_in_seconds: number;
  masked_phone: string;
  dev_code: string | null;
}

const TERMS_VERSION = "2026-05-16";
const PRIVACY_VERSION = "2026-05-16";

const getDeviceId = () => {
  const storageKey = "airchieve.device_id";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const next = crypto.randomUUID();
  window.localStorage.setItem(storageKey, next);
  return next;
};

export const authApi = {
  getMe: () => apiClient.get<UserRead>("/v1/account/me"),

  logout: () => apiClient.post<void>("/v1/account/auth/logout"),

  sendRegisterSmsCode: (phone: string) =>
    apiClient.post<SmsCodeSendResult>("/v1/account/auth/sms-code", {
      phone,
      scene: "register",
      device_id: getDeviceId(),
      captcha_ticket: "slider-local",
    }, { skipAuth: true }),

  register: (payload: { username: string; phone: string; password: string; smsCode: string }) =>
    apiClient.post<AuthTokenRead>("/v1/account/auth/register", {
      username: payload.username,
      password: payload.password,
      phone: payload.phone,
      sms_code: payload.smsCode,
      display_name: payload.username,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    }, { skipAuth: true }),

  loginWithPassword: (payload: { username: string; password: string }) =>
    apiClient.post<AuthTokenRead>("/v1/account/auth/password-login", {
      username: payload.username,
      password: payload.password,
      device_id: getDeviceId(),
    }, { skipAuth: true }),
};

export const saveAuthSession = (session: AuthTokenRead) => {
  window.localStorage.setItem("airchieve.access_token", session.access_token);
  window.localStorage.setItem("airchieve.refresh_token", session.refresh_token);
  window.localStorage.setItem("airchieve.session_id", String(session.session_id));
  window.localStorage.setItem("airchieve.user", JSON.stringify(session.user));
  window.dispatchEvent(new Event("airchieve.auth.changed"));
};

export const clearAuthSession = () => {
  window.localStorage.removeItem("airchieve.access_token");
  window.localStorage.removeItem("airchieve.refresh_token");
  window.localStorage.removeItem("airchieve.session_id");
  window.localStorage.removeItem("airchieve.user");
  window.dispatchEvent(new Event("airchieve.auth.changed"));
};

export const readStoredUser = (): UserRead | null => {
  const raw = window.localStorage.getItem("airchieve.user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserRead;
  } catch {
    return null;
  }
};

export const hasAuthToken = () => Boolean(window.localStorage.getItem("airchieve.access_token"));
