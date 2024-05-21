import type { IncomingMessage, ServerResponse } from 'http';
import { join as joinPath } from 'path/posix';
import { serviceProviderClass } from '@sociably/core/service';
import { ServerAuthenticator, CheckDataResult } from '@sociably/auth';
import { attachWebviewParamsOnUrl } from '@sociably/webview/client';
import { AgentSettingsAccessorI } from '../interface.js';
import LineChannel from '../Channel.js';
import LineChat from '../Chat.js';
import BotP from '../Bot.js';
import { LINE } from '../constant.js';
import LineApiError from '../error.js';
import { LineRawUserProfile, LiffAppChoiceSetting } from '../types.js';
import {
  LiffOs,
  RefChatType,
  CHAT_CHANNEL_QUERY_KEY,
  LIFF_ID_QUERY_KEY,
  ROOM_ID_QUERY_KEY,
  GROUP_ID_QUERY_KEY,
} from './constant.js';
import { getAuthContextDetails } from './utils.js';
import {
  LineAuthCredential,
  LineAuthData,
  LineAuthContext,
  LineVerifyAuthResult,
} from './types.js';

type VerifyTokenResult = {
  /* eslint-disable camelcase */
  scope: string;
  client_id: string;
  expires_in: number;
  /* eslint-enable camelcase */
};

export type LiffUrlOptions = {
  path?: string;
  chat?: LineChat;
  liffAppChoice?: keyof LiffAppChoiceSetting;
  webviewParams?: Record<string, unknown>;
};

