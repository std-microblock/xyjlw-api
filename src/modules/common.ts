import { JielongClient } from "../client.js";
import { ApiResponse } from "../config.js";

// ============================================================
// common 模块类型
// ============================================================

export interface InitDataResponse {
  activity_type: Array<{ id: number; name: string }>;
  appInfo: Record<string, unknown>;
  index_config: Record<string, unknown>;
}

export interface OssSignResponse {
  accessid: string;
  policy: string;
  signature: string;
  dir: string;
  host: string;
  expire: string;
}

export interface ShareLogoResponse {
  logo: string;
}

export interface SubscribeStatusResponse {
  status: number;
  template_ids: string[];
}

export interface ServeTimeResponse {
  time: number;
}

export interface Img2PdfParams {
  img_urls: string[];
}

export interface Img2PdfResponse {
  pdf_url: string;
}

// ============================================================
// common 模块
// ============================================================

export class CommonModule {
  constructor(private readonly client: JielongClient) {}

  /** 初始化应用数据（活动类型、应用信息、首页配置） */
  initData(): Promise<ApiResponse<InitDataResponse>> {
    return this.client.post("Index/initData");
  }

  /** 获取 OSS 上传签名 */
  getOssSign(): Promise<ApiResponse<OssSignResponse>> {
    return this.client.post("Upload/getOssSign");
  }

  /** 获取分享 Logo */
  getShareLogo(): Promise<ApiResponse<ShareLogoResponse>> {
    return this.client.post("Index/getShareLogo");
  }

  /** 获取订阅消息状态 */
  getSubscribeStatus(): Promise<ApiResponse<SubscribeStatusResponse>> {
    return this.client.post("Index/getSubscribeStatus");
  }

  /** 获取服务器时间 */
  getServeTime(): Promise<ApiResponse<ServeTimeResponse>> {
    return this.client.post("Index/getServeTime");
  }

  /** 图片转 PDF */
  img2pdf(params: Img2PdfParams): Promise<ApiResponse<Img2PdfResponse>> {
    return this.client.post("Upload/img2pdf", params as Record<string, unknown>);
  }
}
