import { JielongClient } from "../client.js";
import { ApiResponse } from "../config.js";

// ============================================================
// user 模块类型
// ============================================================

export interface StorageInfoResponse {
  used: number;
  total: number;
}

export interface AutoLoginParams {
  code: string;
  nickname?: string;
  avatar?: string;
}

export interface LoginResponse {
  token: string;
  uid: number;
  is_new: number;
}

export interface AuthMobileParams {
  code: string;
  phone_code: string;
}

export interface AuthMobileResponse {
  mobile: string;
}

export interface ModifyUserParams {
  nickname?: string;
  avatar?: string;
  gender?: number;
}

export interface FeedbackParams {
  content: string;
  images?: string[];
}

export interface AdLogParams {
  ad_id: string;
  type: string;
}

export interface TempMsgParams {
  template_id: string;
  page?: string;
}

export interface TempMsgResponse {
  msg_id: string;
}

export interface LevelItem {
  level: number;
  name: string;
  min_score: number;
  max_score: number;
  icon: string;
}

export interface FeeInfoResponse {
  balance: number;
  total_income: number;
  total_withdraw: number;
  freeze: number;
}

export interface FeeLogItem {
  id: number;
  amount: number;
  type: string;
  desc: string;
  created_at: string;
}

export interface FeeLogParams {
  page?: number;
  page_size?: number;
  type?: number;
}

export interface WithdrawInfoResponse {
  min_amount: number;
  fee_rate: number;
  alipay?: string;
  wechat?: string;
}

export interface WithdrawalParams {
  amount: number;
  type: "alipay" | "wechat";
  account: string;
  real_name: string;
}

// ============================================================
// user 模块
// ============================================================

export class UserModule {
  constructor(private readonly client: JielongClient) {}

  /** 获取存储空间信息 */
  getStorageInfo(): Promise<ApiResponse<StorageInfoResponse>> {
    return this.client.post("User/getStorageInfo");
  }

  /** 微信自动登录（code 换 token） */
  autoLogin(params: AutoLoginParams): Promise<ApiResponse<LoginResponse>> {
    return this.client.post("Login/login", params as unknown as Record<string, unknown>);
  }

  /** 手机号授权绑定 */
  authMobile(params: AuthMobileParams): Promise<ApiResponse<AuthMobileResponse>> {
    return this.client.post("User/authMobile", params as unknown as Record<string, unknown>);
  }

  /** 修改用户信息 */
  modifyUserData(params: ModifyUserParams): Promise<ApiResponse<null>> {
    return this.client.post("User/modifyUserData", params as Record<string, unknown>);
  }

  /** 提交意见反馈 */
  submitFeedback(params: FeedbackParams): Promise<ApiResponse<null>> {
    return this.client.post("User/submitFeedback", params as unknown as Record<string, unknown>);
  }

  /** 记录广告曝光日志 */
  addAdLog(params: AdLogParams): Promise<ApiResponse<null>> {
    return this.client.post("User/addAdLog", params as unknown as Record<string, unknown>);
  }

  /** 记录广告点击日志 */
  addAdClickLog(params: AdLogParams): Promise<ApiResponse<null>> {
    return this.client.post("User/addAdClickLog", params as unknown as Record<string, unknown>);
  }

  /** 获取订阅消息 msgId */
  getTempMsgId(params: TempMsgParams): Promise<ApiResponse<TempMsgResponse>> {
    return this.client.post("User/getTempMsgId", params as unknown as Record<string, unknown>);
  }

  /** 添加订阅消息 msgId（需鉴权） */
  addTempMsgId(params: TempMsgParams): Promise<ApiResponse<null>> {
    return this.client.post("User/addTempMsgId", params as unknown as Record<string, unknown>);
  }

  /** 获取会员等级列表（需鉴权） */
  getLevelList(): Promise<ApiResponse<LevelItem[]>> {
    return this.client.post("User/getLevelList");
  }

  /** 获取收益信息（需鉴权） */
  getFeeInfo(): Promise<ApiResponse<FeeInfoResponse>> {
    return this.client.post("User/getFeeInfo");
  }

  /** 获取收益明细（需鉴权） */
  getFeeLog(params?: FeeLogParams): Promise<ApiResponse<{ list: FeeLogItem[]; total: number }>> {
    return this.client.post("User/getFeeLog", (params ?? {}) as Record<string, unknown>);
  }

  /** 获取提现信息（需鉴权） */
  getWithdrawInfo(): Promise<ApiResponse<WithdrawInfoResponse>> {
    return this.client.post("User/getWithdrawInfo");
  }

  /** 提交提现申请（需鉴权） */
  submitWithdrawal(params: WithdrawalParams): Promise<ApiResponse<null>> {
    return this.client.post("User/submitWithdrawal", params as unknown as Record<string, unknown>);
  }
}
