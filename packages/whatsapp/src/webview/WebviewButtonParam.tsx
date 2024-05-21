import { posix as posixPath } from 'path';
import Sociably, { serviceContainer, RenderingTarget } from '@sociably/core';
import WhatsAppChat from '../Chat.js';
import UserProfile from '../UserProfile.js';
import { UrlButtonParam } from '../components/index.js';
import ServerAuthenticator from './ServerAuthenticator.js';

type WebviewButtonParamProps = {
  /** The webview page to open */
  page?: string;
  /**
   * The 0-indexed position of the button. If the value is undefined, it's
   * decided by the order of params.
   */
  index?: number;
  /** Pass `user.profile` on the auth context while login */
  userProfile?: UserProfile;
  /** Additional query parameters to pass to the webview page */
  params?: Record<string, string>;
};

const WebviewButtonParam =
  (authenticator: ServerAuthenticator, thread: RenderingTarget) =>
  ({ page, index, params }: WebviewButtonParamProps) => {
    if (!thread || !(thread instanceof WhatsAppChat)) {
      throw new Error('WebviewButtonParam can only be used in WhatsAppChat');
    }

    const urlPostfix = authenticator.getAuthUrlPostfix(thread, {
      redirectUrl: page ? posixPath.join('.', page) : undefined,
      webviewParams: params,
    });
    return <UrlButtonParam urlPostfix={urlPostfix} index={index} />;
  };

export default serviceContainer({
  deps: [ServerAuthenticator, RenderingTarget],
})(WebviewButtonParam);
