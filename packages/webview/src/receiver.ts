import type { PopEventWrapper, PopEventFn, PopErrorFn } from '@sociably/core';
import { makeClassProvider } from '@sociably/core/service';
import ModuleUtilitiesI from '@sociably/core/base/ModuleUtilities';
import {
  AnyServerAuthenticator,
  UserOfAuthenticator,
  ContextOfAuthenticator,
} from '@sociably/auth';
import type { HttpRequestInfo } from '@sociably/http';
import WebSocket, {
  EventInput,
  EventValue,
  ConnectEventValue,
  DisconnectEventValue,
} from '@sociably/websocket';
import { WEBVIEW } from './constant';
import { WebviewSocketServer, PlatformUtilitiesI } from './interface';
import { BotP } from './bot';
import { WebviewConnection } from './thread';
import { createEvent } from './utils';
import type { WebviewEventContext } from './types';

/**
 * @category Provider
 */
export class WebviewReceiver<
  Authenticator extends AnyServerAuthenticator,
  Value extends EventValue
> {
  private _bot: BotP;
  private _server: WebviewSocketServer<Authenticator>;

  private _popEvent: PopEventFn<
    WebviewEventContext<Authenticator, Value>,
    null
  >;

  private _popError: PopErrorFn;

  constructor(
    bot: BotP,
    server: WebviewSocketServer<Authenticator>,
    popEventWrapper: PopEventWrapper<
      WebviewEventContext<Authenticator, Value>,
      null
    >,
    popError: PopErrorFn
  ) {
    this._bot = bot;
    this._server = server;

    this._popEvent = popEventWrapper(() => Promise.resolve(null));
    this._popError = popError;

    this._server.on(
      'events',
      (values, { connId, user, request, authContext }) => {
        values.forEach((value) => {
          this._issueEvent(value, connId, user, request, authContext);
        });
      }
    );

    this._server.on('connect', ({ connId, user, request, authContext }) => {
      const value: ConnectEventValue = {
        category: 'connection',
        type: 'connect',
        payload: null,
      };
      this._issueEvent(value, connId, user, request, authContext);
    });

    this._server.on('disconnect', ({ reason }, connData) => {
      const { connId, user, request, authContext } = connData;
      const value: DisconnectEventValue = {
        category: 'connection',
        type: 'disconnect',
        payload: { reason },
      };

      this._issueEvent(value, connId, user, request, authContext);
    });

    this._server.on('error', (err: Error) => {
      this._popError(err);
    });
  }

  private _issueEvent(
    value: EventInput,
    connId: string,
    user: UserOfAuthenticator<Authenticator>,
    request: HttpRequestInfo,
    authContext: ContextOfAuthenticator<Authenticator>
  ) {
    const thread = new WebviewConnection(this._server.id, connId);
    this._popEvent({
      platform: WEBVIEW,
      bot: this._bot,
      event: createEvent(value, thread, user),
      metadata: {
        source: 'websocket',
        request,
        connection: thread,
        auth: authContext,
      },
      reply: (message) => this._bot.render(thread, message),
    }).catch(this._popError);
  }
}

export const ReceiverP = makeClassProvider({
  lifetime: 'singleton',
  deps: [BotP, WebSocket.Server, ModuleUtilitiesI, PlatformUtilitiesI],
  factory: (
    bot,
    server: WebviewSocketServer<AnyServerAuthenticator>,
    { popError },
    { popEventWrapper }
  ) => new WebviewReceiver(bot, server, popEventWrapper, popError),
})(WebviewReceiver);

export type ReceiverP<
  Authenticator extends AnyServerAuthenticator,
  Value extends EventValue
> = WebviewReceiver<Authenticator, Value>;
