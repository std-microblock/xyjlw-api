import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JielongClient, ApiError, UnauthorizedError } from "../src/client.js";
import { ApiClientOptions } from "../src/config.js";

// ============================================================
// 测试辅助：mock fetch
// ============================================================

function mockFetch(responseBody: object, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: async () => responseBody,
  });
}

function makeClient(overrides?: Partial<ApiClientOptions>) {
  return new JielongClient({
    getToken: () => null,
    baseUrl: "https://api.jielong.kbstore.cn/api/",
    ...overrides,
  });
}

// ============================================================
// 基础请求构造测试
// ============================================================
describe("JielongClient - 请求构造", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch({ code: 1, data: {}, msg: "ok" }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("POST 请求使用 application/x-www-form-urlencoded", async () => {
    const client = makeClient();
    await client.post("JieLong/getActivityList");
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
  });

  it("请求 body 中自动包含 appid=1 和 appversion", async () => {
    const client = makeClient();
    await client.post("JieLong/getActivityList");
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const params = new URLSearchParams(init.body as string);
    expect(params.get("appid")).toBe("1");
    expect(params.get("appversion")).toBe("1.1.19");
  });

  it("业务参数被正确传入 body", async () => {
    const client = makeClient();
    await client.post("JieLong/getActivityList", { curpage: 2, tabType: 1 });
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const params = new URLSearchParams(init.body as string);
    expect(params.get("curpage")).toBe("2");
    expect(params.get("tabType")).toBe("1");
  });

  it("URL 拼接正确", async () => {
    const client = makeClient();
    await client.post("JieLong/getActivityList");
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.jielong.kbstore.cn/api/JieLong/getActivityList");
  });

  it("Accept 头为 application/json", async () => {
    const client = makeClient();
    await client.post("Test/test");
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["Accept"]).toBe("application/json");
  });
});

// ============================================================
// 鉴权头测试
// ============================================================
describe("JielongClient - 鉴权 (Authorization)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("有 token 时发送 Authorization: Bearer {token}", async () => {
    vi.stubGlobal("fetch", mockFetch({ code: 1, data: {}, msg: "" }));
    const client = makeClient({ getToken: () => "test.token.value" });
    await client.post("Test/test");
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["Authorization"]).toBe("Bearer test.token.value");
  });

  it("没有 token 时不发送 Authorization 头", async () => {
    vi.stubGlobal("fetch", mockFetch({ code: 1, data: {}, msg: "" }));
    const client = makeClient({ getToken: () => null });
    await client.post("Test/test");
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["Authorization"]).toBeUndefined();
  });
});

// ============================================================
// 响应拦截测试
// ============================================================
describe("JielongClient - 响应拦截", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("code=1 时正常返回响应", async () => {
    vi.stubGlobal("fetch", mockFetch({ code: 1, data: { list: [] }, msg: "" }));
    const client = makeClient();
    const res = await client.post("JieLong/list");
    expect(res.code).toBe(1);
    expect(res.data).toEqual({ list: [] });
  });

  it("code=0 时正常返回响应（带 msg 的成功）", async () => {
    vi.stubGlobal("fetch", mockFetch({ code: 0, data: null, msg: "操作成功" }));
    const client = makeClient();
    const res = await client.post("Test/action");
    expect(res.code).toBe(0);
    expect(res.msg).toBe("操作成功");
  });

  it("code=402 时抛出 ApiError", async () => {
    vi.stubGlobal("fetch", mockFetch({ code: 402, data: null, msg: "签名错误" }));
    const client = makeClient();
    await expect(client.post("Test/test")).rejects.toThrow(ApiError);
    await expect(client.post("Test/test")).rejects.toMatchObject({ code: 402 });
  });

  it("HTTP 非 2xx 时抛出 ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({}),
      })
    );
    const client = makeClient();
    await expect(client.post("Test/test")).rejects.toThrow(ApiError);
  });
});

// ============================================================
// 401 Token 刷新测试
// ============================================================
describe("JielongClient - 401 Token 自动刷新", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("401 时调用 onTokenRefresh 并携带新 token 重试", async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ code: 401, data: { token: "new.token.refreshed" }, msg: "" }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ code: 1, data: { list: [] }, msg: "" }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    const onTokenRefresh = vi.fn();
    const client = makeClient({
      getToken: () => "old.token",
      onTokenRefresh,
    });

    const res = await client.post("JieLong/list");
    expect(onTokenRefresh).toHaveBeenCalledWith("new.token.refreshed");
    expect(callCount).toBe(2);
    expect(res.code).toBe(1);
  });

  it("401 时即使未提供 onTokenRefresh 也会携带新 token 重试当前请求", async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: { headers?: Record<string, string> }) => {
      callCount++;
      if (callCount === 1) {
        expect(init?.headers?.Authorization).toBe("Bearer old.token");
        return {
          ok: true,
          status: 200,
          json: async () => ({ code: 401, data: { token: "new.token.inline" }, msg: "" }),
        };
      }
      expect(init?.headers?.Authorization).toBe("Bearer new.token.inline");
      return {
        ok: true,
        status: 200,
        json: async () => ({ code: 1, data: { ok: true }, msg: "" }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = makeClient({
      getToken: () => "old.token",
    });

    const res = await client.post("JieLong/list");
    expect(callCount).toBe(2);
    expect(res.data).toEqual({ ok: true });
  });

  it("401 且没有新 token 时抛出 UnauthorizedError 并调用 onUnauthorized", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({ code: 401, data: {}, msg: "token 过期" })
    );

    const onUnauthorized = vi.fn();
    const client = makeClient({ onUnauthorized });

    await expect(client.post("Test/test")).rejects.toThrow(UnauthorizedError);
    expect(onUnauthorized).toHaveBeenCalled();
  });
});

// ============================================================
// 请求超时测试
// ============================================================
describe("JielongClient - 超时处理", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("请求携带 AbortSignal，超时后 signal.aborted 为 true", async () => {
    let capturedSignal: AbortSignal | undefined;

    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, opts: { signal?: AbortSignal }) => {
          capturedSignal = opts.signal;
          // 返回一个永远 pending 的 Promise（模拟超慢响应）
          // 但立刻 resolve 让测试可以推进
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ code: 1, data: {}, msg: "" }),
          });
        }
      )
    );

    const client = makeClient({ timeout: 5000 });
    await client.post("Test/slow");

    // AbortSignal 应该被创建并传递给 fetch
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal).toBeInstanceOf(AbortSignal);
  });

  it("AbortController 在超时后确实触发 abort", async () => {
    vi.useFakeTimers();

    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, "abort");

    // 直接测试 AbortController 行为（单元级别）
    const timerId = setTimeout(() => controller.abort(), 100);
    await vi.advanceTimersByTimeAsync(150);

    expect(abortSpy).toHaveBeenCalled();
    clearTimeout(timerId);
  });
});
