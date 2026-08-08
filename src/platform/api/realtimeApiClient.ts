export interface RealtimeApiClientOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  actor?: string;
}

export interface ApiErrorShape {
  code: string;
  message: string;
  status: number;
  traceId?: string;
  details?: unknown;
}

export class RealtimeApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly traceId?: string;
  readonly details?: unknown;

  constructor(error: ApiErrorShape) {
    super(error.message);
    this.name = "RealtimeApiError";
    this.code = error.code;
    this.status = error.status;
    this.traceId = error.traceId;
    this.details = error.details;
  }
}

export interface RealtimeApiClient {
  get<T>(
    path: string,
    query?: Record<string, string | number | undefined>,
  ): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  upload<T>(
    path: string,
    body: FormData,
    headers?: Record<string, string>,
  ): Promise<T>;
}

interface ApiErrorPayload {
  code?: unknown;
  message?: unknown;
  details?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function runtimeBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/u, "");
  if (typeof window === "undefined") return "";
  return "";
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl.replace(/\/$/u, "")}${normalizedPath}`;
}

function queryString(
  query: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function traceId(response: Response): string | undefined {
  return (
    response.headers.get("X-Trace-Id") ??
    response.headers.get("x-trace-id") ??
    undefined
  );
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function toError(response: Response, payload: unknown): RealtimeApiError {
  const body =
    isObject(payload) && isObject(payload.error)
      ? (payload.error as ApiErrorPayload)
      : isObject(payload)
        ? (payload as ApiErrorPayload)
        : {};
  const message =
    typeof body.message === "string"
      ? body.message
      : `请求失败（HTTP ${response.status}）`;
  const code =
    typeof body.code === "string" ? body.code : `HTTP_${response.status}`;
  return new RealtimeApiError({
    code,
    message,
    status: response.status,
    traceId: traceId(response),
    details: body.details,
  });
}

export function createRealtimeApiClient(
  options: RealtimeApiClientOptions = {},
): RealtimeApiClient {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = (options.baseUrl ?? runtimeBaseUrl()).replace(/\/$/u, "");
  const timeoutMs = options.timeoutMs ?? 15_000;

  async function request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    query?: Record<string, string | number | undefined>,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(
        `${joinUrl(baseUrl, path)}${query ? queryString(query) : ""}`,
        {
          method,
          credentials: "include",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            ...(body === undefined
              ? {}
              : { "Content-Type": "application/json" }),
            ...(options.actor ? { "X-Actor": options.actor } : {}),
            "X-Client": "qiqihar-enterprise-web",
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
      );
      const payload = await readJson(response);
      if (!response.ok) throw toError(response, payload);
      if (!isObject(payload) || !("data" in payload)) {
        throw new RealtimeApiError({
          code: "INVALID_API_RESPONSE",
          message: "服务端返回格式无效，缺少 data 字段",
          status: response.status,
          traceId: traceId(response),
          details: payload,
        });
      }
      return payload.data as T;
    } catch (error) {
      if (error instanceof RealtimeApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new RealtimeApiError({
          code: "API_TIMEOUT",
          message: "服务请求超时，请稍后重试",
          status: 408,
        });
      }
      throw new RealtimeApiError({
        code: "API_NETWORK_ERROR",
        message: "无法连接业务服务，请检查网络或服务状态",
        status: 0,
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async function upload<T>(
    path: string,
    form: FormData,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(joinUrl(baseUrl, path), {
        method: "POST",
        credentials: "include",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          ...extraHeaders,
          ...(options.actor ? { "X-Actor": options.actor } : {}),
          "X-Client": "qiqihar-enterprise-web",
        },
        body: form,
      });
      const payload = await readJson(response);
      if (!response.ok) throw toError(response, payload);
      if (!isObject(payload) || !("data" in payload)) {
        throw new RealtimeApiError({
          code: "INVALID_API_RESPONSE",
          message: "服务端返回格式无效，缺少 data 字段",
          status: response.status,
          traceId: traceId(response),
          details: payload,
        });
      }
      return payload.data as T;
    } catch (error) {
      if (error instanceof RealtimeApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new RealtimeApiError({
          code: "API_TIMEOUT",
          message: "服务请求超时，请稍后重试",
          status: 408,
        });
      }
      throw new RealtimeApiError({
        code: "API_NETWORK_ERROR",
        message: "无法连接业务服务，请检查网络或服务状态",
        status: 0,
        details: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    get: (path, query) => request("GET", path, query),
    post: (path, body) => request("POST", path, undefined, body),
    put: (path, body) => request("PUT", path, undefined, body),
    upload,
  };
}

export const realtimeApiClient = createRealtimeApiClient({
  actor: (() => {
    const environment = import.meta.env as unknown as Readonly<
      Record<string, unknown>
    >;
    const actor = environment["VITE_ACTOR"];
    return typeof actor === "string" && actor.trim()
      ? actor.trim()
      : "wang-yang";
  })(),
});
