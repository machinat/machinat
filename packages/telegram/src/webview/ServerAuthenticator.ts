import { parse as parseUrl, URL } from 'url';
import type { ParsedUrlQuery } from 'querystring';
import { createHmac, createHash } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { serviceProviderClass } from '@sociably/core/service';
import type { RoutingInfo } from '@sociably/http';
import Auth, {
  ServerAuthenticator,
  VerifyResult,
  CheckDataResult,
} from '@sociably/auth';
import BasicAuthenticator from '@sociably/auth/basicAuth';
import { attachWebviewParamsOnUrl } from '@sociably/webview/client';
import { TELEGRAM } from '../constant.js';
import BotP from '../Bot.js';
import TelegramUser from '../User.js';
import { AgentSettingsAccessorI } from '../interface.js';
import type TelegramApiError from '../Error.js';
import type { RawChat, RawUser } from '../types.js';
import { getAuthContextDetails } from './utils.js';
import renderLoginPage from './renderLoginPage.js';
import {
  REDIRECT_QUERY,
  CHAT_ID_QUERY,
  LOGIN_PARAMETERS,
  BOT_ID_QUERY,
} from './constant.js';
import type { TelegramAuthContext, TelegramAuthData } from './types.js';

const verifyTelegramAuthQuery = (botToken: string, query: ParsedUrlQuery) => {
  const { hash } = query;
  if (typeof hash !== 'string') {
    return { ok: false as const, code: 400, reason: 'invalid auth params' };
  }

  let checkingStr = '';
  for (const paramKey of LOGIN_PARAMETERS) {
    if (query[paramKey]) {
      if (checkingStr.length !== 0) {
        checkingStr += '\n';
      }
      checkingStr += `${paramKey}=${query[paramKey]}`;
    }
  }

  const secretKey = createHash('sha256').update(botToken).digest();
  const paramsHash = createHmac('sha256', secretKey)
    .update(checkingStr)
    .digest('hex');

  if (paramsHash !== hash) {
    return { ok: false as const, code: 401, reason: 'invalid auth signature' };
  }

  if (Number(query.auth_date as string) < Date.now() / 1000 - 20) {
    return { ok: false as const, code: 401, reason: 'login expired' };
  }

  return {
    ok: true as const,
    userData: {
      id: Number(query.id),
      username: query.username,
      first_name: query.first_name,
      last_name: query.last_name,
      language_code: undefined,
    } as RawUser,
  };
};

type ServerAuthenticatorOptions = {
  appName?: string;
  appIconUrl?: string;
};

