import { serviceProviderClass } from '@sociably/core/service';
import {
  ServerAuthenticator,
  VerifyResult,
  CheckDataResult,
} from '@sociably/auth';
import BasicAuthenticator from '@sociably/auth/basicAuth';
import { MetaApiError } from '@sociably/meta-api';
import BotP from '../Bot';
import ProfilerP from '../Profiler';
import FacebookPage from '../Page';
import FacebookChat from '../Chat';
import FacebookUser from '../User';
import { FACEBOOK } from '../constant';
import { PageSettingsAccessorI } from '../interface';
import { getAuthContextDetails } from './utils';
import type { FacebookAuthContext, FacebookAuthData } from './types';

/**
 * @category Provider
 */
export class FacebookServerAuthenticator
  implements ServerAuthenticator<never, FacebookAuthData, FacebookAuthContext>
{
  private profiler: ProfilerP;
  basicAuthenticator: BasicAuthenticator;
  settingsAccessor: PageSettingsAccessorI;
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
    settingsAccessor: PageSettingsAccessorI
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
        };
      },
      getChatLink: (chat) => `https://m.me/${chat.pageId}`,
    });
  }

  getAuthUrl(user: FacebookUser, redirectUrl?: string): string {
    return this.basicAuthenticator.getAuthUrl<FacebookAuthData>(
      FACEBOOK,
      { page: user.pageId, user: user.id },
      redirectUrl
    );
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
    data: FacebookAuthData
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
    userId: string
  ): Promise<VerifyResult<FacebookAuthData>> {
    try {
      const [settings, userProfile] = await Promise.all([
        this.settingsAccessor.getAgentSettings(new FacebookPage(pageId)),
        this.profiler.getUserProfile(
          new FacebookPage(pageId),
          new FacebookUser(pageId, userId)
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
        : { ok: false, code: 404, reason: `page "${pageId}" not registered` };
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
  deps: [BotP, ProfilerP, BasicAuthenticator, PageSettingsAccessorI],
})(FacebookServerAuthenticator);

type ServerAuthenticatorP = FacebookServerAuthenticator;

export default ServerAuthenticatorP;
