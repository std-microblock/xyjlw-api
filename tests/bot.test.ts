import { describe, expect, it } from "vitest";

import {
  DEFAULT_SIGN_IMAGE_URL,
  buildSubmitApplyPayload,
  buildSubmitContent,
  buildDecisionCallbackData,
  deriveNextActivityId,
  extractActivitySignSource,
  normalizeBearerToken,
  parseDecisionCallbackData,
} from "../src/bot.js";

describe("bot helpers", () => {
  it("normalizeBearerToken 会去掉 Bearer 前缀", () => {
    expect(normalizeBearerToken("Bearer abc.def")).toBe("abc.def");
    expect(normalizeBearerToken("bearer xyz")).toBe("xyz");
    expect(normalizeBearerToken("plain.token")).toBe("plain.token");
    expect(normalizeBearerToken("")).toBeNull();
  });

  it("buildSubmitApplyPayload 会生成真实 submitApply 参数", () => {
    const payload = buildSubmitApplyPayload(123, {
      name: "张三",
      content: [{ id: "name", value: "张三" }],
      signImgUrl: "https://example.com/sign.jpg",
    });

    expect(payload).toEqual({
      id: 0,
      activity_id: 123,
      name: "张三",
      content: [{ id: "name", value: "张三" }],
      sign_img: "https://example.com/sign.jpg",
    });
  });

  it("未指定图片时使用默认图片", () => {
    const payload = buildSubmitApplyPayload(7);
    expect(payload.sign_img).toBe(DEFAULT_SIGN_IMAGE_URL);
  });

  it("buildSubmitContent 会按字段 id 和标题映射表单值", () => {
    const content = buildSubmitContent(
      [
        { id: "name", data: { title: "姓名" } },
        { id: "student_no", data: { title: "学号" } },
        { id: "photo", data: { title: "图片" } },
      ],
      {
        name: "张三",
        formValues: {
          学号: "20231234",
          photo: "https://example.com/a.jpg",
        },
      }
    );

    expect(content).toEqual([
      { id: "name", type: undefined, title: "姓名", value: "张三" },
      { id: "student_no", type: undefined, title: "学号", value: "20231234" },
      { id: "photo", type: undefined, title: "图片", value: "https://example.com/a.jpg" },
    ]);
  });
  it("deriveNextActivityId polling cursor", () => {
    expect(
      deriveNextActivityId({
        polling: { nextActivityId: 300 },
        activities: [{ activityId: 10 }],
        state: [{ activityId: 20 }],
      })
    ).toBe(300);

    expect(
      deriveNextActivityId({
        activities: [{ activityId: 10 }, { activityId: 19 }],
        state: [{ activityId: 25 }],
      })
    ).toBe(26);
  });

  it("extractActivitySignSource", () => {
    expect(
      extractActivitySignSource({
        user_id: 123,
        member: [
          { user_id: 100, name: "张三" },
          { user_id: 123, name: "李四" },
        ],
      })
    ).toEqual({ userId: 123, name: "李四" });

    expect(
      extractActivitySignSource({
        user_id: 456,
        member: JSON.stringify([{ userid: 456, nickname: "王五" }]),
      })
    ).toEqual({ userId: 456, name: "王五" });
  });

  it("callback data 构建和解析是正确的", () => {
    const data = buildDecisionCallbackData("auto", 35791);
    expect(data).toBe("jl:auto:35791");
    expect(parseDecisionCallbackData(data)).toEqual({
      action: "auto",
      activityId: 35791,
    });
    expect(parseDecisionCallbackData("bad:data")).toBeNull();
  });
});