/** @category Provider */
export class LineServerAuthenticator
  implements
    ServerAuthenticator<LineAuthCredential, LineAuthData, LineAuthContext>
{
  bot: BotP;
  agentSettingsAccessor: AgentSettingsAccessorI;
  platform = LINE;

  constructor(bot: BotP, agentSettingsAccessor: AgentSettingsAccessorI) {
    this.bot = bot;
    this.agentSettingsAccessor = agentSettingsAccessor;
  }

  async getLiffUrl(
    channel: LineChannel,
    {
      path,
      chat,
      liffAppChoice = 'default',
      webviewParams,
    }: LiffUrlOptions = {},
  ): Promise<string> {
    const setting = await this.agentSettingsAccessor.getAgentSettings(channel);
    if (!setting?.liffApps) {
      throw new Error(
        `liff setting for messaging channel "${channel.id}" not found`,
      );
    }

    const liffId = setting.liffApps[liffAppChoice] || setting.liffApps.default;
    const liffUrl = new URL(
      joinPath(liffId, path || ''),
      'https://liff.line.me',
    );

    liffUrl.searchParams.set(CHAT_CHANNEL_QUERY_KEY, channel.id);
    liffUrl.searchParams.set(LIFF_ID_QUERY_KEY, liffId);

    if (chat?.type === 'group') {
      liffUrl.searchParams.set(GROUP_ID_QUERY_KEY, chat.id);
    } else if (chat?.type === 'room') {
      liffUrl.searchParams.set(ROOM_ID_QUERY_KEY, chat.id);
    }

    return webviewParams
      ? attachWebviewParamsOnUrl(liffUrl.href, webviewParams)
      : liffUrl.href;
  }

  // eslint-disable-next-line class-methods-use-this
  async delegateAuthRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    res.writeHead(403);
    res.end();
  }

  async verifyCredential(
    credential: LineAuthCredential,
  ): Promise<LineVerifyAuthResult> {
    const {
      accessToken,
      userId,
      contextType,
      os,
      language,
      chatChannelId,
      groupId,
      roomId,
    } = credential;
    if (!accessToken) {
      return { ok: false, code: 400, reason: 'access token is empty' };
    }

    const refererType =
      contextType === 'utou'
        ? RefChatType.Utou
        : contextType === 'group'
        ? RefChatType.Group
        : contextType === 'room'
        ? RefChatType.Room
        : contextType === 'external'
        ? RefChatType.External
        : RefChatType.None;

    const [channelResult, userResult, chatResult] = await Promise.all([
      this.verifyAccessToken(accessToken).then((result) =>
        result.ok
          ? this.verifyChannel(result.tokenInfo.client_id, chatChannelId)
          : result,
      ),
      this.verifyUser(accessToken, userId),
      chatChannelId
        ? this._verifyChat(
            groupId
              ? new LineChat(chatChannelId, 'group', groupId)
              : roomId
              ? new LineChat(chatChannelId, 'room', roomId)
              : new LineChat(chatChannelId, 'user', userId),
            userId,
            refererType,
          )
        : null,
    ]);

    if (!channelResult.ok || !userResult.ok || (chatResult && !chatResult.ok)) {
      return [channelResult, userResult, chatResult].find(
        (result) => !result?.ok,
      ) as LineVerifyAuthResult;
    }

    const {
      loginChannelSettings: {
        channelId: loginChannelId,
        providerId,
        linkedChatChannelId,
      },
    } = channelResult;
    const chat = chatResult?.chat;

    return {
      ok: true,
      data: {
        chan: chatChannelId || linkedChatChannelId,
        group: chat?.type === 'group' ? chat.id : undefined,
        room: chat?.type === 'room' ? chat.id : undefined,
        provider: providerId,
        client: loginChannelId,
        user: userId,
        ref: refererType,
        os:
          os === 'ios'
            ? LiffOs.Ios
            : os === 'android'
            ? LiffOs.Android
            : LiffOs.Web,
        lang: language,
      },
    };
  }

  async verifyRefreshment(data: LineAuthData): Promise<LineVerifyAuthResult> {
    const [channelResult, chatResult] = await Promise.all([
      this.verifyChannel(data.client, data.chan),
      data.chan
        ? this._verifyChat(
            data.group
              ? new LineChat(data.chan, 'group', data.group)
              : data.room
              ? new LineChat(data.chan, 'room', data.room)
              : new LineChat(data.chan, 'user', data.user),
            data.user,
            data.ref,
          )
        : null,
    ]);

    if (!channelResult.ok || (chatResult && !chatResult.ok)) {
      return [channelResult, chatResult].find(
        (result) => !result?.ok,
      ) as LineVerifyAuthResult;
    }
    if (channelResult.loginChannelSettings.providerId !== data.provider) {
      return { ok: false, code: 400, reason: 'provider not match' };
    }

    return { ok: true, data };
  }

  // eslint-disable-next-line class-methods-use-this
  checkAuthData(data: LineAuthData): CheckDataResult<LineAuthContext> {
    return { ok: true, contextDetails: getAuthContextDetails(data) };
  }

  private async _verifyChat(
    chat: LineChat,
    userId: string,
    refererType: RefChatType,
  ) {
    if (
      refererType === RefChatType.None ||
      (refererType !== RefChatType.External &&
        ((chat.type === 'user' && refererType !== RefChatType.Utou) ||
          (chat.type === 'group' && refererType !== RefChatType.Group) ||
          (chat.type === 'room' && refererType !== RefChatType.Room)))
    ) {
      return {
        ok: false as const,
        code: 400,
        reason: 'chat type not match',
      };
    }

    const chatChannelSettings =
      await this.agentSettingsAccessor.getAgentSettings(chat.channel);
    if (!chatChannelSettings) {
      return {
        ok: false as const,
        code: 404,
        reason: 'messaging channel settings not found',
      };
    }

    try {
      if (chat.type === 'user') {
        await this.bot.requestApi({
          channel: chat.channel,
          method: 'GET',
          url: `v2/bot/profile/${chat.id}`,
        });
      } else if (chat.type === 'group') {
        await this.bot.requestApi({
          channel: chat.channel,
          method: 'GET',
          url: `v2/bot/group/${chat.id}/member/${userId}`,
        });
      } else if (chat.type === 'room') {
        await this.bot.requestApi({
          channel: chat.channel,
          method: 'GET',
          url: `v2/bot/room/${chat.id}/member/${userId}`,
        });
      }
      return { ok: true as const, chat };
    } catch (err) {
      if (err instanceof LineApiError) {
        return {
          ok: false as const,
          code: err.code,
          reason: err.message,
        };
      }
      throw err;
    }
  }

  private async verifyUser(loginToken: string, userId: string) {
    try {
      const profile = await this.bot.requestApi<LineRawUserProfile>({
        accessToken: loginToken,
        method: 'GET',
        url: `v2/profile`,
      });

      if (profile.userId !== userId) {
        return {
          ok: false as const,
          code: 401,
          reason: 'user and access token not match',
        };
      }
      return {
        ok: true as const,
        profile,
      };
    } catch (err) {
      if (err instanceof LineApiError) {
        return {
          ok: false as const,
          code: err.code,
          reason: err.message,
        };
      }
      throw err;
    }
  }

  private async verifyAccessToken(accessToken: string) {
    try {
      const tokenInfo = await this.bot.requestApi<VerifyTokenResult>({
        method: 'GET',
        url: `oauth2/v2.1/verify?access_token=${accessToken}`,
      });

      return { ok: true as const, tokenInfo };
    } catch (err) {
      if (err instanceof LineApiError) {
        return {
          ok: false as const,
          code: err.code,
          reason: err.message,
        };
      }
      throw err;
    }
  }

  private async verifyChannel(
    loginChannelId: string,
    chatChannelId: undefined | string,
  ) {
    const loginChannelSettings =
      await this.agentSettingsAccessor.getLineLoginChannelSettings(
        loginChannelId,
      );
    if (!loginChannelSettings) {
      return {
        ok: false as const,
        code: 404,
        reason: `login channel "${loginChannelId}" not registered`,
      };
    }

    if (
      chatChannelId &&
      !loginChannelSettings.refChatChannelIds.includes(chatChannelId)
    ) {
      return {
        ok: false as const,
        code: 403,
        reason: `messaging channel "${chatChannelId}" not match`,
      };
    }
    return {
      ok: true as const,
      loginChannelSettings,
    };
  }
}

const ServerAuthenticatorP = serviceProviderClass({
  lifetime: 'transient',
  deps: [BotP, AgentSettingsAccessorI],
})(LineServerAuthenticator);

type ServerAuthenticatorP = LineServerAuthenticator;

export default ServerAuthenticatorP;
