import CryptoJS from "crypto-js";
import { AES_CONFIG } from "../config.js";

// ============================================================
// AES-CBC + PKCS7 加解密工具
// 与小程序 vendor.js 中 Encrypt/Decrypt 实现完全一致
// ============================================================

const KEY = CryptoJS.enc.Utf8.parse(AES_CONFIG.KEY);
const IV = CryptoJS.enc.Utf8.parse(AES_CONFIG.IV);

/**
 * AES 加密
 * @param plainText 明文字符串
 * @returns Hex 密文字符串
 */
export function aesEncrypt(plainText: string): string {
  const content = CryptoJS.enc.Utf8.parse(plainText);
  const encrypted = CryptoJS.AES.encrypt(content, KEY, {
    iv: IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  // 返回 hex 字符串（与小程序一致：.ciphertext.toString()）
  return encrypted.ciphertext.toString();
}

/**
 * AES 解密
 * @param hexCipher Hex 密文字符串
 * @returns 明文字符串
 */
export function aesDecrypt(hexCipher: string): string {
  const hexParsed = CryptoJS.enc.Hex.parse(hexCipher);
  const base64Str = CryptoJS.enc.Base64.stringify(hexParsed);
  const decrypted = CryptoJS.AES.decrypt(base64Str, KEY, {
    iv: IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

// ============================================================
// JWT Token 解析工具
// ============================================================

export interface ParsedToken {
  uid: number;
  role: string[];
  permission: string[];
  tokenExpired: number;
}

/**
 * 解析 JWT Token Payload（不验签，仅解码）
 * 对应小程序 vendor.js getTokenInfo 函数
 */
export function parseToken(token: string): ParsedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // base64url → base64
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));

    return {
      uid: json.uid ?? 0,
      role: Array.isArray(json.role) ? json.role : [],
      permission: Array.isArray(json.permission) ? json.permission : [],
      tokenExpired: (json.exp ?? 0) * 1000,
    };
  } catch {
    return null;
  }
}

/**
 * 判断 token 是否已过期
 */
export function isTokenExpired(token: string): boolean {
  const parsed = parseToken(token);
  if (!parsed) return true;
  return Date.now() >= parsed.tokenExpired;
}
