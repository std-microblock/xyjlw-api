import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { JielongClient } from "./client.js";
import { API_CONFIG, ApiClientOptions } from "./config.js";
import {
  ActivityItem,
  JielongModule,
  SubmitApplyFieldItem,
  SubmitApplyParams,
} from "./modules/jielong.js";
import { TokenStore } from "./token-store.js";
import { parseToken } from "./utils/crypto.js";

export const DEFAULT_SIGN_IMAGE_URL =
  "https://chem.ahu.edu.cn/_upload/article/images/5f/d6/7aa133b045d58b3d0219da455788/cc666447-e917-4776-9857-d8a41a7cf07d.jpg";

type FormValueMap = Record<string, unknown>;

export interface TelegramBotConfig {
  botToken: string;
  chatId?: string | number;
  pollTimeoutSeconds?: number;
  fetchImpl?: typeof fetch;
}

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: { id: number | string };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

export class TelegramBot {
  private readonly botToken: string;
  private readonly fetchImpl: typeof fetch;
  private readonly pollTimeoutSeconds: number;
  private readonly apiBase: string;

  constructor(config: TelegramBotConfig) {
    this.botToken = config.botToken;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.pollTimeoutSeconds = config.pollTimeoutSeconds ?? 25;
    this.apiBase = `https://api.telegram.org/bot${this.botToken}`;
  }

  async getUpdates(offset?: number): Promise<TelegramUpdate[]> {
    const payload: Record<string, unknown> = {
      timeout: this.pollTimeoutSeconds,
      allowed_updates: ["message"],
    };
    if (offset) payload.offset = offset;
    const res = await this.request<TelegramUpdate[]>("getUpdates", payload);
    return res.result;
  }

  async sendMessage(chatId: string | number, text: string): Promise<void> {
    await this.request("sendMessage", {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    });
  }

  private async request<T>(method: string, payload: Record<string, unknown>): Promise<TelegramResponse<T>> {
    const res = await this.fetchImpl(`${this.apiBase}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Telegram API ${method} failed: HTTP ${res.status}`);
    }

    const json = (await res.json()) as TelegramResponse<T>;
    if (!json.ok) {
      throw new Error(`Telegram API ${method} failed: ${json.description ?? "unknown error"}`);
    }
    return json;
  }
}

export interface SubmitApplyPreset {
  name?: string;
  content?: string | SubmitApplyFieldItem[] | FormValueMap;
  formValues?: FormValueMap | SubmitApplyFieldItem[];
  signImgUrl?: string;
}

export interface WatchedActivity extends SubmitApplyPreset {
  activityId: number;
  alias?: string;
  autoSign?: boolean;
  reminderMinutesBeforeEnd?: number;
}

export interface ActivityRuntimeState {
  activityId: number;
  title?: string;
  lastReminderAt?: string;
  lastSignAt?: string;
  lastSignResult?: "success" | "failed";
  lastError?: string;
}

export interface BotProfile {
  defaults?: SubmitApplyPreset;
  activities?: WatchedActivity[];
  state?: ActivityRuntimeState[];
}

export interface AutoSignBotConfig {
  telegram: TelegramBotConfig;
  tokenStore: TokenStore;
  watchFilePath: string;
  defaultImageUrl?: string;
  defaultName?: string;
  defaultFormValues?: FormValueMap;
  pollIntervalMs?: number;
  baseUrl?: string;
}

interface WatchFilePayload extends BotProfile {
  watched?: WatchedActivity[];
  updatedAt: string;
}

interface ActivityFormItem {
  id: string;
  type?: string;
  title?: string;
  data?: Record<string, unknown>;
}

interface ActivityDetailLike {
  id?: number;
  title?: string;
  status?: number;
  end_time?: string | number;
  my_apply?: unknown;
  mySubmit?: unknown;
  form?: ActivityFormItem[] | string;
}

export function normalizeBearerToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^Bearer\s+/i, "");
}

export function buildSubmitApplyPayload(
  activityId: number,
  preset: SubmitApplyPreset = {}
): SubmitApplyParams {
  return {
    id: 0,
    activity_id: activityId,
    name: preset.name ?? "",
    content: preset.content ?? preset.formValues ?? "",
    sign_img: preset.signImgUrl ?? DEFAULT_SIGN_IMAGE_URL,
  };
}

