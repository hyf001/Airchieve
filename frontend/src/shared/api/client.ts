export interface ApiClientOptions {
  baseUrl?: string;
  getToken?: () => string | null | undefined;
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

export const createApiClient = ({ baseUrl = "/api", getToken }: ApiClientOptions = {}) => {
  const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const headers = new Headers(options.headers);
    const body: BodyInit | null | undefined = isJsonBody(options.body)
      ? JSON.stringify(options.body)
      : (options.body as BodyInit | null | undefined);
    const token = getToken?.();

    if (isJsonBody(options.body) && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      body,
      headers,
      credentials: options.credentials ?? "include",
    });
    const payload = await readPayload(response);

    if (!response.ok) {
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
});
