import { parse as parseUrl } from 'url';
import type { ParsedUrlQuery } from 'querystring';
import { createHmac, createHash } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { makeClassProvider } from '@machinat/core/service';
import Auth, {
  ServerAuthenticator,
  VerifyResult,
  CheckDataResult,
} from '@machinat/auth';
import { TELEGRAM } from '../constant';
import BotP from '../Bot';
import type TelegramApiError from '../Error';
import type { RawChat, RawUser } from '../types';
import { getAuthContextDetails } from './utils';
import type { TelegramAuthContext, TelegramAuthData } from './types';

const CHAT_QUERY = 'telegramChat';
const REDIRECT_QUERY = 'redirectUrl';

const LOGIN_PARAMETERS = [
  'auth_date',
  'first_name',
  'id',
  'last_name',
  'photo_url',
  'username',
];

/**
 * @category Provider
 */
export class TelegramServerAuthenticator
  implements ServerAuthenticator<never, TelegramAuthData, TelegramAuthContext>
{
  bot: BotP;
  operator: Auth.HttpOperator;
  private _secretKey: Buffer;
  platform = TELEGRAM;

  constructor(bot: BotP, operator: Auth.HttpOperator) {
    this.bot = bot;
    this.operator = operator;
    this._secretKey = createHash('sha256').update(bot.token).digest();
  }

  async delegateAuthRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    const { query } = parseUrl(req.url as string, true);
    const { [REDIRECT_QUERY]: redirectQuery, [CHAT_QUERY]: chatQuery } = query;

    if (Array.isArray(redirectQuery)) {
      await this.operator.issueError(
        res,
        TELEGRAM,
        400,
        'multiple redirectUrl query received'
      );
      this.operator.redirect(res);
      return;
    }

    const [loginErr, userData] = this._verifyLoginQuery(query);
    if (loginErr) {
      await this.operator.issueError(
        res,
        TELEGRAM,
        loginErr.code,
        loginErr.message
      );
      this.operator.redirect(res, redirectQuery, { assertInternal: true });
      return;
    }

    let chatData: undefined | RawChat;
    if (chatQuery) {
      const chatId =
        typeof chatQuery === 'string' && chatQuery[0] === '@'
          ? chatQuery
          : Number(chatQuery);

      if (Number.isNaN(chatId)) {
        await this.operator.issueError(res, TELEGRAM, 400, 'invalid chat id');
        this.operator.redirect(res, redirectQuery, { assertInternal: true });
        return;
      }

      const [err, chatResult, userResult] = await this._checkChatMember(
        chatId,
        userData.id
      );

      if (err) {
        await this.operator.issueError(res, TELEGRAM, err.code, err.message);
        this.operator.redirect(res, redirectQuery, { assertInternal: true });
        return;
      }

      userData.language_code = userResult.language_code;
      chatData = {
        type: chatResult.type,
        id: chatResult.id,
        title: chatResult.title,
        username: chatResult.username,
        description: chatResult.description,
      };
    }

    await this.operator.issueAuth<TelegramAuthData>(res, TELEGRAM, {
      bot: this.bot.id,
      chat: chatData,
      user: userData,
      photo: query.photo_url as string | undefined,
    });
    this.operator.redirect(res, redirectQuery, { assertInternal: true });
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
    data: TelegramAuthData
  ): Promise<VerifyResult<TelegramAuthData>> {
    if (data.bot !== this.bot.id) {
      return { ok: false, code: 400, reason: 'bot not match' };
    }

    return {
      ok: true,
      data,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  checkAuthData(data: TelegramAuthData): CheckDataResult<TelegramAuthContext> {
    if (data.bot !== this.bot.id) {
      return { ok: false, code: 400, reason: 'bot not match' };
    }

    return {
      ok: true,
      contextDetails: getAuthContextDetails(data),
    };
  }

  private _verifyLoginQuery(
    query: ParsedUrlQuery
  ): [null | { code: number; message: string }, Omit<RawUser, 'is_bot'>] {
    const { hash } = query;
    if (typeof hash !== 'string') {
      const err = { code: 400, message: 'invalid login parameters' };
      return [err, null as never];
    }

    const paramsCheckingString = LOGIN_PARAMETERS.reduce(
      (str, key) => (query[key] ? `${str}\n${key}=${query[key]}` : str),
      ''
    ).slice(1);

    const hashedParams = createHmac('sha256', this._secretKey)
      .update(paramsCheckingString)
      .digest('hex');

    if (hashedParams !== hash) {
      const err = { code: 401, message: 'invalid login signature' };
      return [err, null as never];
    }

    if (Number(query.auth_date as string) < Date.now() / 1000 - 20) {
      const err = { code: 401, message: 'login expired' };
      return [err, null as never];
    }

    return [
      null,
      {
        id: Number(query.id),
        username: query.username as string | undefined,
        first_name: query.first_name as string,
        last_name: query.last_name as string | undefined,
        language_code: undefined,
      },
    ];
  }

  private async _checkChatMember(
    chatId: number | string,
    userId: number
  ): Promise<[null | { code: number; message: string }, RawChat, RawUser]> {
    try {
      const chatMember = await this.bot.makeApiCall('getChatMember', {
        chat_id: chatId,
        user_id: userId,
      });

      if (
        chatMember.status === 'left' ||
        chatMember.status === 'kicked' ||
        (chatMember.status === 'restricted' && chatMember.is_member === false)
      ) {
        const err = { code: 401, message: 'user is unauthorized to chat' };
        return [err, null as never, null as never];
      }

      const chatResult: RawChat = await this.bot.makeApiCall('getChat', {
        chat_id: chatId,
      });

      return [null, chatResult, chatMember.user];
    } catch (err) {
      const { code, description }: TelegramApiError = err;
      return [{ code, message: description }, null as never, null as never];
    }
  }
}

const ServerAuthenticatorP = makeClassProvider({
  lifetime: 'singleton',
  deps: [BotP, Auth.HttpOperator],
  factory: (bot, operator) => {
    return new TelegramServerAuthenticator(bot, operator);
  },
})(TelegramServerAuthenticator);

type ServerAuthenticatorP = TelegramServerAuthenticator;

export default ServerAuthenticatorP;
