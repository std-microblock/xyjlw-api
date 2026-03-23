import { JielongClient } from "../client.js";
import { ApiResponse } from "../config.js";

// ============================================================
// orders 模块类型
// ============================================================

export interface SubmitOrderParams {
  goods_id: number;
  quantity?: number;
  activity_id?: number;
  remark?: string;
}

export interface SubmitOrderResponse {
  order_id: number;
  order_no: string;
  amount: number;
}

export interface PayOrderParams {
  order_id: number;
  pay_type?: string;
}

export interface PayOrderResponse {
  prepay_id: string;
  sign_data: Record<string, string>;
}

export interface SuccessOrderParams {
  order_id: number;
  transaction_id?: string;
}

export interface OrderStatusCount {
  unpaid: number;
  paid: number;
  closed: number;
  refunded: number;
}

export interface OrderInfo {
  id: number;
  order_no: string;
  status: number;
  amount: number;
  goods_name: string;
  goods_img: string;
  created_at: string;
  paid_at?: string;
}

export interface OrderListParams {
  status?: number;
  curpage?: number;
  page_size?: number;
}

// ============================================================
// score 模块类型
// ============================================================

export interface ScoreInfo {
  score: number;
  level: number;
  level_name: string;
  next_level_score: number;
}

export interface ScoreLogItem {
  id: number;
  score: number;
  type: string;
  desc: string;
  created_at: string;
}

export interface RewardScoreParams {
  type: string;
  ref_id?: number;
}

export interface TodayFeeInfo {
  today_income: number;
  total_income: number;
  activity_count: number;
}

export interface RewardFeeParams {
  type: string;
  ref_id?: number;
}

// ============================================================
// orders 模块
// ============================================================

export class OrdersModule {
  constructor(private readonly client: JielongClient) {}

  /** 提交订单 */
  submitOrder(params: SubmitOrderParams): Promise<ApiResponse<SubmitOrderResponse>> {
    return this.client.post("Orders/submitOrder", params as Record<string, unknown>);
  }

  /** 发起支付 */
  payOrder(params: PayOrderParams): Promise<ApiResponse<PayOrderResponse>> {
    return this.client.post("Orders/payOrder", params as Record<string, unknown>);
  }

  /** 标记订单支付成功（客户端回调） */
  successOrder(params: SuccessOrderParams): Promise<ApiResponse<null>> {
    return this.client.post("Orders/successOrder", params as Record<string, unknown>);
  }

  /** 获取各状态订单数量 */
  getStatusCount(): Promise<ApiResponse<OrderStatusCount>> {
    return this.client.post("Orders/getStatusCount");
  }

  /** 获取订单详情 */
  getOrderInfo(params: { order_id: number }): Promise<ApiResponse<OrderInfo>> {
    return this.client.post("Orders/getOrderInfo", params as Record<string, unknown>);
  }

  /** 获取订单列表 */
  getOrderList(params?: OrderListParams): Promise<ApiResponse<{ list: OrderInfo[]; total: number }>> {
    return this.client.post("Orders/getOrderList", (params ?? {}) as Record<string, unknown>);
  }
}

// ============================================================
// score 模块
// ============================================================

export class ScoreModule {
  constructor(private readonly client: JielongClient) {}

  /** 获取积分详情（等级、积分数） */
  getInfo(): Promise<ApiResponse<ScoreInfo>> {
    return this.client.post("Score/getInfo");
  }

  /** 获取当前积分 */
  getScore(): Promise<ApiResponse<{ score: number }>> {
    return this.client.post("Score/getScore");
  }

  /** 积分奖励（完成任务触发） */
  rewardScore(params: RewardScoreParams): Promise<ApiResponse<{ added: number }>> {
    return this.client.post("Score/rewardScore", params as Record<string, unknown>);
  }

  /** 获取积分明细列表 */
  logList(params?: { curpage?: number; page_size?: number }): Promise<ApiResponse<{ list: ScoreLogItem[]; total: number }>> {
    return this.client.post("Score/logList", (params ?? {}) as Record<string, unknown>);
  }

  /** 获取今日收益信息 */
  getTodayFeeInfo(): Promise<ApiResponse<TodayFeeInfo>> {
    return this.client.post("Score/getTodayFeeInfo");
  }

  /** 收益奖励 */
  rewardFee(params: RewardFeeParams): Promise<ApiResponse<null>> {
    return this.client.post("Score/rewardFee", params as Record<string, unknown>);
  }
}
