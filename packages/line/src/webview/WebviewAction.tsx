import Sociably, { serviceContainer, RenderingTarget } from '@sociably/core';
import { UriAction } from '../components/index.js';
import LineChannel from '../Channel.js';
import LineChat from '../Chat.js';
import { LiffAppChoiceSetting } from '../types.js';
import ServerAuthenticator from './ServerAuthenticator.js';

type WebviewActionProps = {
  /** Label for the action */
  label?: string;
  /** The webview page to open */
  page?: string;
  /** Choose the LIFF App to use */
  liffAppChoice?: keyof LiffAppChoiceSetting;
  /** Additional query parameters to pass to the webview page */
  params?: Record<string, string>;
};

const WebviewAction =
  (authenticator: ServerAuthenticator, targetChat: RenderingTarget) =>
  async ({ label, page, liffAppChoice, params }: WebviewActionProps) => {
    if (!targetChat || !(targetChat instanceof LineChat)) {
      throw new Error('WebviewAction can only be used in a LineChat');
    }

    const url = await authenticator.getLiffUrl(
      new LineChannel(targetChat.channelId),
      { path: page, chat: targetChat, liffAppChoice, webviewParams: params },
    );
    return <UriAction label={label} uri={url} />;
  };

export default serviceContainer({
  deps: [ServerAuthenticator, RenderingTarget],
})(WebviewAction);
