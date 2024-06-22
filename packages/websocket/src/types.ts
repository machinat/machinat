import type {
  NativeComponent,
  SociablyNode,
  SociablyUser,
  PlatformUtilities,
  EventMiddleware,
  DispatchMiddleware,
} from '@sociably/core';
import type { DispatchFrame, DispatchResponse } from '@sociably/core/engine';
import type { MaybeContainer } from '@sociably/core/service';
import type { UnitSegment } from '@sociably/core/renderer';
import type { HttpRequestInfo } from '@sociably/http';
import type { WebSocketBot } from './Bot.js';
import type WebSocketConnection from './Connection.js';

export type { WebSocketServer as WsServer } from 'ws';
export type { HttpRequestInfo } from '@sociably/http';

export type ConnIdentifier = {
  serverId: string;
  id: string;
};

export type UpgradeRequestInfo = Omit<HttpRequestInfo, 'body'>;

export type EventValue<
  Category extends string = string,
  Type extends string = string,
  Payload = unknown,
> = {
  category: Category;
  type: Type;
  payload: Payload;
};

export type ConnectEventValue = EventValue<'connection', 'connect', null>;

export type DisconnectEventValue = EventValue<
  'connection',
  'disconnect',
  { reason: string | undefined }
>;

export type ConnectionEventValue = ConnectEventValue | DisconnectEventValue;

export type WebSocketEvent<
  Value extends EventValue,
  User extends null | SociablyUser,
> = Value & {
  platform: 'websokcet';
  thread: WebSocketConnection;
  // TODO: channel field is left for potential namespace feature
  channel: null;
  user: User;
};

export type EventInput = {
  category?: string;
  type: string;
  payload?: unknown;
};

export type ConnectionTarget = {
  type: 'connection';
  serverId: string;
  id: string;
};

export type TopicTarget = {
  type: 'topic';
  key: string;
};

export type DispatchTarget = ConnectionTarget | TopicTarget;

export type WebSocketJob = {
  target: DispatchTarget;
  values: EventInput[];
};

export type WebSocketResult = {
  connections: ConnIdentifier[];
};

export type WebSocketDispatchFrame = DispatchFrame<
  null | WebSocketConnection,
  WebSocketJob
>;

export type WebSocketMetadata<AuthContext> = {
  source: 'websocket';
  request: UpgradeRequestInfo;
  connection: WebSocketConnection;
  auth: AuthContext;
};

export type WebSocketComponent = NativeComponent<
  unknown,
  UnitSegment<EventInput>
>;

export type WebSocketDispatchResponse = DispatchResponse<
  WebSocketJob,
  WebSocketResult
>;

export type WebSocketEventContext<
  User extends null | SociablyUser,
  AuthContext,
  Value extends EventValue = EventValue,
> = {
  platform: 'websocket';
  event: WebSocketEvent<Value, User>;
  metadata: WebSocketMetadata<AuthContext>;
  bot: WebSocketBot;
  reply(message: SociablyNode): Promise<null | WebSocketDispatchResponse>;
};

type OkVerifyLoginResult<User extends null | SociablyUser, AuthContext> = {
  ok: true;
  user: User;
  authContext: AuthContext;
  expireAt?: Date;
};

type FailVerifyLoginResult = {
  ok: false;
  code: number;
  reason: string;
};

export type VerifyLoginFn<
  User extends null | SociablyUser,
  AuthContext,
  Credential,
> = (
  request: UpgradeRequestInfo,
  credential: Credential,
) => Promise<OkVerifyLoginResult<User, AuthContext> | FailVerifyLoginResult>;

export type AnyVerifyLoginFn = VerifyLoginFn<any, unknown, unknown>;

export type VerifyUpgradeFn = (
  request: UpgradeRequestInfo,
) => boolean | Promise<boolean>;

export type ClientLoginFn<
  User extends null | SociablyUser,
  Credential,
> = () => Promise<{
  user: User;
  credential: Credential;
}>;

export type WebSocketEventMiddleware<
  User extends null | SociablyUser,
  Auth,
> = EventMiddleware<WebSocketEventContext<User, Auth>, null>;

export type WebSocketDispatchMiddleware = DispatchMiddleware<
  WebSocketJob,
  WebSocketDispatchFrame,
  WebSocketResult
>;

export type WebSocketConfigs<
  User extends null | SociablyUser = null,
  Auth = null,
> = {
  entryPath?: string;
  heartbeatInterval?: number;
  eventMiddlewares?: MaybeContainer<WebSocketEventMiddleware<User, Auth>>[];
  dispatchMiddlewares?: MaybeContainer<WebSocketDispatchMiddleware>[];
};

export type WebSocketPlatformUtilities<
  User extends null | SociablyUser,
  Auth,
> = PlatformUtilities<
  WebSocketEventContext<User, Auth>,
  null,
  WebSocketJob,
  WebSocketDispatchFrame,
  WebSocketResult
>;

export type WebSocketClusterBroker = {
  start(): Promise<void>;
  stop(): Promise<void>;
  dispatchRemote(job: WebSocketJob): Promise<ConnIdentifier[]>;

  subscribeTopicRemote(conn: ConnIdentifier, topic: string): Promise<boolean>;
  unsubscribeTopicRemote(conn: ConnIdentifier, topic: string): Promise<boolean>;

  disconnectRemote(conn: ConnIdentifier): Promise<boolean>;
  onRemoteEvent(handler: (job: WebSocketJob) => void): void;
};

export interface EmittableWebSocket {
  binaryType: string;
  bufferedAmount: number;
  extensions: string;
  protocol: string;
  readyState: number;
  url: string;
  send(data: unknown, callback: () => void): void;
  close(code?: number, reason?: string): void;
  on(event: 'open', listener: () => void): void;
  on(event: 'message', listener: (data: unknown) => void): void;
  on(event: 'close', listener: (code: number, reason: string) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  ping(data?: unknown, mask?: boolean, cb?: (err: Error) => void): void;
}
