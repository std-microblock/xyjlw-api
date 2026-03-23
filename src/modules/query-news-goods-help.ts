import { JielongClient } from "../client.js";
import { ApiResponse } from "../config.js";

// ============================================================
// jlQuery 模块类型（签到查询）
// ============================================================

export interface QueryEditInfo {
  fields: Array<{ key: string; label: string; type: string }>;
  settings: Record<string, unknown>;
}

export interface QueryDetails {
  id: number;
  title: string;
  status: number;
  total: number;
  signed: number;
  unsigned: number;
}

export interface SubmitSearchParams {
  id: number;
  keyword?: string;
  field?: string;
}

export interface ConfirmSignParams {
  id: number;
  apply_id: number;
  status: number;
  remark?: string;
}

export interface QueryStatistics {
  total: number;
  signed: number;
  unsigned: number;
  late: number;
  chart: Array<{ date: string; count: number }>;
}

export interface QueryRecordsParams {
  id: number;
  status?: number;
  curpage?: number;
  page_size?: number;
  keyword?: string;
}

export interface QueryRecord {
  id: number;
  name: string;
  status: number;
  sign_time?: string;
  remark?: string;
}

// ============================================================
// news & goods & help 模块类型
// ============================================================

export interface Article {
  id: number;
  title: string;
  cover: string;
  summary: string;
  created_at: string;
}

export interface GoodsCategory {
  id: number;
  name: string;
  icon: string;
}

export interface GoodsItem {
  id: number;
  name: string;
  price: number;
  original_price: number;
  cover: string;
  category_id: number;
  stock: number;
}

export interface VideoItem {
  id: number;
  title: string;
  cover: string;
  url: string;
  duration: number;
}

export interface HelpGroup {
  id: number;
  name: string;
  qrcode: string;
}

// ============================================================
// jlQuery 模块
// ============================================================

export class JlQueryModule {
  constructor(private readonly client: JielongClient) {}

  /** 获取编辑信息（字段配置） */
  getEditInfo(params: { id: number }): Promise<ApiResponse<QueryEditInfo>> {
    return this.client.post("Query/getEditInfo", params as Record<string, unknown>);
  }

  /** 获取查询详情 */
  getDetails(params: { id: number }): Promise<ApiResponse<QueryDetails>> {
    return this.client.post("Query/getDetails", params as Record<string, unknown>);
  }

  /** 提交查询搜索 */
  submitSearch(params: SubmitSearchParams): Promise<ApiResponse<{ list: QueryRecord[] }>> {
    return this.client.post("Query/submitSearch", params as Record<string, unknown>);
  }

  /** 确认签到状态 */
  confirmSign(params: ConfirmSignParams): Promise<ApiResponse<null>> {
    return this.client.post("Query/confirmSign", params as Record<string, unknown>);
  }

  /** 获取统计数据 */
  getStatistics(params: { id: number }): Promise<ApiResponse<QueryStatistics>> {
    return this.client.post("Query/getStatistics", params as Record<string, unknown>);
  }

  /** 获取签到记录列表 */
  getRecords(params: QueryRecordsParams): Promise<ApiResponse<{ list: QueryRecord[]; total: number }>> {
    return this.client.post("Query/getRecords", params as Record<string, unknown>);
  }
}

// ============================================================
// news 模块（帮助文章）
// ============================================================

export class NewsModule {
  constructor(private readonly client: JielongClient) {}

  /** 获取帮助文章列表 */
  getHelperList(params?: { curpage?: number }): Promise<ApiResponse<{ list: Article[] }>> {
    return this.client.post("Article/getHelperList", (params ?? {}) as Record<string, unknown>);
  }

  /** 获取文章详情 */
  detail(params: { id: number }): Promise<ApiResponse<Article & { content: string }>> {
    return this.client.post("Article/detail", params as Record<string, unknown>);
  }
}

// ============================================================
// goods 模块
// ============================================================

export class GoodsModule {
  constructor(private readonly client: JielongClient) {}

  /** 获取商品分类 */
  getCategorys(): Promise<ApiResponse<{ list: GoodsCategory[] }>> {
    return this.client.post("Goods/getCategorys");
  }

  /** 获取商品列表 */
  getGoodsList(params?: { category_id?: number; curpage?: number }): Promise<ApiResponse<{ list: GoodsItem[]; total: number }>> {
    return this.client.post("Goods/getGoodsList", (params ?? {}) as Record<string, unknown>);
  }

  /** 获取商品详情 */
  getGoodsInfo(params: { id: number }): Promise<ApiResponse<GoodsItem & { detail: string }>> {
    return this.client.post("Goods/getGoodsInfo", params as Record<string, unknown>);
  }
}

// ============================================================
// help 模块
// ============================================================

export class HelpModule {
  constructor(private readonly client: JielongClient) {}

  /** 获取教程视频列表 */
  getVideoList(params?: { curpage?: number }): Promise<ApiResponse<{ list: VideoItem[] }>> {
    return this.client.post("Help/getVideoList", (params ?? {}) as Record<string, unknown>);
  }

  /** 获取帮助文章列表 */
  getArticles(params?: { curpage?: number }): Promise<ApiResponse<{ list: Article[] }>> {
    return this.client.post("Help/getArticles", (params ?? {}) as Record<string, unknown>);
  }

  /** 获取微信群列表 */
  getGroupList(): Promise<ApiResponse<{ list: HelpGroup[] }>> {
    return this.client.post("Help/getGroupList");
  }
}
