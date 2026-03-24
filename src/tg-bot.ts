import { resolve } from "node:path";

import { AutoSignBot, DEFAULT_SIGN_IMAGE_URL, normalizeBearerToken } from "./bot.js";
import { createFileTokenStore } from "./token-store.js";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

function parseJsonEnv(name: string): Record<string, unknown> {
  const raw = process.env[name]?.trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return parsed && typeof parsed === "object" ? parsed : {};
}

async function main() {
  const tokenFilePath = process.env.JL_TOKEN_FILE
    ? resolve(process.env.JL_TOKEN_FILE)
    : resolve(".runtime/jielong-token.json");
  const watchFilePath = process.env.JL_WATCH_FILE
    ? resolve(process.env.JL_WATCH_FILE)
    : resolve(".runtime/jielong-watch.json");

  const tokenStore = createFileTokenStore({
    filePath: tokenFilePath,
    initialToken: normalizeBearerToken(process.env.JL_TOKEN),
  });

  const bot = new AutoSignBot({
    telegram: {
      botToken: requireEnv("TG_BOT_TOKEN"),
      chatId: process.env.TG_CHAT_ID,
    },
    tokenStore,
    watchFilePath,
    defaultImageUrl: process.env.JL_SIGN_IMAGE_URL || DEFAULT_SIGN_IMAGE_URL,
    defaultName: process.env.JL_SIGN_NAME || "",
    defaultFormValues: parseJsonEnv("JL_FORM_VALUES_JSON"),
    pollIntervalMs: Number(process.env.JL_POLL_INTERVAL_MS || 60000),
  });

  await bot.start();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
