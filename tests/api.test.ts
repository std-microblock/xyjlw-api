import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JielongAPI } from "../src/index.js";

// ============================================================
// 辅助：构造 API 实例 + mock fetch
// ============================================================
function makeAPI(token: string | null = "test.jwt.token") {
  return new JielongAPI({
    getToken: () => token,
    baseUrl: "https://api.jielong.kbstore.cn/api/",
  });
}

function stubSuccess(data: unknown = {}, msg = "") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ code: 1, data, msg }),
    })
  );
}

function getLastRequestUrl(): string {
  const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls[calls.length - 1][0] as string;
}

function getLastRequestBody(): URLSearchParams {
  const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
  return new URLSearchParams(calls[calls.length - 1][1].body as string);
}

afterEach(() => vi.unstubAllGlobals());

// ============================================================
// common 模块测试
// ============================================================
describe("CommonModule", () => {
  beforeEach(() => stubSuccess({ activity_type: [] }));

  it("initData 请求路径正确", async () => {
    const api = makeAPI();
    await api.common.initData();
    expect(getLastRequestUrl()).toContain("Index/initData");
  });

  it("getOssSign 请求路径正确", async () => {
    const api = makeAPI();
    await api.common.getOssSign();
    expect(getLastRequestUrl()).toContain("Upload/getOssSign");
  });

  it("getServeTime 请求路径正确", async () => {
    const api = makeAPI();
    await api.common.getServeTime();
    expect(getLastRequestUrl()).toContain("Index/getServeTime");
  });
});

// ============================================================
// user 模块测试
// ============================================================
describe("UserModule", () => {
  it("autoLogin 传递 code 参数", async () => {
    stubSuccess({ token: "new.token", uid: 1, is_new: 0 });
    const api = makeAPI(null);
    await api.user.autoLogin({ code: "wx_code_123" });
    const body = getLastRequestBody();
    expect(body.get("code")).toBe("wx_code_123");
    expect(getLastRequestUrl()).toContain("Login/login");
  });

  it("modifyUserData 传递 nickname", async () => {
    stubSuccess(null);
    const api = makeAPI();
    await api.user.modifyUserData({ nickname: "张三", gender: 1 });
    const body = getLastRequestBody();
    expect(body.get("nickname")).toBe("张三");
    expect(body.get("gender")).toBe("1");
  });

  it("getFeeInfo 请求路径正确", async () => {
    stubSuccess({ balance: 100 });
    const api = makeAPI();
    await api.user.getFeeInfo();
    expect(getLastRequestUrl()).toContain("User/getFeeInfo");
  });
});

// ============================================================
// jielong 模块测试
// ============================================================
describe("JielongModule", () => {
  it("list 默认请求路径正确", async () => {
    stubSuccess({ list: [], total: 0, curpage: 1 });
    const api = makeAPI();
    await api.jielong.list();
    expect(getLastRequestUrl()).toContain("JieLong/getActivityList");
  });

  it("list 传递分页参数", async () => {
    stubSuccess({ list: [], total: 0 });
    const api = makeAPI();
    await api.jielong.list({ curpage: 2, tabType: 1 });
    const body = getLastRequestBody();
    expect(body.get("curpage")).toBe("2");
    expect(body.get("tabType")).toBe("1");
  });

  it("submitActivity 传递标题和类型", async () => {
    stubSuccess({ id: 42 });
    const api = makeAPI();
    await api.jielong.submitActivity({ title: "期末考勤", type: 1 });
    const body = getLastRequestBody();
    expect(body.get("title")).toBe("期末考勤");
    expect(body.get("type")).toBe("1");
    expect(getLastRequestUrl()).toContain("JieLong/submitActivity");
  });

  it("getDetails 传递 id", async () => {
    stubSuccess({ id: 1, title: "测试接龙" });
    const api = makeAPI();
    await api.jielong.getDetails({ id: 99 });
    const body = getLastRequestBody();
    expect(body.get("id")).toBe("99");
  });

  it("setStatus 传递 id 和 status", async () => {
    stubSuccess(null);
    const api = makeAPI();
    await api.jielong.setStatus({ id: 10, status: 0 });
    const body = getLastRequestBody();
    expect(body.get("id")).toBe("10");
    expect(body.get("status")).toBe("0");
  });

  it("submitApply 传递真实参与参数", async () => {
    stubSuccess({ apply_id: 100 });
    const api = makeAPI();
    await api.jielong.submitApply({
      id: 0,
      activity_id: 5,
      name: "李四",
      content: [{ id: "name", value: "李四" }],
      sign_img: "https://example.com/test.jpg",
    });
    const body = getLastRequestBody();
    expect(body.get("id")).toBe("0");
    expect(body.get("activity_id")).toBe("5");
    expect(body.get("name")).toBe("李四");
    expect(body.get("content")).toBe('[{"id":"name","value":"李四"}]');
    expect(body.get("sign_img")).toBe("https://example.com/test.jpg");
  });

  it("getExportStatus 传递 job_id", async () => {
    stubSuccess({ status: "done", progress: 100, download_url: "https://example.com/file.xlsx" });
    const api = makeAPI();
    await api.jielong.getExportStatus({ job_id: "job_abc123" });
    const body = getLastRequestBody();
    expect(body.get("job_id")).toBe("job_abc123");
    expect(getLastRequestUrl()).toContain("JieLong/getExportStatus");
  });
});

