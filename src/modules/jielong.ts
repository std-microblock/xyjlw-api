import { JielongClient } from "../client.js";
import { ApiResponse } from "../config.js";

// ============================================================
// jielong（接龙）模块类型
// ============================================================

export interface ActivityListParams {
  curpage?: number;
  tabType?: number;
  group_id?: number;
  keyword?: string;
}

export interface ActivityItem {
  id: number;
  title: string;
  type: number;
  status: number;
  created_at: string;
  end_time: string;
  apply_count: number;
  user_id: number;
  group_id: number;
}

export interface ActivityListResponse {
  list: ActivityItem[];
  total: number;
  curpage: number;
}

export interface SubmitActivityParams {
  title: string;
  type: number;
  group_id?: number;
  end_time?: string;
  content?: string;
  form_data?: unknown;
  settings?: unknown;
}

export interface SubmitActivityResponse {
  id: number;
}

export interface GetDetailsParams {
  id: number;
  user_id?: number;
}

export interface ActivityDetail extends ActivityItem {
  content: string;
  form_data: unknown;
  settings: unknown;
  admin_list: unknown[];
  my_apply: unknown | null;
}

export interface VotingStatisticsParams {
  id: number;
}

export interface ApplyListParams {
  id: number;
  curpage?: number;
  page_size?: number;
  keyword?: string;
  status?: number;
  group_id?: number;
}

export interface ApplyItem {
  id: number;
  user_id: number;
  activity_id: number;
  nickname: string;
  avatar: string;
  status: number;
  form_data: unknown;
  created_at: string;
}

export interface ApplyListResponse {
  list: ApplyItem[];
  total: number;
}

export interface AdminParams {
  id: number;
}

export interface AdminResponse {
  list: Array<{ uid: number; nickname: string; avatar: string }>;
}

export interface QrCodeParams {
  id: number;
  scene?: string;
}

export interface QrCodeResponse {
  qrcode: string;
}

export interface RemindInfoParams {
  id: number;
}

export interface SaveRemindParams {
  id: number;
  remind_time?: string;
  remind_type?: number;
}

export interface SetStatusParams {
  id: number;
  status: number;
}

export interface GetUserNameByGroupParams {
  id: number;
  group_id: number;
}

export interface SubmitApplyFieldItem {
  id: string;
  type?: string;
  title?: string;
  value?: unknown;
}

export interface SubmitApplyParams {
  /** 已提交记录 id，新提交时通常传 0 */
  id?: number;
  /** 接龙活动 id */
  activity_id: number;
  /** 姓名字段 */
  name?: string;
  /** 表单内容。传数组/对象时会自动 JSON.stringify */
  content?: string | SubmitApplyFieldItem[] | Record<string, unknown>;
  /** 打卡 / 签到图片 URL */
  sign_img?: string;
}

export interface DelDataParams {
  id: number;
  apply_ids: number[];
}

export interface BatchDelDataParams {
  ids: number[];
}

export interface ExportInitParams {
  id: number;
}

export interface ExportInitResponse {
  fields: Array<{ key: string; label: string }>;
  total: number;
}

export interface AddExportJobParams {
  id: number;
  fields: string[];
  filter?: Record<string, unknown>;
}

export interface ExportJobResponse {
  job_id: string;
}

export interface ExportStatusParams {
  job_id: string;
}

export interface ExportStatusResponse {
  status: "pending" | "processing" | "done" | "failed";
  progress: number;
  download_url?: string;
}

export interface CaseListParams {
  type?: number;
  curpage?: number;
}

export interface TemplateTypeResponse {
  list: Array<{ id: number; name: string }>;
}

export interface TemplateListParams {
  type_id?: number;
  curpage?: number;
}

export interface TemplateItem {
  id: number;
  title: string;
  type_id: number;
  preview: string;
}

export interface SaveCustomConfigParams {
  id: number;
  config: Record<string, unknown>;
}