export function buildSubmitContent(
  form: ActivityFormItem[] | string | undefined,
  preset: SubmitApplyPreset = {}
): string | SubmitApplyFieldItem[] {
  const explicitContent = preset.content;
  if (typeof explicitContent === "string") return explicitContent;
  if (Array.isArray(explicitContent)) return explicitContent;
  if (explicitContent && typeof explicitContent === "object") {
    return buildFieldArray(normalizeFormItems(form), explicitContent, preset.name);
  }

  const explicitFormValues = preset.formValues;
  if (Array.isArray(explicitFormValues)) return explicitFormValues;
  if (explicitFormValues && typeof explicitFormValues === "object") {
    return buildFieldArray(normalizeFormItems(form), explicitFormValues, preset.name);
  }

  const normalizedForm = normalizeFormItems(form);
  if (!normalizedForm.length) return "";
  return buildFieldArray(normalizedForm, {}, preset.name);
}

function normalizeFormItems(form: ActivityFormItem[] | string | undefined): ActivityFormItem[] {
  if (!form) return [];
  if (Array.isArray(form)) return form;
  try {
    const parsed = JSON.parse(form) as ActivityFormItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildFieldArray(
  formItems: ActivityFormItem[],
  formValues: FormValueMap,
  defaultName?: string
): SubmitApplyFieldItem[] {
  return formItems.map((item) => {
    const title = getFieldTitle(item);
    const mappedValue = resolveFieldValue(item, title, formValues, defaultName);
    return {
      id: item.id,
      type: item.type,
      title,
      value: mappedValue,
    };
  });
}

function getFieldTitle(item: ActivityFormItem): string {
  const data = item.data ?? {};
  const title = data.title;
  return typeof title === "string" && title.trim() ? title.trim() : item.id;
}

function resolveFieldValue(
  item: ActivityFormItem,
  title: string,
  formValues: FormValueMap,
  defaultName?: string
): unknown {
  if (item.id === "name" && defaultName) return defaultName;
  if ((title.includes("姓名") || title.includes("名字")) && defaultName) return defaultName;

  if (Object.prototype.hasOwnProperty.call(formValues, item.id)) {
    return formValues[item.id];
  }
  if (Object.prototype.hasOwnProperty.call(formValues, title)) {
    return formValues[title];
  }

  const normalizedTitle = title.replace(/\s+/g, "");
  if (Object.prototype.hasOwnProperty.call(formValues, normalizedTitle)) {
    return formValues[normalizedTitle];
  }

  return "";
}

export class AutoSignBot {
  private readonly telegram: TelegramBot;
  private readonly tokenStore: TokenStore;
  private readonly watchFilePath: string;
  private readonly pollIntervalMs: number;
  private readonly defaultImageUrl: string;
  private readonly defaultName: string;
  private readonly defaultFormValues: FormValueMap;
  private readonly client: JielongClient;
  private readonly jielong: JielongModule;

  private offset = 0;
  private active = false;
  private runtimeChatId: string | number | null;
  private profile: BotProfile;

  constructor(config: AutoSignBotConfig) {
    this.telegram = new TelegramBot(config.telegram);
    this.tokenStore = config.tokenStore;
    this.watchFilePath = config.watchFilePath;
    this.pollIntervalMs = config.pollIntervalMs ?? 60_000;
    this.defaultImageUrl = config.defaultImageUrl ?? DEFAULT_SIGN_IMAGE_URL;
    this.defaultName = config.defaultName ?? "";
    this.defaultFormValues = config.defaultFormValues ?? {};
    this.runtimeChatId = config.telegram.chatId ?? null;
    this.profile = this.loadProfile();

    const clientOptions: ApiClientOptions = {
      getToken: () => this.tokenStore.getToken(),
      baseUrl: config.baseUrl ?? API_CONFIG.API_URL,
      onTokenRefresh: (newToken) => {
        const normalized = normalizeBearerToken(newToken);
        this.tokenStore.setToken(normalized);
        console.log(`Token 已刷新，新的过期时间: ${this.describeTokenExpiry(normalized)}`);
      },
      onUnauthorized: () => {
        void this.notify("鉴权失败: 当前 token 已失效，自动签到已暂停，请更新 token。");
      },
    };

    this.client = new JielongClient(clientOptions);
    this.jielong = new JielongModule(this.client);
  }

  async start(): Promise<void> {
    this.active = true;
    await Promise.all([this.telegramLoop(), this.activityLoop()]);
  }

  stop(): void {
    this.active = false;
  }

  private async telegramLoop(): Promise<void> {
    while (this.active) {
      try {
        const updates = await this.telegram.getUpdates(this.offset || undefined);
        for (const update of updates) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      } catch (error) {
        console.log(`Telegram polling error: ${this.stringifyError(error)}`);
        await sleep(5_000);
      }
    }
  }

  private async activityLoop(): Promise<void> {
    while (this.active) {
      try {
        const activities = await this.fetchAllActivities();
        for (const activity of activities) {
          await this.checkActivity(activity);
        }
      } catch (error) {
        await this.notify(`活动轮询异常: ${this.stringifyError(error)}`);
      }
      await sleep(this.pollIntervalMs);
    }
  }

  private async fetchAllActivities(): Promise<ActivityItem[]> {
    const all: ActivityItem[] = [];
    let curpage = 1;
    let total = 0;

    do {
      const res = await this.jielong.list({ curpage });
      const pageList = res.data?.list ?? [];
      const pageTotal = Number(res.data?.total ?? pageList.length);
      total = Math.max(total, pageTotal);
      all.push(...pageList);
      curpage += 1;
      if (!pageList.length) break;
    } while (all.length < total && curpage <= 20);

    const dedup = new Map<number, ActivityItem>();
    for (const item of all) {
      dedup.set(item.id, item);
    }
    return [...dedup.values()];
  }

  private async checkActivity(activity: ActivityItem): Promise<void> {
    const override = this.findActivityOverride(activity.id);
    if (override?.autoSign === false) return;

    const res = await this.jielong.getDetails({ id: activity.id });
    const detail = (res.data ?? {}) as ActivityDetailLike;
    const title = detail.title ?? activity.title ?? `活动 ${activity.id}`;
    const state = this.getActivityState(activity.id, title);

    if (detail.my_apply || detail.mySubmit) return;

    await this.maybeSendReminder(activity.id, title, detail, override, state);

    if (Number(detail.status ?? activity.status ?? 0) !== 1) return;

    const preset = this.resolvePreset(activity.id);
    await this.trySignActivity(activity.id, title, detail, preset, state, false);
  }

  private async maybeSendReminder(
    activityId: number,
    title: string,
    detail: ActivityDetailLike,
    override: WatchedActivity | undefined,
    state: ActivityRuntimeState
  ): Promise<void> {
    const endTime = this.parseTime(detail.end_time);
    if (!endTime) return;

    const reminderMinutes = override?.reminderMinutesBeforeEnd ?? 10;
    const msLeft = endTime.getTime() - Date.now();
    if (msLeft <= 0 || msLeft > reminderMinutes * 60_000) return;

    const reminderTag = endTime.toISOString().slice(0, 16);
    if (state.lastReminderAt === reminderTag) return;

    state.lastReminderAt = reminderTag;
    this.saveProfile();
    await this.notify(`提醒: #${activityId} ${title} 将在 ${reminderMinutes} 分钟内结束，当前仍未签到。`);
  }

  private async trySignActivity(
    activityId: number,
    title: string,
    detail: ActivityDetailLike,
    preset: SubmitApplyPreset,
    state: ActivityRuntimeState,
    forceNotify: boolean
  ): Promise<void> {
    const payload = buildSubmitApplyPayload(activityId, {
      ...preset,
      content: buildSubmitContent(detail.form, preset),
      signImgUrl: preset.signImgUrl ?? this.defaultImageUrl,
      name: preset.name ?? this.defaultName,
    });

    try {
      const res = await this.jielong.submitApply(payload);
      state.lastSignAt = new Date().toISOString();
      state.lastSignResult = "success";
      state.lastError = undefined;
      this.saveProfile();

      if (forceNotify || res.code === 1) {
        await this.notify(`签到成功: #${activityId} ${title}`);
      }
    } catch (error) {
      const message = this.stringifyError(error);
      const shouldNotify = forceNotify || state.lastError !== message;
      state.lastSignAt = new Date().toISOString();
      state.lastSignResult = "failed";
      state.lastError = message;
      this.saveProfile();

      if (shouldNotify) {
        await this.notify(`签到失败: #${activityId} ${title}\n${message}`);
      }
    }
  }

  private resolvePreset(activityId: number): SubmitApplyPreset {
    const override = this.findActivityOverride(activityId);
    const defaults = this.profile.defaults ?? {};

    return {
      name: override?.name ?? defaults.name ?? this.defaultName,
      signImgUrl: override?.signImgUrl ?? defaults.signImgUrl ?? this.defaultImageUrl,
      content: override?.content ?? defaults.content,
      formValues:
        normalizeFormValueSource(override?.formValues) ??
        normalizeFormValueSource(defaults.formValues) ??
        this.defaultFormValues,
    };
  }

  private findActivityOverride(activityId: number): WatchedActivity | undefined {
    return (this.profile.activities ?? []).find((item) => item.activityId === activityId);
  }

  private getActivityState(activityId: number, title?: string): ActivityRuntimeState {
    this.profile.state ??= [];
    let state = this.profile.state.find((item) => item.activityId === activityId);
    if (!state) {
      state = { activityId, title };
      this.profile.state.push(state);
    } else if (title) {
      state.title = title;
    }
    return state;
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message?.text) return;

    if (!this.runtimeChatId) {
      this.runtimeChatId = message.chat.id;
    }
    if (String(message.chat.id) !== String(this.runtimeChatId)) {
      return;
    }

    const text = message.text.trim();
    const [command, ...rest] = text.split(/\s+/);
    const args = rest;

    switch (command) {
      case "/start":
      case "/help":
        await this.replyHelp();
        break;
      case "/status":
        await this.notify(this.renderStatus());
        break;
      case "/list":
        await this.notify(await this.renderActivityList());
        break;
      case "/watch":
        await this.handleWatchCommand(args);
        break;
      case "/unwatch":
        await this.handleUnwatchCommand(args);
        break;
      case "/watchlist":
        await this.notify(this.renderWatchList());
        break;
      case "/signin":
        await this.handleSignInCommand(args);
        break;
      default:
        await this.notify("未知命令。发送 /help 查看可用命令。");
        break;
    }
  }

  private async replyHelp(): Promise<void> {
    await this.notify(
      [
        "校园接龙王自动签到 Bot",
        "/status 查看 token 和自动签到状态",
        "/list 查看当前活动列表",
        "/watch <activityId> [name] 为某个活动添加专属姓名/覆盖配置",
        "/unwatch <activityId> 取消某个活动的专属覆盖配置",
        "/watchlist 查看当前专属覆盖配置",
        "/signin <activityId> 立即签到一次",
        "默认会自动扫描所有活动并尝试签到，不需要先 watch。",
      ].join("\n")
    );
  }

  private async handleWatchCommand(args: string[]): Promise<void> {
    const activityId = Number(args[0]);
    if (!Number.isFinite(activityId) || activityId <= 0) {
      await this.notify("用法: /watch <activityId> [name]");
      return;
    }

    this.profile.activities ??= [];
    const name = args.slice(1).join(" ").trim();
    const existing = this.findActivityOverride(activityId);
    if (existing) {
      if (name) existing.name = name;
      existing.autoSign = true;
      existing.signImgUrl = existing.signImgUrl ?? this.defaultImageUrl;
    } else {
      this.profile.activities.push({
        activityId,
        name: name || undefined,
        autoSign: true,
        signImgUrl: this.defaultImageUrl,
      });
    }

    this.saveProfile();
    await this.notify(`已为 #${activityId} 保存专属覆盖配置${name ? `，name=${name}` : ""}`);
  }

  private async handleUnwatchCommand(args: string[]): Promise<void> {
    const activityId = Number(args[0]);
    if (!Number.isFinite(activityId) || activityId <= 0) {
      await this.notify("用法: /unwatch <activityId>");
      return;
    }

    this.profile.activities = (this.profile.activities ?? []).filter((item) => item.activityId !== activityId);
    this.saveProfile();
    await this.notify(`已移除 #${activityId} 的专属覆盖配置`);
  }

  private async handleSignInCommand(args: string[]): Promise<void> {
    const activityId = Number(args[0]);
    if (!Number.isFinite(activityId) || activityId <= 0) {
      await this.notify("用法: /signin <activityId>");
      return;
    }

    const res = await this.jielong.getDetails({ id: activityId });
    const detail = (res.data ?? {}) as ActivityDetailLike;
    const title = detail.title ?? `活动 ${activityId}`;
    const state = this.getActivityState(activityId, title);
    const preset = this.resolvePreset(activityId);
    await this.trySignActivity(activityId, title, detail, preset, state, true);
  }

  private async renderActivityList(): Promise<string> {
    const list = await this.fetchAllActivities();
    if (!list.length) return "当前没有可见活动。";

    return [
      "当前活动:",
      ...list.slice(0, 20).map((item) => `#${item.id} [status=${item.status}] ${item.title}`),
    ].join("\n");
  }

  private renderStatus(): string {
    const token = this.tokenStore.getToken();
    return [
      `Token: ${token ? "已配置" : "未配置"}`,
      `过期时间: ${this.describeTokenExpiry(token)}`,
      `专属覆盖数量: ${(this.profile.activities ?? []).length}`,
      `默认姓名: ${(this.profile.defaults?.name ?? this.defaultName) || "(空)"}`,
      `默认图片: ${(this.profile.defaults?.signImgUrl ?? this.defaultImageUrl) || "(空)"}`,
      this.renderWatchList(),
    ].join("\n");
  }

  private renderWatchList(): string {
    const activities = this.profile.activities ?? [];
    if (!activities.length) return "当前没有专属活动覆盖配置，Bot 会自动扫描所有活动。";

    return [
      "专属活动覆盖配置:",
      ...activities.map((item) => {
        const suffix = item.name ? `, name=${item.name}` : "";
        return `#${item.activityId}${suffix}`;
      }),
    ].join("\n");
  }

  private parseTime(value: unknown): Date | null {
    if (!value) return null;
    if (typeof value === "number") {
      const ms = value > 1e12 ? value : value * 1000;
      return new Date(ms);
    }
    if (typeof value === "string") {
      const date = new Date(value.replace(/-/g, "/"));
      if (!Number.isNaN(date.getTime())) return date;
    }
    return null;
  }

  private describeTokenExpiry(token: string | null): string {
    const normalized = normalizeBearerToken(token);
    if (!normalized) return "未设置";
    const parsed = parseToken(normalized);
    if (!parsed?.tokenExpired) return "未知";
    return new Date(parsed.tokenExpired).toLocaleString("zh-CN", { hour12: false });
  }

  private async notify(text: string): Promise<void> {
    if (!this.runtimeChatId) return;
    await this.telegram.sendMessage(this.runtimeChatId, text);
  }

  private loadProfile(): BotProfile {
    if (!existsSync(this.watchFilePath)) {
      return {
        defaults: {
          name: this.defaultName,
          signImgUrl: this.defaultImageUrl,
          formValues: this.defaultFormValues,
        },
        activities: [],
        state: [],
      };
    }

    try {
      const raw = readFileSync(this.watchFilePath, "utf8");
      const parsed = JSON.parse(raw) as WatchFilePayload;
      const activities = Array.isArray(parsed.activities)
        ? parsed.activities
        : Array.isArray(parsed.watched)
          ? parsed.watched
          : [];
      const state = Array.isArray(parsed.state) ? parsed.state : [];
      return {
        defaults: {
          name: parsed.defaults?.name ?? this.defaultName,
          signImgUrl: parsed.defaults?.signImgUrl ?? this.defaultImageUrl,
          formValues:
            normalizeFormValueSource(parsed.defaults?.formValues) ??
            normalizeFormValueSource(parsed.defaults?.content) ??
            this.defaultFormValues,
        },
        activities,
        state,
      };
    } catch {
      return {
        defaults: {
          name: this.defaultName,
          signImgUrl: this.defaultImageUrl,
          formValues: this.defaultFormValues,
        },
        activities: [],
        state: [],
      };
    }
  }

  private saveProfile(): void {
    mkdirSync(dirname(this.watchFilePath), { recursive: true });
    writeFileSync(
      this.watchFilePath,
      JSON.stringify(
        {
          defaults: {
            name: this.profile.defaults?.name ?? this.defaultName,
            signImgUrl: this.profile.defaults?.signImgUrl ?? this.defaultImageUrl,
            formValues:
              normalizeFormValueSource(this.profile.defaults?.formValues) ??
              normalizeFormValueSource(this.profile.defaults?.content) ??
              this.defaultFormValues,
          },
          activities: this.profile.activities ?? [],
          state: this.profile.state ?? [],
          updatedAt: new Date().toISOString(),
        } satisfies WatchFilePayload,
        null,
        2
      ),
      "utf8"
    );
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}

function normalizeFormValueSource(
  value: SubmitApplyPreset["formValues"] | SubmitApplyPreset["content"]
): FormValueMap | null {
  if (!value) return null;
  if (Array.isArray(value)) return null;
  if (typeof value === "string") return null;
  return value;
}
