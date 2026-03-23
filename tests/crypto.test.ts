import { describe, it, expect } from "vitest";
import { aesEncrypt, aesDecrypt, parseToken, isTokenExpired } from "../src/utils/crypto.js";

// ============================================================
// AES 加解密测试
// ============================================================
describe("AES 加解密 (crypto.ts)", () => {
  const plainTexts = ["hello world", "用户数据", "123456", '{"key":"value"}'];

  it("加密结果应为 hex 字符串（非空、全小写十六进制）", () => {
    const encrypted = aesEncrypt("hello world");
    expect(encrypted).toMatch(/^[0-9a-f]+$/);
    expect(encrypted.length).toBeGreaterThan(0);
  });

  it.each(plainTexts)("加密后解密应还原原文: %s", (text) => {
    const encrypted = aesEncrypt(text);
    const decrypted = aesDecrypt(encrypted);
    expect(decrypted).toBe(text);
  });

  it("相同明文每次加密结果一致（CBC + 固定 IV）", () => {
    const e1 = aesEncrypt("test");
    const e2 = aesEncrypt("test");
    expect(e1).toBe(e2);
  });

  it("不同明文的加密结果不同", () => {
    const e1 = aesEncrypt("aaa");
    const e2 = aesEncrypt("bbb");
    expect(e1).not.toBe(e2);
  });

  it("解密错误的密文应抛出或返回空字符串", () => {
    // CryptoJS 在解密非法数据时会返回空字符串
    const result = aesDecrypt("invalidhex0000");
    expect(typeof result).toBe("string");
  });
});

// ============================================================
// JWT Token 解析测试
// ============================================================
describe("JWT Token 解析 (parseToken)", () => {
  // 使用 btoa 构造合法 JWT（测试用，不真实签名）
  const makeToken = (payload: object) => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify(payload))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    return `${header}.${body}.fake_signature`;
  };

  it("正常解析包含 uid/role/permission/exp 的 token", () => {
    const expSeconds = Math.floor(Date.now() / 1000) + 3600;
    const token = makeToken({
      uid: 12345,
      role: ["admin"],
      permission: ["read", "write"],
      exp: expSeconds,
      iat: Math.floor(Date.now() / 1000),
    });

    const result = parseToken(token);
    expect(result).not.toBeNull();
    expect(result!.uid).toBe(12345);
    expect(result!.role).toEqual(["admin"]);
    expect(result!.permission).toEqual(["read", "write"]);
    expect(result!.tokenExpired).toBe(expSeconds * 1000);
  });

  it("缺少字段时使用默认值", () => {
    const token = makeToken({ uid: 99 });
    const result = parseToken(token);
    expect(result).not.toBeNull();
    expect(result!.uid).toBe(99);
    expect(result!.role).toEqual([]);
    expect(result!.permission).toEqual([]);
    expect(result!.tokenExpired).toBe(0);
  });

  it("格式错误的 token（非3段）返回 null", () => {
    expect(parseToken("invalid")).toBeNull();
    expect(parseToken("a.b")).toBeNull();
    expect(parseToken("")).toBeNull();
  });

  it("payload 非合法 JSON 返回 null", () => {
    const result = parseToken("header.notjson.sig");
    expect(result).toBeNull();
  });
});

// ============================================================
// Token 过期判断测试
// ============================================================
describe("isTokenExpired", () => {
  const makeToken = (payload: object) => {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify(payload))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    return `${header}.${body}.sig`;
  };

  it("未过期 token 返回 false", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
    expect(isTokenExpired(token)).toBe(false);
  });

  it("已过期 token 返回 true", () => {
    const token = makeToken({ exp: Math.floor(Date.now() / 1000) - 1 });
    expect(isTokenExpired(token)).toBe(true);
  });

  it("无效 token 返回 true", () => {
    expect(isTokenExpired("bad.token")).toBe(true);
  });

  it("exp=0 视为已过期", () => {
    const token = makeToken({ exp: 0 });
    expect(isTokenExpired(token)).toBe(true);
  });
});
