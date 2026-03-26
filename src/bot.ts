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

interface TelegramCallbackQuery {
  id: string;
  data?: string;
  message?: TelegramMessage;
}

interface TelegramInlineKeyboardButton {
  text: string;
  callback_data: string;
}

interface TelegramReplyMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
}

const EMPTY_REPLY_MARKUP: TelegramReplyMarkup = { inline_keyboard: [] };
const CALLBACK_PREFIX = "jl";

type DecisionAction = "sign" | "auto" | "ignore" | "block";

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
      allowed_updates: ["message", "callback_query"],
    };
    if (offset) payload.offset = offset;
    const res = await this.request<TelegramUpdate[]>("getUpdates", payload);
    return res.result;
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    replyMarkup?: TelegramReplyMarkup
  ): Promise<TelegramMessage> {
    const res = await this.request<TelegramMessage>("sendMessage", {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    });
    return res.result;
  }

  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    replyMarkup: TelegramReplyMarkup = EMPTY_REPLY_MARKUP
  ): Promise<void> {
    await this.request("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.request("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text,
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
  sourceUserId?: number;
  sourceName?: string;
  decisionStatus?: "pending" | "signed" | "ignored" | "permanent_ignored" | "already_signed";
  promptMessageId?: number;
  discoveredAt?: string;
}

export interface AutoSignUserRule {
  userId: number;
  name?: string;
  addedAt?: string;
}

export interface PollingState {
  nextActivityId: number;
}

export interface BotProfile {
  defaults?: SubmitApplyPreset;
  activities?: WatchedActivity[];
  state?: ActivityRuntimeState[];
  autoSignUsers?: AutoSignUserRule[];
  ignoredUserIds?: number[];
  polling?: PollingState;
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
  user_id?: number | string;
  my_apply?: unknown;
  mySubmit?: unknown;
  form?: ActivityFormItem[] | string;
  member?: unknown;
}

interface ActivityMemberLike {
  user_id?: number | string;
  userid?: number | string;
  uid?: number | string;
  id?: number | string;
  name?: string;
  nickname?: string;
  realname?: string;
}

interface ActivitySignSource {
  userId: number | null;
  name: string | null;
}

interface ParsedDecisionCallback {
  action: DecisionAction;
  activityId: number;
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

export function deriveNextActivityId(
  profile: Pick<BotProfile, "activities" | "state" | "polling">
): number {
  const nextFromProfile = Number(profile.polling?.nextActivityId ?? 0);
  if (Number.isFinite(nextFromProfile) && nextFromProfile > 0) {
    return Math.floor(nextFromProfile);
  }

  const maxActivityId = Math.max(
    0,
    ...(profile.activities ?? []).map((item) => Number(item.activityId ?? 0)),
    ...(profile.state ?? []).map((item) => Number(item.activityId ?? 0))
  );
  return maxActivityId > 0 ? maxActivityId + 1 : 1;
}

export function extractActivitySignSource(detail: ActivityDetailLike): ActivitySignSource {
  const ownerUserId = normalizeUserId(detail.user_id);
  const members = normalizeActivityMembers(detail.member);

  const matchedMember =
    members.find((item) => normalizeUserId(item.user_id ?? item.userid ?? item.uid ?? item.id) === ownerUserId) ??
    members.find((item) => {
      const name = normalizeMemberName(item);
      const userId = normalizeUserId(item.user_id ?? item.userid ?? item.uid ?? item.id);
      return Boolean(name && userId);
    }) ??
    null;

  return {
    userId:
      normalizeUserId(matchedMember?.user_id ?? matchedMember?.userid ?? matchedMember?.uid ?? matchedMember?.id) ??
      ownerUserId,
    name: matchedMember ? normalizeMemberName(matchedMember) : null,
  };
}

export function buildDecisionCallbackData(action: DecisionAction, activityId: number): string {
  return `${CALLBACK_PREFIX}:${action}:${activityId}`;
}

export function parseDecisionCallbackData(data: string | undefined): ParsedDecisionCallback | null {
  if (!data) return null;
  const [prefix, action, rawActivityId] = data.split(":");
  if (prefix !== CALLBACK_PREFIX) return null;
  if (!isDecisionAction(action)) return null;

  const activityId = Number(rawActivityId);
  if (!Number.isFinite(activityId) || activityId <= 0) return null;

  return { action, activityId };
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
        await this.pollNewActivities();
      } catch (error) {
        // await this.notify(`活动轮询异常: ${this.stringifyError(error)}`);
      }
      await sleep(this.pollIntervalMs);
    }
  }

  private async pollNewActivities(batchSize = 20): Promise<void> {
    for (let index = 0; index < batchSize; index += 1) {
      const activityId = deriveNextActivityId(this.profile);
      const detail = await this.fetchActivityDetailsById(activityId);
      if (!detail) break;

      await this.handleDiscoveredActivity(activityId, detail);
      this.profile.polling = { nextActivityId: activityId + 1 };
      this.saveProfile();
    }
  }

  private async fetchActivityDetailsById(activityId: number): Promise<ActivityDetailLike | null> {
    const res = await this.jielong.getDetails({ id: activityId });
    if (res.code !== 1 || !res.data || typeof res.data !== "object") {
      return null;
    }

    const detail = res.data as ActivityDetailLike;
    const normalizedId = Number(detail.id ?? activityId);
    if (!Number.isFinite(normalizedId) || normalizedId <= 0) {
      return null;
    }

    return {
      ...detail,
      id: normalizedId,
    };
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

  private async handleDiscoveredActivity(activityId: number, detail: ActivityDetailLike): Promise<void> {
    const title = detail.title ?? `活动 ${activityId}`;
    const state = this.getActivityState(activityId, title);
    const source = extractActivitySignSource(detail);

    state.discoveredAt ??= new Date().toISOString();
    state.sourceUserId = source.userId ?? undefined;
    state.sourceName = source.name ?? undefined;

    if (detail.my_apply || detail.mySubmit) {
      state.decisionStatus = "already_signed";
      this.clearPromptState(state);
      return;
    }

    if (Number(detail.status ?? 0) !== 1) {
      return;
    }

    if (source.userId && this.isIgnoredUser(source.userId)) {
      state.decisionStatus = "permanent_ignored";
      this.clearPromptState(state);
      return;
    }

    const autoRule = source.userId ? this.findAutoSignUser(source.userId) : undefined;
    if (autoRule && source.name) {
      const preset = this.resolvePreset(activityId, source.name);
      const success = await this.trySignActivity(activityId, title, detail, preset, state, false);
      if (success) {
        state.decisionStatus = "signed";
        this.clearPromptState(state);
      }
      return;
    }

    if (state.decisionStatus === "pending" && state.promptMessageId) {
      return;
    }

    await this.promptForDecision(activityId, title, source, state);
  }

  private async trySignActivity(
    activityId: number,
    title: string,
    detail: ActivityDetailLike,
    preset: SubmitApplyPreset,
    state: ActivityRuntimeState,
    forceNotify: boolean
  ): Promise<boolean> {
    const payload = buildSubmitApplyPayload(activityId, {
      ...preset,
      content: buildSubmitContent(detail.form, preset),
      signImgUrl: preset.signImgUrl ?? this.defaultImageUrl,
      name: preset.name ?? this.defaultName,
    });

    try {
      const res = await this.jielong.submitApply(payload);
      if (res.code !== 1) {
        throw new Error(res.msg || `submitApply failed with code ${res.code}`);
      }

      state.lastSignAt = new Date().toISOString();
      state.lastSignResult = "success";
      state.lastError = undefined;
      this.saveProfile();

      if (forceNotify || res.code === 1) {
        await this.notify(`签到成功: #${activityId} ${title}`);
      }
      return true;
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
      return false;
    }
  }

  private resolvePreset(activityId: number, nameOverride?: string): SubmitApplyPreset {
    const override = this.findActivityOverride(activityId);
    const defaults = this.profile.defaults ?? {};

    return {
      name: override?.name ?? nameOverride ?? defaults.name ?? this.defaultName,
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

  private clearPromptState(state: ActivityRuntimeState): void {
    state.promptMessageId = undefined;
  }

  private findAutoSignUser(userId: number): AutoSignUserRule | undefined {
    return (this.profile.autoSignUsers ?? []).find((item) => item.userId === userId);
  }

  private upsertAutoSignUser(userId: number, name?: string | null): void {
    this.profile.autoSignUsers ??= [];
    const existing = this.findAutoSignUser(userId);
    if (existing) {
      existing.name = name ?? existing.name;
      existing.addedAt = existing.addedAt ?? new Date().toISOString();
      return;
    }

    this.profile.autoSignUsers.push({
      userId,
      name: name ?? undefined,
      addedAt: new Date().toISOString(),
    });
  }

  private removeAutoSignUser(userId: number): void {
    this.profile.autoSignUsers = (this.profile.autoSignUsers ?? []).filter((item) => item.userId !== userId);
  }

  private isIgnoredUser(userId: number): boolean {
    return (this.profile.ignoredUserIds ?? []).includes(userId);
  }

  private addIgnoredUser(userId: number): void {
    this.profile.ignoredUserIds ??= [];
    if (!this.profile.ignoredUserIds.includes(userId)) {
      this.profile.ignoredUserIds.push(userId);
    }
  }

  private removeIgnoredUser(userId: number): void {
    this.profile.ignoredUserIds = (this.profile.ignoredUserIds ?? []).filter((item) => item !== userId);
  }

  private async promptForDecision(
    activityId: number,
    title: string,
    source: ActivitySignSource,
    state: ActivityRuntimeState
  ): Promise<void> {
    const prompt = this.renderDecisionPrompt(activityId, title, source);
    const keyboard = this.buildDecisionKeyboard(activityId, Boolean(source.userId));
    const message = await this.notify(prompt, keyboard);

    state.decisionStatus = "pending";
    state.promptMessageId = message?.message_id;
    this.saveProfile();
  }

  private renderDecisionPrompt(activityId: number, title: string, source: ActivitySignSource): string {
    return [
      `发现新签到: #${activityId} ${title}`,
      `发起 user_id: ${source.userId ?? "(未解析)"}`,
      `member.name: ${source.name ?? "(空)"}`,
      "规则: 只有当 member.name 存在且 user_id 在自动签到表中时才会自动签到。",
      "请选择: 签到 / 加入自动签到表 / 忽略 / 永久忽略此userid",
    ].join("\n");
  }

  private buildDecisionKeyboard(activityId: number, hasUserId: boolean): TelegramReplyMarkup {
    const firstRow: TelegramInlineKeyboardButton[] = [
      { text: "签到", callback_data: buildDecisionCallbackData("sign", activityId) },
    ];
    const secondRow: TelegramInlineKeyboardButton[] = [
      { text: "忽略", callback_data: buildDecisionCallbackData("ignore", activityId) },
    ];

    if (hasUserId) {
      firstRow.push({
        text: "加入自动签到表",
        callback_data: buildDecisionCallbackData("auto", activityId),
      });
      secondRow.push({
        text: "永久忽略此userid",
        callback_data: buildDecisionCallbackData("block", activityId),
      });
    }

    return {
      inline_keyboard: [firstRow, secondRow],
    };
  }

  private async finalizeDecisionPrompt(
    chatId: string | number,
    messageId: number | undefined,
    text: string
  ): Promise<void> {
    if (!messageId) return;
    try {
      await this.telegram.editMessageText(chatId, messageId, text, EMPTY_REPLY_MARKUP);
    } catch {
      // ignore message edit errors; buttons are only a convenience layer
    }
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

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

  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const message = query.message;
    if (!message) return;

    if (!this.runtimeChatId) {
      this.runtimeChatId = message.chat.id;
    }
    if (String(message.chat.id) !== String(this.runtimeChatId)) {
      return;
    }

    const parsed = parseDecisionCallbackData(query.data);
    if (!parsed) {
      await this.telegram.answerCallbackQuery(query.id, "未知操作");
      return;
    }

    const state = this.getActivityState(parsed.activityId);
    const title = state.title ?? `活动 ${parsed.activityId}`;
    const source: ActivitySignSource = {
      userId: state.sourceUserId ?? null,
      name: state.sourceName ?? null,
    };

    if (parsed.action === "ignore") {
      state.decisionStatus = "ignored";
      this.clearPromptState(state);
      this.saveProfile();
      await this.finalizeDecisionPrompt(message.chat.id, message.message_id, `已忽略: #${parsed.activityId} ${title}`);
      await this.telegram.answerCallbackQuery(query.id, "已忽略");
      return;
    }

    if (parsed.action === "block") {
      if (!source.userId) {
        await this.telegram.answerCallbackQuery(query.id, "未解析到 user_id");
        return;
      }

      this.removeAutoSignUser(source.userId);
      this.addIgnoredUser(source.userId);
      state.decisionStatus = "permanent_ignored";
      this.clearPromptState(state);
      this.saveProfile();
      await this.finalizeDecisionPrompt(
        message.chat.id,
        message.message_id,
        `已永久忽略 user_id=${source.userId}: #${parsed.activityId} ${title}`
      );
      await this.telegram.answerCallbackQuery(query.id, "已永久忽略");
      return;
    }

    const detail = await this.fetchActivityDetailsById(parsed.activityId);
    if (!detail) {
      await this.telegram.answerCallbackQuery(query.id, "活动详情不存在");
      return;
    }

    if (detail.my_apply || detail.mySubmit) {
      state.decisionStatus = "already_signed";
      this.clearPromptState(state);
      this.saveProfile();
      await this.finalizeDecisionPrompt(message.chat.id, message.message_id, `已存在签到记录: #${parsed.activityId} ${title}`);
      await this.telegram.answerCallbackQuery(query.id, "已签到");
      return;
    }

    const latestSource = extractActivitySignSource(detail);
    state.sourceUserId = latestSource.userId ?? state.sourceUserId;
    state.sourceName = latestSource.name ?? state.sourceName;

    if (parsed.action === "auto") {
      const latestUserId = latestSource.userId ?? state.sourceUserId ?? null;
      if (!latestUserId) {
        await this.telegram.answerCallbackQuery(query.id, "未解析到 user_id");
        return;
      }

      this.removeIgnoredUser(latestUserId);
      this.upsertAutoSignUser(latestUserId, latestSource.name ?? state.sourceName ?? null);
      this.saveProfile();

      const autoSuccess = await this.trySignActivity(
        parsed.activityId,
        detail.title ?? title,
        detail,
        this.resolvePreset(parsed.activityId, latestSource.name ?? state.sourceName),
        state,
        true
      );
      if (autoSuccess) {
        state.decisionStatus = "signed";
        this.clearPromptState(state);
        this.saveProfile();
        await this.finalizeDecisionPrompt(
          message.chat.id,
          message.message_id,
          `已加入自动签到表并签到成功: #${parsed.activityId} ${detail.title ?? title}`
        );
        await this.telegram.answerCallbackQuery(query.id, "已加入自动签到表");
      } else {
        state.decisionStatus = "pending";
        this.saveProfile();
        await this.telegram.answerCallbackQuery(query.id, "已加入自动签到表，本次签到失败");
      }
      return;
    }

    const success = await this.trySignActivity(
      parsed.activityId,
      detail.title ?? title,
      detail,
      this.resolvePreset(parsed.activityId, latestSource.name ?? state.sourceName),
      state,
      true
    );
    if (success) {
      state.decisionStatus = "signed";
      this.clearPromptState(state);
      this.saveProfile();
      await this.finalizeDecisionPrompt(
        message.chat.id,
        message.message_id,
        `已手动签到成功: #${parsed.activityId} ${detail.title ?? title}`
      );
      await this.telegram.answerCallbackQuery(query.id, "签到成功");
      return;
    }

    state.decisionStatus = "pending";
    this.saveProfile();
    await this.telegram.answerCallbackQuery(query.id, "签到失败");
  }

  private async replyHelp(): Promise<void> {
    await this.notify(
      [
        "校园接龙王自动签到 Bot",
        "/status 查看 token、轮询进度和自动签到状态",
        "/list 查看当前活动列表",
        "/watch <activityId> [name] 为某个活动设置专属覆盖配置",
        "/unwatch <activityId> 取消某个活动的专属覆盖配置",
        "/watchlist 查看当前专属覆盖配置",
        "/signin <activityId> 立即签到一次",
        "Bot 会按活动 id 递增轮询 getDetails，新活动会用按钮询问是否签到/加入自动签到表/忽略。",
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

    const detail = await this.fetchActivityDetailsById(activityId);
    if (!detail) {
      await this.notify(`未找到活动 #${activityId}`);
      return;
    }

    const title = detail.title ?? `活动 ${activityId}`;
    const state = this.getActivityState(activityId, title);
    const source = extractActivitySignSource(detail);
    state.sourceUserId = source.userId ?? undefined;
    state.sourceName = source.name ?? undefined;

    await this.trySignActivity(
      activityId,
      title,
      detail,
      this.resolvePreset(activityId, source.name ?? undefined),
      state,
      true
    );
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
      `下一个轮询 id: ${deriveNextActivityId(this.profile)}`,
      `自动签到 user_id 数量: ${(this.profile.autoSignUsers ?? []).length}`,
      `永久忽略 user_id 数量: ${(this.profile.ignoredUserIds ?? []).length}`,
      `专属覆盖数量: ${(this.profile.activities ?? []).length}`,
      `默认姓名: ${(this.profile.defaults?.name ?? this.defaultName) || "(空)"}`,
      `默认图片: ${(this.profile.defaults?.signImgUrl ?? this.defaultImageUrl) || "(空)"}`,
      this.renderWatchList(),
    ].join("\n");
  }

  private renderWatchList(): string {
    const activities = this.profile.activities ?? [];
    if (!activities.length) return "当前没有专属活动覆盖配置，Bot 会自动发现新活动并按按钮决策。";

    return [
      "专属活动覆盖配置:",
      ...activities.map((item) => {
        const suffix = item.name ? `, name=${item.name}` : "";
        return `#${item.activityId}${suffix}`;
      }),
    ].join("\n");
  }

  private describeTokenExpiry(token: string | null): string {
    const normalized = normalizeBearerToken(token);
    if (!normalized) return "未设置";
    const parsed = parseToken(normalized);
    if (!parsed?.tokenExpired) return "未知";
    return new Date(parsed.tokenExpired).toLocaleString("zh-CN", { hour12: false });
  }

  private async notify(text: string, replyMarkup?: TelegramReplyMarkup): Promise<TelegramMessage | null> {
    if (!this.runtimeChatId) return null;
    return this.telegram.sendMessage(this.runtimeChatId, text, replyMarkup);
  }

  private loadProfile(): BotProfile {
    if (!existsSync(this.watchFilePath)) {
      return this.buildDefaultProfile();
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
      const profile: BotProfile = {
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
        autoSignUsers: normalizeAutoSignUsers(parsed.autoSignUsers),
        ignoredUserIds: normalizeUserIdList(parsed.ignoredUserIds),
      };
      profile.polling = {
        nextActivityId: deriveNextActivityId({
          activities: profile.activities,
          state: profile.state,
          polling: parsed.polling,
        }),
      };
      return profile;
    } catch {
      return this.buildDefaultProfile();
    }
  }

  private buildDefaultProfile(): BotProfile {
    return {
      defaults: {
        name: this.defaultName,
        signImgUrl: this.defaultImageUrl,
        formValues: this.defaultFormValues,
      },
      activities: [],
      state: [],
      autoSignUsers: [],
      ignoredUserIds: [],
      polling: {
        nextActivityId: 1,
      },
    };
  }

  private saveProfile(): void {
    this.profile.polling = {
      nextActivityId: deriveNextActivityId(this.profile),
    };

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
          autoSignUsers: normalizeAutoSignUsers(this.profile.autoSignUsers),
          ignoredUserIds: normalizeUserIdList(this.profile.ignoredUserIds),
          polling: this.profile.polling,
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

function normalizeUserId(value: unknown): number | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.floor(numeric);
}

function normalizeMemberName(member: ActivityMemberLike | null | undefined): string | null {
  if (!member) return null;
  const raw = [member.name, member.realname, member.nickname].find(
    (item) => typeof item === "string" && item.trim()
  );
  return typeof raw === "string" ? raw.trim() : null;
}

function normalizeActivityMembers(member: unknown): ActivityMemberLike[] {
  if (Array.isArray(member)) {
    return member.filter((item): item is ActivityMemberLike => Boolean(item && typeof item === "object"));
  }

  if (typeof member === "string") {
    try {
      const parsed = JSON.parse(member) as unknown;
      return normalizeActivityMembers(parsed);
    } catch {
      return [];
    }
  }

  if (!member || typeof member !== "object") {
    return [];
  }

  const record = member as Record<string, unknown>;
  if (Array.isArray(record.member)) return normalizeActivityMembers(record.member);
  if (Array.isArray(record.members)) return normalizeActivityMembers(record.members);
  if (Array.isArray(record.list)) return normalizeActivityMembers(record.list);
  return [];
}

function normalizeAutoSignUsers(value: BotProfile["autoSignUsers"]): AutoSignUserRule[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const userId = normalizeUserId(item?.userId);
      if (!userId) return null;
      const normalized: AutoSignUserRule = {
        userId,
        name: typeof item?.name === "string" && item.name.trim() ? item.name.trim() : undefined,
        addedAt: typeof item?.addedAt === "string" ? item.addedAt : undefined,
      };
      return normalized;
    })
    .filter((item): item is AutoSignUserRule => Boolean(item));
}

function normalizeUserIdList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  const dedup = new Set<number>();
  for (const item of value) {
    const userId = normalizeUserId(item);
    if (userId) dedup.add(userId);
  }
  return [...dedup.values()];
}

function isDecisionAction(value: string): value is DecisionAction {
  return value === "sign" || value === "auto" || value === "ignore" || value === "block";
}
