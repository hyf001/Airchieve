export interface ApiClientOptions {
  baseUrl?: string;
  getToken?: () => string | null | undefined;
  onUnauthorized?: () => void;
}

export class ApiError<T = unknown> extends Error {
  readonly status: number;
  readonly payload: T | null;

  constructor(message: string, status: number, payload: T | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: BodyInit | object | null;
  skipAuth?: boolean;
  skipAuthRefresh?: boolean;
}

interface AuthSessionPayload {
  access_token: string;
  refresh_token: string;
  session_id: number;
  user: unknown;
}

const isJsonBody = (body: RequestOptions["body"]): body is Record<string, unknown> =>
  body !== null &&
  typeof body === "object" &&
  !(body instanceof FormData) &&
  !(body instanceof URLSearchParams) &&
  !(body instanceof Blob) &&
  !(body instanceof ArrayBuffer);

const readPayload = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") ?? "";
  if (response.status === 204) return null;
  if (contentType.includes("application/json")) return response.json();
  return response.text();
};

const saveRefreshedSession = (session: AuthSessionPayload) => {
  window.localStorage.setItem("airchieve.access_token", session.access_token);
  window.localStorage.setItem("airchieve.refresh_token", session.refresh_token);
  window.localStorage.setItem("airchieve.session_id", String(session.session_id));
  window.localStorage.setItem("airchieve.user", JSON.stringify(session.user));
  window.dispatchEvent(new Event("airchieve.auth.changed"));
};

export const createApiClient = ({ baseUrl = "/api", getToken, onUnauthorized }: ApiClientOptions = {}) => {
  let refreshPromise: Promise<AuthSessionPayload> | null = null;

  const refreshAuthSession = async () => {
    const refreshToken = window.localStorage.getItem("airchieve.refresh_token");
    if (!refreshToken) {
      throw new Error("Missing refresh token");
    }

    refreshPromise ??= fetch(`${baseUrl}/v1/account/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      credentials: "include",
    })
      .then(async (response) => {
        const payload = await readPayload(response);
        if (!response.ok) {
          const message =
            typeof payload === "object" && payload !== null && "detail" in payload
              ? String((payload as { detail: unknown }).detail)
              : `刷新登录态失败：${response.status}`;
          throw new ApiError(message, response.status, payload);
        }
        saveRefreshedSession(payload as AuthSessionPayload);
        return payload as AuthSessionPayload;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  };

  const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const body: BodyInit | null | undefined = isJsonBody(options.body)
      ? JSON.stringify(options.body)
      : (options.body as BodyInit | null | undefined);
    const token = getToken?.();
    const shouldUseAuth = !options.skipAuth;
    const fetchOnce = (nextToken: string | null | undefined) => {
      const headers = new Headers(options.headers);
      if (isJsonBody(options.body) && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
      if (shouldUseAuth && nextToken) {
        headers.set("authorization", `Bearer ${nextToken}`);
      }

      return fetch(`${baseUrl}${path}`, {
        ...options,
        body,
        headers,
        credentials: options.credentials ?? "include",
      });
    };

    let response = await fetchOnce(token);
    let payload = await readPayload(response);

    if (!response.ok) {
      if (response.status === 401 && shouldUseAuth && token && !options.skipAuthRefresh) {
        try {
          const refreshedSession = await refreshAuthSession();
          response = await fetchOnce(refreshedSession.access_token);
          payload = await readPayload(response);
          if (response.ok) {
            return payload as T;
          }
        } catch {
          onUnauthorized?.();
          throw new ApiError("登录已过期，请重新登录", 401, payload);
        }
        if (response.status === 401) {
          onUnauthorized?.();
        }
      }
      const message =
        typeof payload === "object" && payload !== null && "message" in payload
          ? String((payload as { message: unknown }).message)
          : typeof payload === "object" && payload !== null && "detail" in payload
            ? String((payload as { detail: unknown }).detail)
          : `请求失败：${response.status}`;
      throw new ApiError(message, response.status, payload);
    }

    return payload as T;
  };

  return {
    get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
    post: <T>(path: string, body?: RequestOptions["body"], options?: RequestOptions) =>
      request<T>(path, { ...options, method: "POST", body }),
    put: <T>(path: string, body?: RequestOptions["body"], options?: RequestOptions) =>
      request<T>(path, { ...options, method: "PUT", body }),
    patch: <T>(path: string, body?: RequestOptions["body"], options?: RequestOptions) =>
      request<T>(path, { ...options, method: "PATCH", body }),
    delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
    request,
  };
};

export const apiClient = createApiClient({
  getToken: () => window.localStorage.getItem("airchieve.access_token"),
  onUnauthorized: () => window.dispatchEvent(new Event("airchieve.auth.expired")),
});
