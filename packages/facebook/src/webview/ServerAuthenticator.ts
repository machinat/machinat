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
import FacebookPage from '../Page.js';
import FacebookChat from '../Chat.js';
import FacebookUser from '../User.js';
import { FACEBOOK } from '../constant.js';
import { AgentSettingsAccessorI } from '../interface.js';
import { getAuthContextDetails } from './utils.js';
import type { FacebookAuthContext, FacebookAuthData } from './types.js';

/** @category Provider */
export class FacebookServerAuthenticator
  implements ServerAuthenticator<never, FacebookAuthData, FacebookAuthContext>
{
  private profiler: ProfilerP;
  basicAuthenticator: BasicAuthenticator;
  settingsAccessor: AgentSettingsAccessorI;
  delegateAuthRequest: ServerAuthenticator<
    never,
    FacebookAuthData,
    FacebookAuthContext
  >['delegateAuthRequest'];

  platform = FACEBOOK;

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
      FacebookAuthData,
      FacebookAuthData,
      FacebookChat
    >({
      bot,
      platform: FACEBOOK,
      platformName: 'Facebook',
      platformColor: '#4B69FF',
      platformImageUrl: 'https://sociably.js.org/img/icon/messenger.png',
      checkCurrentAuthUsability: (credential, data) => ({
        ok: credential.page === data.page && credential.user === data.user,
      }),
      verifyCredential: async (credential) => {
        const { page: pageId, user: userId } = credential;
        return this._verifyUser(pageId, userId);
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
          chatLinkUrl: `https://m.me/${data.page}`,
        };
      },
    });
  }

  getAuthUrl(
    user: FacebookUser,
    options?: {
      redirectUrl?: string;
      webviewParams?: Record<string, unknown>;
    },
  ): string {
    const authUrl = this.basicAuthenticator.getAuthUrl<FacebookAuthData>(
      FACEBOOK,
      { page: user.pageId, user: user.id },
      options?.redirectUrl,
    );
    return options?.webviewParams
      ? attachWebviewParamsOnUrl(authUrl, options.webviewParams)
      : authUrl;
  }

  // eslint-disable-next-line class-methods-use-this
  async verifyCredential(): Promise<VerifyResult<FacebookAuthData>> {
    return {
      ok: false as const,
      code: 403,
      reason: 'should use backend based flow only',
    };
  }

  async verifyRefreshment(
    data: FacebookAuthData,
  ): Promise<VerifyResult<FacebookAuthData>> {
    return this._verifyUser(data.page, data.user);
  }

  // eslint-disable-next-line class-methods-use-this
  checkAuthData(data: FacebookAuthData): CheckDataResult<FacebookAuthContext> {
    return {
      ok: true,
      contextDetails: getAuthContextDetails(data),
    };
  }

  private async _verifyUser(
    pageId: string,
    userId: string,
  ): Promise<VerifyResult<FacebookAuthData>> {
    try {
      const [settings, userProfile] = await Promise.all([
        this.settingsAccessor.getAgentSettings(new FacebookPage(pageId)),
        this.profiler.getUserProfile(
          new FacebookPage(pageId),
          new FacebookUser(pageId, userId),
        ),
      ]);

      return settings
        ? {
            ok: true,
            data: {
              page: pageId,
              user: userId,
              profile: userProfile?.data,
            },
          }
        : {
            ok: false,
            code: 404,
            reason: `Facebook page "${pageId}" not registered`,
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
})(FacebookServerAuthenticator);

type ServerAuthenticatorP = FacebookServerAuthenticator;

export default ServerAuthenticatorP;
