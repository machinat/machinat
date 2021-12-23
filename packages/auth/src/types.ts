import type {
  IncomingMessage,
  ServerResponse,
  IncomingHttpHeaders,
} from 'http';
import type { MachinatUser, MachinatChannel } from '@machinat/core';
import type { RoutingInfo } from '@machinat/http';
import type AuthError from './error';

type TokenBase = {
  iat: number;
  exp: number;
};

export type AuthPayload<Data> = {
  platform: string;
  data: Data;
  refreshTill?: number;
  scope: { domain?: string; path: string };
};

export type AuthTokenPayload<Data> = TokenBase & AuthPayload<Data>;

export type StatePayload<State> = {
  platform: string;
  state: State;
};

export type StateTokenPayload<State> = TokenBase & StatePayload<State>;

export type ErrorMessage = { code: number; reason: string };

export type ErrorPayload = {
  platform: string;
  error: ErrorMessage;
  scope: { domain?: string; path: string };
};

export type ErrorTokenPayload = TokenBase & ErrorPayload;

export type AuthContextBase = {
  loginAt: Date;
  expireAt: Date;
};

export type AuthContext<
  User extends MachinatUser,
  Channel extends MachinatChannel
> = {
  platform: string;
  user: User;
  channel: Channel;
} & AuthContextBase;

export type AnyAuthContext = AuthContext<MachinatUser, MachinatChannel>;

export type ContextSupplement<Context extends AnyAuthContext> = Omit<
  Context,
  'platform' | 'loginAt' | 'expireAt'
>;

type ErrorResult = {
  success: false;
  code: number;
  reason: string;
};

export type VerifyResult<Data> = { success: true; data: Data } | ErrorResult;

export type ContextResult<Context extends AnyAuthContext> =
  | { success: true; contextSupplment: ContextSupplement<Context> }
  | ErrorResult;

export type IssueAuthOptions = {
  refreshTill?: number;
  signatureOnly?: boolean;
};

export type RedirectOptions = {
  assertInternal?: boolean;
};

export interface ResponseHelper {
  /** Get content of state cookie from request, return null if absent. */
  getState<State>(): Promise<null | State>;
  /** Issue state cookie to response, return the signed JWT string. */
  issueState<State>(state: State): Promise<string>;

  /** Get content of auth cookie from request, return null if absent. */
  getAuth<Data>(): Promise<null | Data>;
  /** Issue state cookie to response, return the signed token. */
  issueAuth<Data>(authData: Data, options?: IssueAuthOptions): Promise<string>;

  /** Get content of error cookie from request, return null if absent. */
  getError(): Promise<null | ErrorMessage>;
  /** Issue error cookie to response, return the signed JWT string. */
  issueError(code: number, message: string): Promise<string>;

  /**
   * Redirect resonse with 302 status. If a relative or empty URL is given, the
   * redirectUrl option of {@link AuthContoller} is taken as the base for
   * resolving the final target.
   */
  redirect(url?: string, options?: RedirectOptions): boolean;
}

export interface ServerAuthenticator<
  Credential,
  Data,
  Context extends AnyAuthContext
> {
  platform: string;

  /**
   * Handle requests required in the auth flow, for the most of time, it's used
   * for redirecting user-agent from/to other identity provider (IdP). Any
   * request match route "<auth_server_entry>/{platform}/*" would be delegated
   * to this method, and it's responsible to close the the server response.
   */
  delegateAuthRequest(
    req: IncomingMessage,
    res: ServerResponse,
    responseHelper: ResponseHelper,
    routingInfo: RoutingInfo
  ): Promise<void>;

  /**
   * Called when sign requests from client side are received, controller would
   * sign in the user by issuing a token to client and signing a signature
   * wihtin cookie if it resolve success.
   */
  verifyCredential(credential: Credential): Promise<VerifyResult<Data>>;

  /**
   * Called when refresh requests from client side are received, controller
   * would refresh token and signature if it resolve success.
   */
  verifyRefreshment(data: Data): Promise<VerifyResult<Data>>;

  /**
   * Called before the authorization finish, you can make some simple non-async
   * final checks. Return the auth context supplement if success.
   */
  checkAuthContext(data: Data): ContextResult<Context>;
}

export type AnyServerAuthenticator = ServerAuthenticator<
  unknown,
  unknown,
  AnyAuthContext
>;

export type AuthenticatorCredentialResult<Credential> =
  | { success: true; credential: Credential }
  | ErrorResult;

export interface ClientAuthenticator<
  Credential,
  Data,
  Context extends AnyAuthContext
> {
  platform: string;

  /**
   * Initiate necessary libary like IdP SDK to start authentication works, this
   * method is expected to be called before the view of app start rendering and
   * would only be called once.
   */
  init(
    authEntry: string,
    errorFromServer: null | AuthError,
    dataFromServer: null | Data
  ): Promise<void>;

  /**
   * Start work flow from client side and resolve the auth data which would be
   * then verified and signed at server side. If the auth flow reuqire
   * redirecting user-agent, just set the location and pend resolving.
   */
  fetchCredential(
    entry: string
  ): Promise<AuthenticatorCredentialResult<Credential>>;

  /**
   * Called before the authorization finish, you can make some simple non-async
   * final checks. Return the auth context supplement if success.
   */
  checkAuthContext(data: Data): ContextResult<Context>;
}

export type AnyClientAuthenticator = ClientAuthenticator<
  unknown,
  unknown,
  AnyAuthContext
>;

export type SignRequestBody<Credential> = {
  platform: string;
  credential: Credential;
};

export type RefreshRequestBody = {
  token: string;
};

export type VerifyRequestBody = {
  token: string;
};

export type AuthApiResponseBody = {
  platform: string;
  token: string;
};

export type AuthApiErrorBody = {
  platform: undefined | string;
  error: ErrorMessage;
};

export type AuthConfigs = {
  secret: string;
  redirectUrl: string;
  apiPath?: string;
  tokenAge?: number;
  authCookieAge?: number;
  dataCookieAge?: number;
  refreshPeriod?: number;
  cookieDomain?: string;
  cookiePath?: string;
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
};

export type WithHeaders = {
  headers: IncomingHttpHeaders;
};

export type ContextOfAuthenticator<
  Authenticator extends AnyServerAuthenticator | AnyClientAuthenticator
> = Authenticator extends ServerAuthenticator<unknown, unknown, infer Context>
  ? Context
  : Authenticator extends ClientAuthenticator<unknown, unknown, infer Context>
  ? Context
  : never;

type UserOfContext<Context extends AnyAuthContext> =
  Context extends AuthContext<infer User, any> ? User : never;

export type UserOfAuthenticator<
  Authenticator extends AnyServerAuthenticator | AnyClientAuthenticator
> = UserOfContext<ContextOfAuthenticator<Authenticator>>;
