/// <reference lib="DOM" />
import { AnyMarshalType, BaseMarshaler } from '@sociably/core/base/Marshaler';
import AuthClient from '@sociably/auth/client';
import type {
  UserOfAuthenticator,
  ContextOfAuthenticator,
} from '@sociably/auth';
import { Connector, ClientEmitter } from '@sociably/websocket/client';
import { DEFAULT_AUTH_ROUTE, DEFAULT_WEBSOCKET_ROUTE } from '../constant.js';
import WebviewConnection from '../Connection.js';
import createEvent from '../utils/createEvent.js';
import type {
  EventInput,
  EventValue,
  ConnectEventValue,
  DisconnectEventValue,
  AnyClientAuthenticator,
} from '../types.js';
import type { ClientEventContext, ClientOptions } from './types.js';
import { getWebviewParamsFromUrl } from './utils.js';

class WebviewClient<
  Authenticator extends AnyClientAuthenticator = AnyClientAuthenticator,
  Value extends EventValue = EventValue,
  Params extends null | Record<string, unknown> = null,
> extends ClientEmitter<
  ClientEventContext<
    Authenticator,
    Value | ConnectEventValue | DisconnectEventValue,
    Params
  >
> {
  private _authClient: AuthClient<Authenticator>;
  private _connector: Connector<UserOfAuthenticator<Authenticator>>;
  private _platformInput: string | undefined;

  private _user: null | UserOfAuthenticator<Authenticator>;
  private _thread: null | WebviewConnection;

  isMockupMode: boolean;
  params: null | Params;

  get isConnected(): boolean {
    return this._connector.isConnected();
  }

  get isClosed(): boolean {
    return this._connector.isClosed;
  }

  get user(): null | UserOfAuthenticator<Authenticator> {
    return this._user;
  }

  get thread(): null | WebviewConnection {
    return this._thread;
  }

  get authContext(): null | ContextOfAuthenticator<Authenticator> {
    return this._authClient.getAuthContext();
  }

  get platform(): string | undefined {
    return this._authClient.platform;
  }

  constructor({
    webSocketUrl,
    platform,
    authPlatforms,
    authApiUrl,
    mockupMode = false,
  }: ClientOptions<Authenticator>) {
    super();

    this._user = null;
    this._thread = null;
    this.params = null;
    this.isMockupMode = mockupMode;
    this._platformInput = platform;

    this._authClient = new AuthClient({
      authenticators: authPlatforms,
      serverUrl: authApiUrl || `/${DEFAULT_AUTH_ROUTE}`,
    });

    const marshalTypes = authPlatforms.reduce((types, authenticator) => {
      if (authenticator.marshalTypes) {
        types.push(...authenticator.marshalTypes);
      }
      return types;
    }, [] as AnyMarshalType[]);

    this._connector = new Connector<UserOfAuthenticator<Authenticator>>(
      webSocketUrl || `/${DEFAULT_WEBSOCKET_ROUTE}`,
      this._getLoginAuth.bind(this),
      new BaseMarshaler(marshalTypes),
    )
      .on('connect', this._handleConnect.bind(this))
      .on('events', this._handleEvent.bind(this))
      .on('disconnect', this._handleDisconnect.bind(this))
      .on('error', this._emitError.bind(this));

    if (typeof window !== 'undefined') {
      this.params = getWebviewParamsFromUrl(window.location.href);
    }

    if (!this.isMockupMode) {
      this._connector.connect();
    }
  }

  async send(content: EventInput | EventInput[]): Promise<void> {
    await this._connector.send(Array.isArray(content) ? content : [content]);
  }

  close(code?: number, reason?: string): void {
    this._connector.close(code, reason);
  }

  /** Try close the webview. Return whether it's supported by current platform */
  closeWebview(): boolean {
    const authenticator = this._authClient.getAuthenticator();
    if (!authenticator) {
      return false;
    }

    return authenticator.closeWebview(this._authClient.getAuthContext());
  }

  private async _getLoginAuth(): Promise<{
    user: UserOfAuthenticator<Authenticator>;
    credential: string;
  }> {
    const { token, context } = await this._authClient.signIn({
      platform: this._platformInput,
    });
    return {
      user: context.user as UserOfAuthenticator<Authenticator>,
      credential: token,
    };
  }

  private _handleConnect({
    connId,
    user,
  }: {
    connId: string;
    user: UserOfAuthenticator<Authenticator>;
  }) {
    this._user = user;
    this._thread = new WebviewConnection('*', connId);

    this._emitEvent({
      event: createEvent(
        {
          category: 'connection',
          type: 'connect',
          payload: null,
        },
        this._thread,
        user,
      ),
      auth: this.authContext as ContextOfAuthenticator<Authenticator>,
      authenticator: this._authClient.getAuthenticator()!,
      params: this.params,
    });
  }

  private _handleEvent(values: Value[]) {
    for (const value of values) {
      this._emitEvent({
        event: createEvent(value, this._thread!, this._user!),
        auth: this.authContext as ContextOfAuthenticator<Authenticator>,
        authenticator: this._authClient.getAuthenticator()!,
        params: this.params,
      });
    }
  }

  private _handleDisconnect({ reason }: { reason: string }) {
    const thread = this._thread;
    this._thread = null;

    this._emitEvent({
      event: createEvent(
        {
          category: 'connection',
          type: 'disconnect',
          payload: { reason },
        },
        thread!,
        this._user!,
      ),
      auth: this.authContext as ContextOfAuthenticator<Authenticator>,
      authenticator: this._authClient.getAuthenticator()!,
      params: this.params,
    });
  }
}

export default WebviewClient;
