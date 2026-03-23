// ============================================================
// 校园接龙王 API 协议配置
// ============================================================

export const API_CONFIG = {
  BASE_URL: "https://api.jielong.kbstore.cn",
  API_URL: "https://api.jielong.kbstore.cn/api/",
  IMG_URL: "https://g.kbscdn.cn/jielong",
  APP_ID: 1,
  APP_VERSION: "1.1.19",
} as const;

// AES 加密配置（CBC + PKCS7，来自原始小程序 vendor.js）
export const AES_CONFIG = {
  KEY: "longjieapikcsdwf",
  IV: "8564557179885986",
} as const;

// ============================================================
// JWT Token 载荷结构
// ============================================================
export interface TokenPayload {
  uid: number;
  role: string[];
  permission: string[];
  tokenExpired: number; // exp * 1000 (ms)
}

// ============================================================
// 统一响应格式
// ============================================================
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  msg: string;
}

// code 枚举
export const ResponseCode = {
  SUCCESS: 1,
  SUCCESS_WITH_MSG: 0,
  TOKEN_EXPIRED: 401,
  SIGNATURE_ERROR: 402,
} as const;

// ============================================================
// 请求配置
// ============================================================
export interface RequestOptions {
  /** 覆盖默认 API_URL */
  baseUrl?: string;
  /** 额外请求头 */
  headers?: Record<string, string>;
  /** 请求超时 ms，默认 10000 */
  timeout?: number;
}

export interface ApiClientOptions extends RequestOptions {
  /** 获取当前 token 的函数 */
  getToken: () => string | null;
  /** token 刷新后回调（服务器 401 返回新 token 时触发） */
  onTokenRefresh?: (newToken: string) => void;
  /** 未登录时的回调 */
  onUnauthorized?: () => void;
}