/** @category Provider */
export class TelegramServerAuthenticator
  implements ServerAuthenticator<never, TelegramAuthData, TelegramAuthContext>
{
  bot: BotP;
  settingsAccessor: AgentSettingsAccessorI;
  operator: Auth.HttpOperator;
  appName: undefined | string;
  appIconUrl: undefined | string;

  platform = TELEGRAM;

  constructor(
    bot: BotP,
    settingsAccessor: AgentSettingsAccessorI,
    operator: Auth.HttpOperator,
    { appName, appIconUrl }: ServerAuthenticatorOptions = {},
  ) {
    this.bot = bot;
    this.settingsAccessor = settingsAccessor;
    this.operator = operator;
    this.appName = appName;
    this.appIconUrl = appIconUrl;
  }

  getAuthUrl(
    botId: number,
    options?: {
      chatId?: number | string;
      redirectUrl?: string;
      webviewParams?: Record<string, string>;
    },
  ): string {
    const url = new URL(this.operator.getAuthUrl(TELEGRAM));
    url.searchParams.set(BOT_ID_QUERY, botId.toString());

    if (options?.chatId) {
      url.searchParams.set(CHAT_ID_QUERY, options.chatId.toString());
    }
    if (options?.redirectUrl) {
      url.searchParams.set(REDIRECT_QUERY, options.redirectUrl);
    }

    return options?.webviewParams
      ? attachWebviewParamsOnUrl(url.href, options.webviewParams)
      : url.href;
  }

  async delegateAuthRequest(
    req: IncomingMessage,
    res: ServerResponse,
    { trailingPath }: RoutingInfo,
  ): Promise<void> {
    const { query } = parseUrl(req.url || '', true);

    if (trailingPath === '') {
      await this._handleTelegramAuthCallback(res, query);
    } else if (trailingPath === 'login') {
      await this._handleLoginPage(res, query);
    } else {
      res.writeHead(404);
      res.end();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async verifyCredential(): Promise<VerifyResult<never>> {
    return {
      ok: false,
      code: 403,
      reason: 'should initiate st server side only',
    };
  }

  async verifyRefreshment(
    data: TelegramAuthData,
  ): Promise<VerifyResult<TelegramAuthData>> {
    const { chat, user, botId } = data;

    const [agentSettingsResult, chatMemberResult] = await Promise.all([
      this._verifyAgentSettings(botId),
      chat ? this._verifyChatMember(botId, chat.id, user.id) : null,
    ]);

    if (!agentSettingsResult.ok || (chatMemberResult && !chatMemberResult.ok)) {
      return [agentSettingsResult, chatMemberResult].find(
        (result) => result && !result.ok,
      ) as VerifyResult<TelegramAuthData>;
    }

    return { ok: true, data };
  }

  // eslint-disable-next-line class-methods-use-this
  checkAuthData(data: TelegramAuthData): CheckDataResult<TelegramAuthContext> {
    return {
      ok: true,
      contextDetails: getAuthContextDetails(data),
    };
  }

  private async _handleTelegramAuthCallback(
    res: ServerResponse,
    query: ParsedUrlQuery,
  ): Promise<void> {
    const targetsResult = await this._getLoginTargetsFormQuery(query);
    if (!targetsResult.ok) {
      const { code, reason, redirectUrl } = targetsResult;
      this._redirectError(res, code, reason, redirectUrl);
      return;
    }
    const { botId, agentSettings, chatId, redirectUrl } = targetsResult;

    const authQueryResult = verifyTelegramAuthQuery(
      agentSettings.botToken,
      query,
    );
    if (!authQueryResult.ok) {
      const { code, reason } = authQueryResult;
      await this._redirectError(res, code, reason, redirectUrl);
      return;
    }
    const { userData } = authQueryResult;

    let chatData: undefined | RawChat;
    if (chatId) {
      const chatMemberResult = await this._verifyChatMember(
        botId,
        chatId,
        userData.id,
      );

      if (!chatMemberResult.ok) {
        const { code, reason } = chatMemberResult;
        await this._redirectError(res, code, reason, redirectUrl);
        return;
      }

      const { chat, user } = chatMemberResult;
      userData.language_code = user.language_code;
      chatData = {
        type: chat.type,
        id: chat.id,
        title: chat.title,
        username: chat.username,
        description: chat.description,
      };
    }

    await this.operator.issueAuth<TelegramAuthData>(res, TELEGRAM, {
      botId,
      botName: agentSettings.botName,
      chat: chatData,
      user: userData,
      photo: query.photo_url as string | undefined,
    });
    this.operator.redirect(res, redirectUrl, { assertInternal: true });
  }

  private async _handleLoginPage(res: ServerResponse, query: ParsedUrlQuery) {
    const targetsResult = await this._getLoginTargetsFormQuery(query);
    if (!targetsResult.ok) {
      const { code, reason, redirectUrl } = targetsResult;
      this._redirectError(res, code, reason, redirectUrl);
      return;
    }
    const { botId, agentSettings, chatId, redirectUrl } = targetsResult;

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
      renderLoginPage({
        botName: agentSettings.botName,
        appName: this.appName,
        appIconUrl: this.appIconUrl,
        callbackUrl: this.getAuthUrl(botId, { chatId, redirectUrl }),
      }),
    );
  }

  private async _getLoginTargetsFormQuery(query: ParsedUrlQuery) {
    const botIdQuery = query[BOT_ID_QUERY];
    const botId =
      typeof botIdQuery === 'string' ? parseInt(botIdQuery, 10) : undefined;

    const redirectUrlQuery = query[REDIRECT_QUERY];
    const redirectUrl = Array.isArray(redirectUrlQuery)
      ? redirectUrlQuery[0]
      : redirectUrlQuery;

    const chatIdQuery = query[CHAT_ID_QUERY];
    const chatId =
      typeof chatIdQuery !== 'string'
        ? undefined
        : chatIdQuery.startsWith('@')
        ? chatIdQuery
        : parseInt(chatIdQuery, 10);

    if (!botId || (chatIdQuery && !chatId)) {
      return {
        ok: false as const,
        redirectUrl,
        code: 400,
        reason: !botId
          ? `invalid bot id "${botId}"`
          : `invalid chat id "${chatId}"`,
      };
    }

    const settingsResult = await this._verifyAgentSettings(botId);
    if (!settingsResult.ok) {
      return { ...settingsResult, redirectUrl };
    }

    return {
      ok: true as const,
      botId,
      redirectUrl,
      chatId,
      agentSettings: settingsResult.agentSettings,
    };
  }

  private async _verifyAgentSettings(botId: number) {
    const agentSettings = await this.settingsAccessor.getAgentSettings(
      new TelegramUser(botId, true),
    );
    if (!agentSettings) {
      return {
        ok: false as const,
        code: 404,
        reason: `bot "${botId}" not registered`,
      };
    }
    return { ok: true as const, agentSettings };
  }

  private async _verifyChatMember(
    botId: number,
    chatId: number | string,
    userId: number,
  ) {
    const agent = new TelegramUser(botId, true);
    try {
      const [chatMember, chatData] = await Promise.all([
        this.bot.requestApi({
          channel: agent,
          method: 'getChatMember',
          params: { chat_id: chatId, user_id: userId },
        }),
        this.bot.requestApi({
          channel: agent,
          method: 'getChat',
          params: { chat_id: chatId },
        }),
      ]);

      if (
        chatMember.status === 'left' ||
        chatMember.status === 'kicked' ||
        (chatMember.status === 'restricted' && chatMember.is_member === false)
      ) {
        return {
          ok: false as const,
          code: 401,
          reason: 'user is unauthorized to chat',
        };
      }

      return {
        ok: true as const,
        chat: chatData as RawChat,
        user: chatMember.user as RawUser,
      };
    } catch (err) {
      const { code, description }: TelegramApiError = err;
      return { ok: false as const, code, reason: description };
    }
  }

  private async _redirectError(
    res: ServerResponse,
    code: number,
    message: string,
    redirectUrl?: string,
  ) {
    await this.operator.issueError(res, TELEGRAM, code, message);
    this.operator.redirect(res, redirectUrl, { assertInternal: true });
  }
}

const ServerAuthenticatorP = serviceProviderClass({
  lifetime: 'singleton',
  deps: [
    BotP,
    AgentSettingsAccessorI,
    Auth.HttpOperator,
    { require: BasicAuthenticator, optional: true },
  ],
  factory: (bot, settingsAccessor, operator, basicAuthenticator) =>
    new TelegramServerAuthenticator(bot, settingsAccessor, operator, {
      appName: basicAuthenticator?.appName,
      appIconUrl: basicAuthenticator?.appIconUrl,
    }),
})(TelegramServerAuthenticator);

type ServerAuthenticatorP = TelegramServerAuthenticator;

export default ServerAuthenticatorP;
