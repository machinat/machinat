import { serviceProviderClass } from '@sociably/core/service';
import {
  ServerAuthenticator,
  VerifyResult,
  CheckDataResult,
} from '@sociably/auth';
import BasicAuthenticator from '@sociably/auth/basicAuth';
import { MetaApiError } from '@sociably/meta-api';
import { attachWebviewParamsOnUrl } from '@sociably/webview/client';
import BotP from '../Bot.js';
import ProfilerP from '../Profiler.js';
import InstagramAgent from '../Agent.js';
import InstagramChat from '../Chat.js';
import InstagramUser from '../User.js';
import { INSTAGRAM } from '../constant.js';
import { AgentSettingsAccessorI } from '../interface.js';
import { getAuthContextDetails } from './utils.js';
import type { InstagramAuthContext, InstagramAuthData } from './types.js';

/** @category Provider */
export class InstagramServerAuthenticator
  implements
    ServerAuthenticator<never, InstagramAuthData, InstagramAuthContext>
{
  private profiler: ProfilerP;
  basicAuthenticator: BasicAuthenticator;
  settingsAccessor: AgentSettingsAccessorI;
  delegateAuthRequest: ServerAuthenticator<
    never,
    InstagramAuthData,
    InstagramAuthContext
  >['delegateAuthRequest'];

  platform = INSTAGRAM;

  constructor(
    bot: BotP,
    profiler: ProfilerP,
    basicAuthenticator: BasicAuthenticator,
    settingsAccessor: AgentSettingsAccessorI,
  ) {
    this.profiler = profiler;
    this.basicAuthenticator = basicAuthenticator;
    this.settingsAccessor = settingsAccessor;
    this.delegateAuthRequest = this.basicAuthenticator.createRequestDelegator<
      InstagramAuthData,
      InstagramAuthData,
      InstagramChat
    >({
      bot,
      platform: INSTAGRAM,
      platformName: 'Instagram',
      platformColor: '#4B69FF',
      platformImageUrl: 'https://sociably.js.org/img/icon/messenger.png',
      checkCurrentAuthUsability: (credential, data) => ({
        ok:
          credential.agent.id === data.agent.id &&
          credential.user === data.user,
      }),
      verifyCredential: async (credential) => {
        const {
          agent: { id: agentId },
          user: userId,
        } = credential;
        return this.verifyUser(agentId, userId);
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
          chatLinkUrl: `https://ig.me/m/${data.agent.name}`,
        };
      },
    });
  }

  async getAuthUrl(
    user: InstagramUser,
    options?: {
      redirectUrl?: string;
      webviewParams?: Record<string, unknown>;
    },
  ): Promise<string> {
    const agent = new InstagramAgent(user.agentId);
    const settings = await this.settingsAccessor.getAgentSettings(agent);
    if (!settings) {
      throw new Error(
        `instagram agent account "${agent.username}" not registered`,
      );
    }

    const authUrl = this.basicAuthenticator.getAuthUrl<InstagramAuthData>(
      INSTAGRAM,
      {
        agent: {
          id: user.agentId,
          name: settings.username,
        },
        user: user.id,
      },
      options?.redirectUrl,
    );
    return options?.webviewParams
      ? attachWebviewParamsOnUrl(authUrl, options.webviewParams)
      : authUrl;
  }

  // eslint-disable-next-line class-methods-use-this
  async verifyCredential(): Promise<VerifyResult<InstagramAuthData>> {
    return {
      ok: false as const,
      code: 403,
      reason: 'should use backend based flow only',
    };
  }

  async verifyRefreshment({
    agent: { id: agentId },
    user: userId,
  }: InstagramAuthData): Promise<VerifyResult<InstagramAuthData>> {
    return this.verifyUser(agentId, userId);
  }

  // eslint-disable-next-line class-methods-use-this
  checkAuthData(
    data: InstagramAuthData,
  ): CheckDataResult<InstagramAuthContext> {
    return {
      ok: true,
      contextDetails: getAuthContextDetails(data),
    };
  }

  private async verifyUser(
    agentId: string,
    userId: string,
  ): Promise<VerifyResult<InstagramAuthData>> {
    try {
      const [settings, userProfile] = await Promise.all([
        this.settingsAccessor.getAgentSettings(new InstagramAgent(agentId)),
        this.profiler.getUserProfile(agentId, userId),
      ]);

      return settings
        ? {
            ok: true,
            data: {
              agent: { id: agentId, name: settings.username },
              user: userId,
              profile: userProfile?.data,
            },
          }
        : {
            ok: false,
            code: 404,
            reason: `instagram agent account "${agentId}" not registered`,
          };
    } catch (err) {
      return err instanceof MetaApiError && err.code === 404
        ? {
            ok: false,
            code: 404,
            reason: `user "${userId}" not found or not authorized`,
          }
        : {
            ok: false,
            code: err instanceof MetaApiError ? err.code : 500,
            reason: err.message,
          };
    }
  }
}

const ServerAuthenticatorP = serviceProviderClass({
  lifetime: 'singleton',
  deps: [BotP, ProfilerP, BasicAuthenticator, AgentSettingsAccessorI],
})(InstagramServerAuthenticator);

type ServerAuthenticatorP = InstagramServerAuthenticator;

export default ServerAuthenticatorP;