// ============================================================
// group 模块测试
// ============================================================
describe("GroupModule", () => {
  it("addGroup 传递 name", async () => {
    stubSuccess({ id: 1 });
    const api = makeAPI();
    await api.group.addGroup({ name: "高三二班" });
    const body = getLastRequestBody();
    expect(body.get("name")).toBe("高三二班");
    expect(getLastRequestUrl()).toContain("Group/addGroup");
  });

  it("groupList 传递分页参数", async () => {
    stubSuccess({ list: [], total: 0 });
    const api = makeAPI();
    await api.group.groupList({ curpage: 1, page_size: 10 });
    const body = getLastRequestBody();
    expect(body.get("page_size")).toBe("10");
  });

  it("doJoinGroup 传递 id", async () => {
    stubSuccess(null);
    const api = makeAPI();
    await api.group.doJoinGroup({ id: 7 });
    const body = getLastRequestBody();
    expect(body.get("id")).toBe("7");
    expect(getLastRequestUrl()).toContain("Group/doJoinGroup");
  });
});

// ============================================================
// orders 模块测试
// ============================================================
describe("OrdersModule", () => {
  it("submitOrder 传递 goods_id", async () => {
    stubSuccess({ order_id: 1, order_no: "ORD001", amount: 9.9 });
    const api = makeAPI();
    await api.orders.submitOrder({ goods_id: 3 });
    const body = getLastRequestBody();
    expect(body.get("goods_id")).toBe("3");
    expect(getLastRequestUrl()).toContain("Orders/submitOrder");
  });

  it("getOrderList 传递状态过滤", async () => {
    stubSuccess({ list: [], total: 0 });
    const api = makeAPI();
    await api.orders.getOrderList({ status: 1 });
    const body = getLastRequestBody();
    expect(body.get("status")).toBe("1");
  });
});

// ============================================================
// score 模块测试
// ============================================================
describe("ScoreModule", () => {
  it("getScore 请求路径正确", async () => {
    stubSuccess({ score: 250 });
    const api = makeAPI();
    await api.score.getScore();
    expect(getLastRequestUrl()).toContain("Score/getScore");
  });

  it("getTodayFeeInfo 请求路径正确", async () => {
    stubSuccess({ today_income: 10.5 });
    const api = makeAPI();
    await api.score.getTodayFeeInfo();
    expect(getLastRequestUrl()).toContain("Score/getTodayFeeInfo");
  });
});

// ============================================================
// jlQuery 模块测试
// ============================================================
describe("JlQueryModule", () => {
  it("getStatistics 传递 id", async () => {
    stubSuccess({ total: 30, signed: 25, unsigned: 5, late: 2, chart: [] });
    const api = makeAPI();
    await api.query.getStatistics({ id: 11 });
    const body = getLastRequestBody();
    expect(body.get("id")).toBe("11");
    expect(getLastRequestUrl()).toContain("Query/getStatistics");
  });

  it("confirmSign 传递签到状态", async () => {
    stubSuccess(null);
    const api = makeAPI();
    await api.query.confirmSign({ id: 11, apply_id: 55, status: 1 });
    const body = getLastRequestBody();
    expect(body.get("apply_id")).toBe("55");
    expect(body.get("status")).toBe("1");
    expect(getLastRequestUrl()).toContain("Query/confirmSign");
  });
});

// ============================================================
// help 模块测试
// ============================================================
describe("HelpModule", () => {
  it("getVideoList 请求路径正确", async () => {
    stubSuccess({ list: [] });
    const api = makeAPI();
    await api.help.getVideoList();
    expect(getLastRequestUrl()).toContain("Help/getVideoList");
  });

  it("getGroupList 请求路径正确", async () => {
    stubSuccess({ list: [] });
    const api = makeAPI();
    await api.help.getGroupList();
    expect(getLastRequestUrl()).toContain("Help/getGroupList");
  });
});

// ============================================================
// JielongAPI 聚合实例测试
// ============================================================
describe("JielongAPI 聚合实例", () => {
  it("所有模块均已挂载", () => {
    const api = makeAPI();
    expect(api.common).toBeDefined();
    expect(api.user).toBeDefined();
    expect(api.jielong).toBeDefined();
    expect(api.group).toBeDefined();
    expect(api.orders).toBeDefined();
    expect(api.score).toBeDefined();
    expect(api.query).toBeDefined();
    expect(api.news).toBeDefined();
    expect(api.goods).toBeDefined();
    expect(api.help).toBeDefined();
  });
});