export interface SaveRatingParams {
  id: number;
  apply_id: number;
  rating: number;
  comment?: string;
}

export interface SavePingYuParams {
  id: number;
  apply_id: number;
  content: string;
}

export interface DelCommentParams {
  id: number;
  comment_id: number;
}

export interface SaveAmendImgParams {
  id: number;
  apply_id: number;
  img_url: string;
}

export interface InitCommentParams {
  id: number;
}

// ============================================================
// jielong 模块
// ============================================================

export class JielongModule {
  constructor(private readonly client: JielongClient) {}

  /** 获取接龙列表 */
  list(params?: ActivityListParams): Promise<ApiResponse<ActivityListResponse>> {
    return this.client.post("JieLong/getActivityList", (params ?? {}) as Record<string, unknown>);
  }

  /** 创建/编辑接龙活动 */
  submitActivity(params: SubmitActivityParams): Promise<ApiResponse<SubmitActivityResponse>> {
    return this.client.post("JieLong/submitActivity", params as Record<string, unknown>);
  }

  /** 获取接龙详情 */
  getDetails(params: GetDetailsParams): Promise<ApiResponse<ActivityDetail>> {
    return this.client.post("JieLong/getDetails", params as Record<string, unknown>);
  }

  /** 获取投票统计 */
  votingStatistics(params: VotingStatisticsParams): Promise<ApiResponse<unknown>> {
    return this.client.post("JieLong/votingStatistics", params as Record<string, unknown>);
  }

  /** 获取打卡人名单 */
  getDetailsClockNames(params: GetDetailsParams): Promise<ApiResponse<string[]>> {
    return this.client.post("JieLong/getDetailsClockNames", params as Record<string, unknown>);
  }

  /** 增加浏览次数 */
  incLookCount(params: { id: number }): Promise<ApiResponse<null>> {
    return this.client.post("JieLong/incLookCount", params as Record<string, unknown>);
  }

  /** 获取参与列表 */
  getApplyList(params: ApplyListParams): Promise<ApiResponse<ApplyListResponse>> {
    return this.client.post("JieLong/getApplyList", params as Record<string, unknown>);
  }

  /** 获取管理员列表 */
  getAdmin(params: AdminParams): Promise<ApiResponse<AdminResponse>> {
    return this.client.post("JieLong/getAdmin", params as Record<string, unknown>);
  }

  /** 撤销管理员 */
  cancelAdmin(params: { id: number; uid: number }): Promise<ApiResponse<null>> {
    return this.client.post("JieLong/cancelAdmin", params as Record<string, unknown>);
  }

  /** 获取管理员二维码 */
  getAdminQrCode(params: QrCodeParams): Promise<ApiResponse<QrCodeResponse>> {
    return this.client.post("JieLong/getAdminQrCode", params as Record<string, unknown>);
  }

  /** 获取加入管理员初始化信息 */
  joinAdminInit(params: { scene: string }): Promise<ApiResponse<unknown>> {
    return this.client.post("JieLong/getJoinAdminInit", params as Record<string, unknown>);
  }

  /** 加入管理员 */
  joinAdmin(params: { id: number; scene: string }): Promise<ApiResponse<null>> {
    return this.client.post("JieLong/joinAdmin", params as Record<string, unknown>);
  }

  /** 获取提醒设置 */
  getRemindInfo(params: RemindInfoParams): Promise<ApiResponse<unknown>> {
    return this.client.post("JieLong/getRemindInfo", params as Record<string, unknown>);
  }

  /** 保存提醒设置 */
  saveRemind(params: SaveRemindParams): Promise<ApiResponse<null>> {
    return this.client.post("JieLong/saveRemind", params as Record<string, unknown>);
  }

  /** 设置活动状态（开启/关闭/删除） */
  setStatus(params: SetStatusParams): Promise<ApiResponse<null>> {
    return this.client.post("JieLong/setStatus", params as Record<string, unknown>);
  }

