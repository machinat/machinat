import { posix as posixPath } from 'path';
import Sociably, { serviceContainer, RenderingTarget } from '@sociably/core';
import { UrlButton } from '../components/index.js';
import TelegramChat from '../Chat.js';
import ServerAuthenticator from './ServerAuthenticator.js';

type WebviewButtonProps = {
  /** Label text on the button. */
  text: string;
  /** The webview page to open */
  page?: string;
  /** New text of the button in forwarded messages. */
  forwardText?: string;
  /**
   * Username of a bot, which will be used for user authorization. If not
   * specified, the current bot's username will be assumed. The url's domain
   * must be the same as the domain linked with the bot.
   */
  botUserName?: string;
  /**
   * Pass True to request the permission for your bot to send messages to the
   * user.
   */
  requestWriteAccess?: boolean;
  /** Additional query parameters to pass to the webview page */
  params?: Record<string, string>;
};

const WebviewButton =
  (authenticator: ServerAuthenticator, renderingTarget: RenderingTarget) =>
  ({
    text,
    page,
    forwardText,
    botUserName,
    requestWriteAccess,
    params: webviewParams,
  }: WebviewButtonProps) => {
    let botId: number;
    let chatId: undefined | string | number;
    if (renderingTarget instanceof TelegramChat) {
      ({ botId } = renderingTarget);
      chatId = renderingTarget.id;
    } else {
      throw new Error('WebviewButton can only be used in TelegramChat');
    }

    const url = authenticator.getAuthUrl(botId, {
      chatId,
      webviewParams,
      redirectUrl: page ? posixPath.join('.', page) : undefined,
    });
    return (
      <UrlButton
        login
        text={text}
        url={url}
        forwardText={forwardText}
        botUserName={botUserName}
        requestWriteAccess={requestWriteAccess}
      />
    );
  };

export default serviceContainer({
  deps: [ServerAuthenticator, RenderingTarget],
})(WebviewButton);
