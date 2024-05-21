import { posix as posixPath } from 'path';
import Sociably, { serviceContainer, RenderingTarget } from '@sociably/core';
import FacebookChat from '../Chat.js';
import FacebookUser from '../User.js';
import { UrlButton } from '../components/index.js';
import ServerAuthenticator from './ServerAuthenticator.js';

type WebviewButtonProps = {
  /** Button title. 20 character limit. */
  title: string;
  /** The webview page to open */
  page?: string;
  /** Additional query parameters to pass to the webview page */
  params?: Record<string, string>;
  /** Height of the Webview. */
  webviewHeightRatio?: 'compact' | 'tall' | 'full';
  /**
   * Set to `true` to disable the share button in the Webview (for sensitive
   * info)
   */
  hideShareButton?: boolean;
};

const WebviewButton =
  (authenticator: ServerAuthenticator, thread: RenderingTarget) =>
  ({
    title,
    page,
    params: webviewParams,
    webviewHeightRatio,
    hideShareButton,
  }: WebviewButtonProps) => {
    if (
      !thread ||
      !(thread instanceof FacebookChat) ||
      !('id' in thread.target)
    ) {
      throw new Error(
        'WebviewButton can only be used in the FacebookChat with a user ID',
      );
    }

    const url = authenticator.getAuthUrl(
      new FacebookUser(thread.pageId, thread.target.id),
      {
        redirectUrl: page ? posixPath.join('.', page) : undefined,
        webviewParams,
      },
    );
    return (
      <UrlButton
        title={title}
        url={url}
        hideShareButton={hideShareButton}
        webviewHeightRatio={webviewHeightRatio}
      />
    );
  };

export default serviceContainer({
  deps: [ServerAuthenticator, RenderingTarget],
})(WebviewButton);
