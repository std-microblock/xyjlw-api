import {
  API_CONFIG,
  ApiClientOptions,
  ApiResponse,
  ResponseCode,
  RequestOptions,
} from "./config.js";

// ============================================================
// 自定义错误类型
// ============================================================

export class ApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "请登录后操作") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// ============================================================
// HTTP 客户端
// ============================================================

export class JielongClient {
  private readonly baseUrl: string;
  private readonly options: ApiClientOptions;

  constructor(options: ApiClientOptions) {
    this.options = options;
    this.baseUrl = options.baseUrl ?? API_CONFIG.API_URL;
  }

  // ----------------------------------------------------------
  // 核心 POST 方法
  // 请求格式：application/x-www-form-urlencoded
  // 鉴权头：Authorization: Bearer {token}
  // 自动附加：appid、appversion、user_id
  // ----------------------------------------------------------
  async post<TData = unknown>(
    path: string,
    params: Record<string, unknown> = {},
    requestOptions: RequestOptions = {}
  ): Promise<ApiResponse<TData>> {
    return this.postInternal<TData>(path, params, requestOptions);
  }

  private async postInternal<TData = unknown>(
    path: string,
    params: Record<string, unknown>,
    requestOptions: RequestOptions,
    tokenOverride?: string | null,
    allowTokenRefresh = true
  ): Promise<ApiResponse<TData>> {
    const token = tokenOverride ?? this.options.getToken();

    // 构建请求 body（x-www-form-urlencoded）
    const body = new URLSearchParams();
    body.set("appid", String(API_CONFIG.APP_ID));
    body.set("appversion", API_CONFIG.APP_VERSION);

    // 附加 user_id（从 token 解析，如果有的话）
    if (token) {
      try {
        const { parseToken } = await import("./utils/crypto.js");
        const parsed = parseToken(token);
        if (parsed) body.set("user_id", String(parsed.uid));
      } catch {
        body.set("user_id", "0");
      }
    } else {
      body.set("user_id", "0");
    }

    // 追加业务参数
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        body.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      }
    }

    const url = `${requestOptions.baseUrl ?? this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      ...requestOptions.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = requestOptions.timeout ?? 10_000;
    const timerId = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: body.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timerId);
    }

    if (!response.ok) {
      throw new ApiError(response.status, `HTTP ${response.status}: ${response.statusText}`);
    }

    const json = (await response.json()) as ApiResponse<TData>;

    // --------------------------------------------------------
    // 响应拦截逻辑（对应小程序 interceptor.response）
    // --------------------------------------------------------

    // 401：token 过期，服务器返回新 token，需要重试
    if (json.code === ResponseCode.TOKEN_EXPIRED) {
      const newToken = this.extractRefreshedToken(json);
      if (allowTokenRefresh && newToken) {
        this.options.onTokenRefresh?.(newToken);
        return this.postInternal<TData>(path, params, requestOptions, newToken, false);
      }
      this.options.onUnauthorized?.();
      throw new UnauthorizedError("登录已过期，请重新登录");
    }

    // 402：签名错误 / 超时
    if (json.code === ResponseCode.SIGNATURE_ERROR) {
      throw new ApiError(402, "请求签名错误，请刷新重试", json.data);
    }

    return json;
  }

  private extractRefreshedToken<TData>(json: ApiResponse<TData>): string | null {
    const data = json.data as
      | { token?: string; access_token?: string }
      | undefined
      | null;

    if (data?.token) return data.token;
    if (data?.access_token) return data.access_token;
    return null;
  }
}
