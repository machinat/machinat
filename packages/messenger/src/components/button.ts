import { makePartSegment } from '@machinat/core/renderer';
import type { PartSegment } from '@machinat/core/renderer';
import { makeMessengerComponent } from '../utils';
import type { MessengerComponent } from '../types';

/**
 * @category Props
 */
export type UrlButtonProps = {
  /** Button title. 20 character limit. */
  title: string;
  /**
   * This URL is opened in a mobile browser when the button is tapped. Must use
   * HTTPS protocol if messenger_extensions is true.
   */
  url: string;
  /**
   * The URL to use on clients that don't support Messenger Extensions. If this
   * is not defined, the url will be used as the fallback. It may only be
   * specified if messenger_extensions is true.
   */
  fallbackUrl?: string;
  /** Must be true if using Messenger Extensions. */
  messengerExtensions?: boolean;
  /** Height of the Webview. */
  webviewHeightRatio?: 'compact' | 'tall' | 'full';
  /**
   * Set to hide to disable the share button in the Webview (for sensitive
   * info).
   */
  webviewShareButton?: 'hide';
  /** Alias of `webviewShareButton="hide"` when set to true. */
  hideWebviewShare?: boolean;
};

/**
 * The URL Button opens a webpage in the Messenger webview. This button can be
 * used with the Button and Generic Templates.
 * @category Component
 * @props {@link UrlButtonProps}
 * @guides Check official [doc](https://developers.facebook.com/docs/messenger-platform/reference/buttons/url)
 *   and [reference](https://developers.facebook.com/docs/messenger-platform/send-messages/buttons#url).
 */
export const UrlButton: MessengerComponent<
  UrlButtonProps,
  PartSegment<any>
> = makeMessengerComponent(function UrlButton(node, path) {
  const {
    title,
    url,
    fallbackUrl,
    messengerExtensions,
    webviewHeightRatio,
    webviewShareButton,
    hideWebviewShare,
  } = node.props;

  return [
    makePartSegment(node, path, {
      type: 'web_url',
      title,
      url,
      webview_height_ratio: webviewHeightRatio,
      messenger_extensions: messengerExtensions,
      fallback_url: fallbackUrl,
      webview_share_button:
        webviewShareButton || hideWebviewShare ? 'hide' : undefined,
    }),
  ];
});

/**
 * @category Props
 */
export type PostbackButtonProps = {
  /** Button title. 20 character limit. */
  title: string;
  /** This data will be sent back to your webhook. 1000 character limit. */
  payload: string;
};

/**
 * When the postback button is tapped, the Messenger Platform sends an event to
 * your postback webhook. This is useful when you want to invoke an action in
 * your bot. This button can be used with the Button Template and Generic
 * Template.
 * @category Component
 * @props {@link PostbackButtonProps}
 * @guides Check official [doc](https://developers.facebook.com/docs/messenger-platform/send-messages/buttons#postback)
 *   and [reference](https://developers.facebook.com/docs/messenger-platform/reference/buttons/postback).
 */
export const PostbackButton: MessengerComponent<
  PostbackButtonProps,
  PartSegment<any>
> = makeMessengerComponent(function PostbackButton(node, path) {
  const { title, payload } = node.props;
  return [
    makePartSegment(node, path, {
      type: 'postback',
      title,
      payload,
    }),
  ];
});

/**
 * @category Props
 */
export type CallButtonProps = {
  /** Button title, 20 character limit. */
  title: string;
  /**
   * Format must have "+" prefix followed by the country code, area code and
   * local number.
   */
  number: string;
};

/**
 * The Call Button can be used to initiate a phone call. This button can be used
 * with the Button and Generic Templates.
 * @category Component
 * @props {@link CallButtonProps}
 * @guides Check official [doc](https://developers.facebook.com/docs/messenger-platform/send-messages/buttons#call)
 *   and [reference](https://developers.facebook.com/docs/messenger-platform/reference/buttons/call).
 */
export const CallButton: MessengerComponent<
  CallButtonProps,
  PartSegment<any>
> = makeMessengerComponent(function CallButton(node, path) {
  const { title, number } = node.props;
  return [
    makePartSegment(node, path, {
      type: 'phone_number',
      title,
      number,
    }),
  ];
});

/**
 * @category Props
 */
export type LoginButtonProps = {
  /** Authentication callback URL. Must use HTTPS protocol. */
  url: string;
};

/**
 * The log in button triggers the [account linking authentication flow](https://developers.facebook.com/docs/messenger-platform/account-linking/authentication).
 * @category Component
 * @props {@link LoginButtonProps}
 * @guides Check official [doc](https://developers.facebook.com/docs/messenger-platform/send-messages/buttons#login)
 *   and [reference](https://developers.facebook.com/docs/messenger-platform/reference/buttons/login).
 */
export const LoginButton: MessengerComponent<
  LoginButtonProps,
  PartSegment<any>
> = makeMessengerComponent(function LoginButton(node, path) {
  const { url } = node.props;
  return [
    makePartSegment(node, path, {
      type: 'account_link',
      url,
    }),
  ];
});

/**
 * The log out button triggers the account unlinking flow.
 * @category Component
 * @props `{}`
 * @guides Check official [doc](https://developers.facebook.com/docs/messenger-platform/send-messages/buttons#game_play)
 *   and [reference](https://developers.facebook.com/docs/messenger-platform/reference/buttons/game-play).
 */
export const LogoutButton: MessengerComponent<
  {},
  PartSegment<any>
> = makeMessengerComponent(function LogoutButton(node, path) {
  return [makePartSegment(node, path, { type: 'account_unlink' })];
});

/**
 * @category Props
 */
export type GamePlayButtonProps = {
  /** Button title, 20 character limit. */
  title: string;
  /** This data will be sent to the game. */
  payload?: string;
  /** Player ID (Instant Game name-space) to play against. */
  playerId?: string;
  /** ontext ID (Instant Game name-space) of the THREAD to play in. */
  contextId?: string;
};

/**
 * The game play button launches an Instant Game that is associated with the bot
 * page.
 * @category Component
 * @props {@link GamePlayButtonProps}
 * @guides Check official [doc](https://developers.facebook.com/docs/messenger-platform/send-messages/buttons#logout)
 *   and [reference](https://developers.facebook.com/docs/messenger-platform/reference/buttons/logout).
 */
export const GamePlayButton: MessengerComponent<
  GamePlayButtonProps,
  PartSegment<any>
> = makeMessengerComponent(function GamePlayButton(node, path) {
  const { title, payload, playerId, contextId } = node.props;
  return [
    makePartSegment(node, path, {
      type: 'game_play',
      title,
      payload,
      game_metadata:
        playerId || contextId
          ? {
              player_id: playerId,
              context_id: contextId,
            }
          : undefined,
    }),
  ];
});
