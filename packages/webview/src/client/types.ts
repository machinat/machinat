import type {
  UserOfAuthenticator,
  ContextOfAuthenticator,
} from '@sociably/auth';
import type {
  EventValue,
  WebviewEvent,
  AnyClientAuthenticator,
} from '../types.js';
import type WebviewClient from './Client.js';

export type ClientEventContext<
  Authenticator extends AnyClientAuthenticator = AnyClientAuthenticator,
  Value extends EventValue = EventValue,
  Params = null,
> = {
  event: WebviewEvent<Value, UserOfAuthenticator<Authenticator>>;
  authenticator: Authenticator;
  auth: ContextOfAuthenticator<Authenticator>;
  params: null | Params;
};

export type EventContextOfClient<
  Client extends WebviewClient<AnyClientAuthenticator, EventValue>,
> = Client extends WebviewClient<infer Authenticator, infer Value>
  ? ClientEventContext<Authenticator, Value>
  : never;

export type ClientOptions<Authenticator extends AnyClientAuthenticator> = {
  /**
   * Secify the platform to login. Default to the value of `platform`
   * querystring
   */
  platform?: string;
  /** URL string to connect WebSocket backend. Default to `"/websocket"` */
  webSocketUrl?: string;
  /** URL of the auth backend API. Default to `"/auth"` */
  authApiUrl?: string;
  /** Authenticators of the platforms. */
  authPlatforms: Authenticator[];
  /**
   * When set to true, the underlying network operations would not be executed.
   * It's useful for server rendering at server side.
   */
  mockupMode?: boolean;
};
