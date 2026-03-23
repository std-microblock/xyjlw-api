// ============================================================
// 校园接龙王 API SDK 入口
// ============================================================

export { JielongClient, ApiError, UnauthorizedError } from "./client.js";
export { API_CONFIG, AES_CONFIG, ResponseCode } from "./config.js";
export type { ApiResponse, ApiClientOptions, RequestOptions, TokenPayload } from "./config.js";

// 工具函数
export { aesEncrypt, aesDecrypt, parseToken, isTokenExpired } from "./utils/crypto.js";
export type { ParsedToken } from "./utils/crypto.js";

// 模块
export { CommonModule } from "./modules/common.js";
export { UserModule } from "./modules/user.js";
export { JielongModule } from "./modules/jielong.js";
export { GroupModule } from "./modules/group.js";
export { OrdersModule, ScoreModule } from "./modules/orders-score.js";
export { JlQueryModule, NewsModule, GoodsModule, HelpModule } from "./modules/query-news-goods-help.js";

// 模块类型
export type * from "./modules/common.js";
export type * from "./modules/user.js";
export type * from "./modules/jielong.js";
export type * from "./modules/group.js";
export type * from "./modules/orders-score.js";
export type * from "./modules/query-news-goods-help.js";

// ============================================================
// 聚合 API 类（一站式使用）
// ============================================================

import { JielongClient } from "./client.js";
import { ApiClientOptions } from "./config.js";
import { CommonModule } from "./modules/common.js";
import { UserModule } from "./modules/user.js";
import { JielongModule } from "./modules/jielong.js";
import { GroupModule } from "./modules/group.js";
import { OrdersModule, ScoreModule } from "./modules/orders-score.js";
import {
  JlQueryModule,
  NewsModule,
  GoodsModule,
  HelpModule,
} from "./modules/query-news-goods-help.js";

export class JielongAPI {
  public readonly client: JielongClient;
  public readonly common: CommonModule;
  public readonly user: UserModule;
  public readonly jielong: JielongModule;
  public readonly group: GroupModule;
  public readonly orders: OrdersModule;
  public readonly score: ScoreModule;
  public readonly query: JlQueryModule;
  public readonly news: NewsModule;
  public readonly goods: GoodsModule;
  public readonly help: HelpModule;

  constructor(options: ApiClientOptions) {
    this.client = new JielongClient(options);
    this.common = new CommonModule(this.client);
    this.user = new UserModule(this.client);
    this.jielong = new JielongModule(this.client);
    this.group = new GroupModule(this.client);
    this.orders = new OrdersModule(this.client);
    this.score = new ScoreModule(this.client);
    this.query = new JlQueryModule(this.client);
    this.news = new NewsModule(this.client);
    this.goods = new GoodsModule(this.client);
    this.help = new HelpModule(this.client);
  }
}
