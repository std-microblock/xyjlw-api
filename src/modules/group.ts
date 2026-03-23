import { JielongClient } from "../client.js";
import { ApiResponse } from "../config.js";

// ============================================================
// group 模块类型
// ============================================================

export interface AddGroupParams {
  name: string;
  description?: string;
  type?: number;
}

export interface GroupItem {
  id: number;
  name: string;
  description: string;
  type: number;
  member_count: number;
  created_at: string;
}

export interface GroupListParams {
  curpage?: number;
  page_size?: number;
  keyword?: string;
}

export interface GroupInfoParams {
  id: number;
}

export interface UpdateGroupParams {
  id: number;
  name?: string;
  description?: string;
}

export interface GroupMemberParams {
  id: number;
  curpage?: number;
  page_size?: number;
}

export interface MemberItem {
  id: number;
  uid: number;
  nickname: string;
  avatar: string;
  role: number;
  joined_at: string;
}

export interface SetMemberParams {
  id: number;
  uid: number;
  role: number;
}

export interface SaveMemberParams {
  id: number;
  members: Array<{ name: string; extra?: string }>;
}

export interface JoinGroupInitParams {
  scene: string;
}

export interface DoJoinGroupParams {
  id: number;
  scene?: string;
}

export interface MemberByRemindParams {
  id: number;
  activity_id: number;
}

// ============================================================
// group 模块
// ============================================================

export class GroupModule {
  constructor(private readonly client: JielongClient) {}

  /** 创建群组/班级 */
  addGroup(params: AddGroupParams): Promise<ApiResponse<{ id: number }>> {
    return this.client.post("Group/addGroup", params as Record<string, unknown>);
  }

  /** 获取群组列表 */
  groupList(params?: GroupListParams): Promise<ApiResponse<{ list: GroupItem[]; total: number }>> {
    return this.client.post("Group/groupList", (params ?? {}) as Record<string, unknown>);
  }

  /** 获取群组详情 */
  getGroupInfo(params: GroupInfoParams): Promise<ApiResponse<GroupItem>> {
    return this.client.post("Group/getGroupInfo", params as Record<string, unknown>);
  }

  /** 获取群组未订阅人数 */
  getGroupNoSubscribeNum(params: GroupInfoParams): Promise<ApiResponse<{ count: number }>> {
    return this.client.post("Group/getGroupNoSubscribeNum", params as Record<string, unknown>);
  }

  /** 更新群组信息 */
  updateGroupInfo(params: UpdateGroupParams): Promise<ApiResponse<null>> {
    return this.client.post("Group/updateGroupInfo", params as Record<string, unknown>);
  }

  /** 获取群组成员 */
  groupMember(params: GroupMemberParams): Promise<ApiResponse<{ list: MemberItem[]; total: number }>> {
    return this.client.post("Group/groupMember", params as Record<string, unknown>);
  }

  /** 设置成员角色 */
  setMember(params: SetMemberParams): Promise<ApiResponse<null>> {
    return this.client.post("Group/setMember", params as Record<string, unknown>);
  }

  /** 获取成员名单文本 */
  getMemberNames(params: GroupInfoParams): Promise<ApiResponse<{ names: string[] }>> {
    return this.client.post("Group/getMemberNames", params as Record<string, unknown>);
  }

  /** 批量保存成员（导入名单） */
  saveMember(params: SaveMemberParams): Promise<ApiResponse<{ added: number }>> {
    return this.client.post("Group/saveMember", params as Record<string, unknown>);
  }

  /** 获取群组邀请二维码 */
  getGroupQrCode(params: GroupInfoParams): Promise<ApiResponse<{ qrcode: string }>> {
    return this.client.post("Group/getGroupQrCode", params as Record<string, unknown>);
  }

  /** 获取加入群组初始化信息 */
  joinGroupInit(params: JoinGroupInitParams): Promise<ApiResponse<{ group_id: number; group_name: string }>> {
    return this.client.post("Group/joinGroupInit", params as Record<string, unknown>);
  }

  /** 加入群组 */
  doJoinGroup(params: DoJoinGroupParams): Promise<ApiResponse<null>> {
    return this.client.post("Group/doJoinGroup", params as Record<string, unknown>);
  }

  /** 获取需要提醒的群组成员 */
  getMemberByRemind(params: MemberByRemindParams): Promise<ApiResponse<MemberItem[]>> {
    return this.client.post("Group/getMemberByRemind", params as Record<string, unknown>);
  }
}
