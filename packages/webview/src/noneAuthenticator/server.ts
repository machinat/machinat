/* eslint-disable class-methods-use-this */
import type { IncomingMessage, ServerResponse } from 'http';
import { makeClassProvider } from '@machinat/core/service';
import type {
  ServerAuthenticator,
  VerifyResult,
  ContextResult,
} from '@machinat/auth';
import { NoneUser, NoneChannel } from './instance';
import { NoneAuthData, NoneAuthContext } from './types';

export class NoneServerAuthenticator
  implements ServerAuthenticator<NoneAuthData, NoneAuthData, NoneAuthContext>
{
  platform = 'none';

  async delegateAuthRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    res.writeHead(403);
    res.end();
  }

  async verifyCredential(
    data: NoneAuthData
  ): Promise<VerifyResult<NoneAuthData>> {
    return {
      success: true as const,
      data,
    };
  }

  async verifyRefreshment(
    data: NoneAuthData
  ): Promise<VerifyResult<NoneAuthData>> {
    return {
      success: true as const,
      data,
    };
  }

  checkAuthContext({
    user: userId,
    channel: channelId,
  }: NoneAuthData): ContextResult<NoneAuthContext> {
    return {
      success: true,
      contextSupplment: {
        user: new NoneUser(userId),
        channel: new NoneChannel(channelId),
      },
    };
  }
}

const ServerAuthenticatorP = makeClassProvider({ lifetime: 'transient' })(
  NoneServerAuthenticator
);
type ServerAuthenticatorP = NoneServerAuthenticator;

export default ServerAuthenticatorP;
