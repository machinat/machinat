import { serviceProviderClass } from '@sociably/core/service';
import {
  ServerAuthenticator,
  VerifyResult,
  CheckDataResult,
} from '@sociably/auth';
import BasicAuthenticator from '@sociably/auth/basicAuth';
import { attachWebviewParamsOnUrl } from '@sociably/webview/client';
import BotP from '../Bot.js';
import { WHATSAPP } from '../constant.js';
import { AgentSettingsAccessorI } from '../interface.js';
import WhatsAppChat from '../Chat.js';
import WhatsAppAgent from '../Agent.js';
import { getAuthContextDetails, trimWaUrlNumber } from './utils.js';
import type {
  WhatsAppAuthContext,
  WhatsAppAuthData,
  WhatsAppAuthCrendential,
} from './types.js';

/** @category Provider */
export class WhatsAppServerAuthenticator
  implements ServerAuthenticator<never, WhatsAppAuthData, WhatsAppAuthContext>
{
  bot: BotP;
  basicAuthenticator: BasicAuthenticator;
  numberSettingsAccessor: AgentSettingsAccessorI;

  delegateAuthRequest: ServerAuthenticator<
    never,
    WhatsAppAuthData,
    WhatsAppAuthContext
  >['delegateAuthRequest'];

  platform = WHATSAPP;

  constructor(
    bot: BotP,
    basicAuthenticator: BasicAuthenticator,
    numberSettingsAccessor: AgentSettingsAccessorI,
  ) {
    this.bot = bot;
    this.basicAuthenticator = basicAuthenticator;
    this.numberSettingsAccessor = numberSettingsAccessor;
    this.delegateAuthRequest = this.basicAuthenticator.createRequestDelegator<
      WhatsAppAuthCrendential,
      WhatsAppAuthData,
      WhatsAppChat
    >({
      bot,
      platform: WHATSAPP,
      platformName: 'WhatsApp',
      platformColor: '#31BA45',
      platformImageUrl: 'https://sociably.js.org/img/icon/whatsapp.png',
      checkCurrentAuthUsability: (credential, data) => ({
        ok: credential.agent === data.agent.id && credential.user === data.user,
      }),
      verifyCredential: async ({
        agent: agentNumberId,
        user: userNumberId,
      }) => {
        const settings = await this.numberSettingsAccessor.getAgentSettings(
          new WhatsAppAgent(agentNumberId),
        );
        if (!settings) {
          return {
            ok: false,
            code: 404,
            reason: `agent number "${agentNumberId}" not registered`,
          };
        }
        return {
          ok: true,
          data: {
            agent: { id: agentNumberId, num: settings.phoneNumber },
            user: userNumberId,
          },
        };
      },
      checkAuthData: (data) => {
        const result = this.checkAuthData(data);
        if (!result.ok) {
          return result;
        }
        return {
          ok: true,
          data,
          thread: result.contextDetails.thread,
          chatLinkUrl: `https://wa.me/${trimWaUrlNumber(data.agent.num)}`,
        };
      },
    });
  }

  getAuthUrlPostfix(
    chat: WhatsAppChat,
    options?: {
      redirectUrl?: string;
      webviewParams?: Record<string, unknown>;
    },
  ): string {
    let url = this.basicAuthenticator.getAuthUrl<WhatsAppAuthCrendential>(
      WHATSAPP,
      {
        agent: chat.agentNumberId,
        user: chat.userNumberId,
      },
      options?.redirectUrl,
    );
    if (options?.webviewParams) {
      url = attachWebviewParamsOnUrl(url, options.webviewParams);
    }
    const { pathname, search, hash } = new URL(url);
    return `${pathname}${search}${hash}`;
  }

  // eslint-disable-next-line class-methods-use-this
  async verifyCredential(): Promise<VerifyResult<WhatsAppAuthData>> {
    return {
      ok: false as const,
      code: 403,
      reason: 'should use backend based flow only',
    };
  }

  async verifyRefreshment(
    data: WhatsAppAuthData,
  ): Promise<VerifyResult<WhatsAppAuthData>> {
    const agent = new WhatsAppAgent(data.agent.id);
    const numberSettings =
      await this.numberSettingsAccessor.getAgentSettings(agent);

    if (!numberSettings) {
      return {
        ok: false as const,
        code: 404,
        reason: `agent number "${data.agent.id}" not registered`,
      };
    }
    return { ok: true, data };
  }

  // eslint-disable-next-line class-methods-use-this
  checkAuthData(data: WhatsAppAuthData): CheckDataResult<WhatsAppAuthContext> {
    return {
      ok: true,
      contextDetails: getAuthContextDetails(data),
    };
  }
}

const ServerAuthenticatorP = serviceProviderClass({
  lifetime: 'singleton',
  deps: [BotP, BasicAuthenticator, AgentSettingsAccessorI],
})(WhatsAppServerAuthenticator);

type ServerAuthenticatorP = WhatsAppServerAuthenticator;

export default ServerAuthenticatorP;