  /** 根据群组获取用户名单 */
  getUserNameByGroupId(params: GetUserNameByGroupParams): Promise<ApiResponse<string[]>> {
    return this.client.post("JieLong/getUserNameByGroupId", params as Record<string, unknown>);
  }

  /** 提交参与/打卡 */
  submitApply(params: SubmitApplyParams): Promise<ApiResponse<{ apply_id: number }>> {
    return this.client.post("JieLong/submitApply", params as Record<string, unknown>);
  }

  /** 删除参与记录 */
  delData(params: DelDataParams): Promise<ApiResponse<null>> {
    return this.client.post("JieLong/delData", params as Record<string, unknown>);
  }

  /** 批量删除记录 */
  batchDelData(params: BatchDelDataParams): Promise<ApiResponse<null>> {
    return this.client.post("JieLong/batchDelData", params as Record<string, unknown>);
  }

  /** 获取案例列表 */
  getCaseList(params?: CaseListParams): Promise<ApiResponse<{ list: unknown[] }>> {
    return this.client.post("JieLong/getCaseList", (params ?? {}) as Record<string, unknown>);
  }

  /** 获取接龙二维码 */
  getJLQrCode(params: QrCodeParams): Promise<ApiResponse<QrCodeResponse>> {
    return this.client.post("JieLong/getJLQrCode", params as Record<string, unknown>);
  }

  /** 获取表单数据文本 */
  getFormDataText(params: { id: number; apply_id: number }): Promise<ApiResponse<string>> {
    return this.client.post("JieLong/getFormDataText", params as Record<string, unknown>);
  }

  /** 初始化导出任务（获取可导出字段） */
  getExportInit(params: ExportInitParams): Promise<ApiResponse<ExportInitResponse>> {
    return this.client.post("JieLong/getExportInit", params as Record<string, unknown>);
  }

  /** 添加导出任务 */
  addExportJob(params: AddExportJobParams): Promise<ApiResponse<ExportJobResponse>> {
    return this.client.post("JieLong/addExportJob", params as Record<string, unknown>);
  }

  /** 查询导出任务状态 */
  getExportStatus(params: ExportStatusParams): Promise<ApiResponse<ExportStatusResponse>> {
    return this.client.post("JieLong/getExportStatus", params as Record<string, unknown>);
  }

  /** 获取模板类型 */
  getTemplateType(): Promise<ApiResponse<TemplateTypeResponse>> {
    return this.client.post("JieLong/getTemplateType");
  }

  /** 获取模板列表 */
  getTemplateList(params?: TemplateListParams): Promise<ApiResponse<{ list: TemplateItem[] }>> {
    return this.client.post("JieLong/getTemplateList", (params ?? {}) as Record<string, unknown>);
  }

  /** 保存自定义配置 */
  saveCustomConfig(params: SaveCustomConfigParams): Promise<ApiResponse<null>> {
    return this.client.post("JieLong/saveCustomConfig", params as Record<string, unknown>);
  }

  /** 保存评分 */
  saveRating(params: SaveRatingParams): Promise<ApiResponse<null>> {
    return this.client.post("JieLong/saveRating", params as Record<string, unknown>);
  }

  /** 保存评语 */
  savePingYu(params: SavePingYuParams): Promise<ApiResponse<null>> {
    return this.client.post("JieLong/savePingYu", params as Record<string, unknown>);
  }

  /** 删除评论 */
  delComment(params: DelCommentParams): Promise<ApiResponse<null>> {
    return this.client.post("JieLong/delComment", params as Record<string, unknown>);
  }

  /** 保存修改图片 */
  saveAmendImg(params: SaveAmendImgParams): Promise<ApiResponse<null>> {
    return this.client.post("JieLong/saveAmendImg", params as Record<string, unknown>);
  }

  /** 初始化评论 */
  initComment(params: InitCommentParams): Promise<ApiResponse<unknown>> {
    return this.client.post("JieLong/initComment", params as Record<string, unknown>);
  }
}
