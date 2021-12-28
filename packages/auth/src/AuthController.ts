import { parse as parseUrl } from 'url';
import { relative as getRelativePath, join as joinPath } from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { makeClassProvider } from '@machinat/core/service';
import { HttpRequestInfo, RoutingInfo } from '@machinat/http';
import invariant from 'invariant';
import {
  verify as verifyJwt,
  decode as decodeJwt,
  VerifyOptions as JWTVerifyOptions,
} from 'jsonwebtoken';
import getRawBody from 'raw-body';
import thenifiedly from 'thenifiedly';
import { SIGNATURE_COOKIE_KEY } from './constant';
import { AuthenticatorListI, ConfigsI } from './interface';
import AuthError from './error';
import type {
  AnyServerAuthenticator,
  AuthTokenPayload,
  SignRequestBody,
  RefreshRequestBody,
  VerifyRequestBody,
  AuthApiResponseBody,
  AuthApiErrorBody,
  AuthConfigs,
  ContextOfAuthenticator,
  WithHeaders,
} from './types';

import { getCookies, isSubpath, isSubdomain } from './utils';
import HttpAuthOperator from './HttpAuthOperator';

const getSignature = (req: WithHeaders) => {
  const cookies = getCookies(req);
  return cookies ? cookies[SIGNATURE_COOKIE_KEY] : undefined;
};

const parseBody = async (req: IncomingMessage): Promise<any> => {
  try {
    const rawBody = await getRawBody(req, { encoding: true });
    const body = JSON.parse(rawBody);

    return typeof body === 'object' ? body : null;
  } catch (err) {
    return null;
  }
};

const CONTENT_TYPE_JSON = { 'Content-Type': 'application/json' };

const respondApiOk = (res: ServerResponse, platform: string, token: string) => {
  res.writeHead(200, CONTENT_TYPE_JSON);
  const body: AuthApiResponseBody = { platform, token };
  res.end(JSON.stringify(body));
};

const respondApiError = (
  res: ServerResponse,
  platform: undefined | string,
  code: number,
  reason: string
) => {
  res.writeHead(code, CONTENT_TYPE_JSON);
  const body: AuthApiErrorBody = { platform, error: { code, reason } };
  res.end(JSON.stringify(body));
};

type AuthVerifyResult<Authenticator extends AnyServerAuthenticator> =
  | {
      success: true;
      token: string;
      context: ContextOfAuthenticator<Authenticator>;
    }
  | { success: false; token: void | string; code: number; reason: string };

/**
 * @category Provider
 */
export class AuthController<Authenticator extends AnyServerAuthenticator> {
  authenticators: Authenticator[];
  secret: string;
  apiPath: string;
  httpOperator: HttpAuthOperator;

  constructor(
    authenticators: Authenticator[],
    {
      secret,
      apiPath = '/',
      redirectUrl,
      authCookieAge = 180, // 3 min
      dataCookieAge = 180, // 3 min
      tokenAge = 3600, // 1 hr
      refreshPeriod = 864000, // 10 day
      cookieDomain,
      cookiePath = '/',
      sameSite = 'lax',
      secure = true,
    }: AuthConfigs = {} as AuthConfigs
  ) {
    invariant(
      authenticators && authenticators.length > 0,
      'options.authenticators must not be empty'
    );
    invariant(secret, 'options.secret must not be empty');
    invariant(redirectUrl, 'options.redirectUrl must not be empty');
    invariant(
      isSubpath(cookiePath, apiPath),
      'options.apiPath should be a subpath of options.cookiePath'
    );

    const {
      protocol,
      pathname: redirectPathname,
      hostname: redirectDomain,
    } = parseUrl(redirectUrl);

    invariant(
      !secure || !protocol || protocol === 'https:',
      'protocol of options.redirectUrl can only be https when options.secure set to true'
    );
    invariant(
      redirectPathname &&
        isSubpath(cookiePath, redirectPathname) &&
        (!cookieDomain ||
          !redirectDomain ||
          isSubdomain(cookieDomain, redirectDomain)),
      `options.redirectUrl should be under cookie scope "${
        cookieDomain ? `//${cookieDomain}` : ''
      }${cookiePath}"`
    );

    this.secret = secret;
    this.authenticators = authenticators;
    this.apiPath = apiPath;

    this.httpOperator = new HttpAuthOperator({
      apiPath,
      redirectUrl,
      secret,
      authCookieAge,
      dataCookieAge,
      tokenAge,
      refreshPeriod,
      cookieDomain,
      cookiePath,
      sameSite,
      secure,
    });
  }

  async delegateAuthRequest(
    req: IncomingMessage,
    res: ServerResponse,
    routingInfo?: RoutingInfo
  ): Promise<void> {
    const { pathname } = parseUrl(req.url as string);
    const subpath =
      routingInfo?.trailingPath ||
      getRelativePath(this.apiPath, pathname || '/');

    if (subpath === '' || subpath.slice(0, 2) === '..') {
      respondApiError(res, undefined, 403, 'path forbidden');
      return;
    }

    // inner auth api for client controller
    if (subpath[0] === '_') {
      if (req.method !== 'POST') {
        respondApiError(res, undefined, 405, 'method not allowed');
        return;
      }

      if (subpath === '_sign') {
        await this._handleSignRequest(req, res);
      } else if (subpath === '_refresh') {
        await this._handleRefreshRequest(req, res);
      } else if (subpath === '_verify') {
        await this._handleVerifyRequest(req, res);
      } else {
        respondApiError(
          res,
          undefined,
          404,
          `invalid auth api route "${subpath}"`
        );
      }
      return;
    }

    const [platform] = subpath.split('/');

    const authenticator = this._getAuthenticatorOf(platform);
    if (!authenticator) {
      respondApiError(res, undefined, 404, `platform "${platform}" not found`);
      return;
    }

    try {
      await authenticator.delegateAuthRequest(
        req,
        res,
        this.httpOperator.createResponseHelper(req, res, platform),
        {
          originalPath: pathname || '/',
          matchedPath: joinPath(
            routingInfo?.matchedPath || this.apiPath,
            platform
          ),

          trailingPath: getRelativePath(platform, subpath),
        }
      );
    } catch (err) {
      if (!res.writableEnded) {
        respondApiError(res, platform, err.code || 500, err.message);
      }
      return;
    }

    if (!res.writableEnded) {
      respondApiError(
        res,
        platform,
        501,
        'connection not closed by authenticator'
      );
    }
  }

  async verifyAuth(
    req: HttpRequestInfo,
    tokenProvided?: string
  ): Promise<AuthVerifyResult<Authenticator>> {
    let token = tokenProvided;
    if (!token) {
      const { authorization } = req.headers;
      if (!authorization) {
        return {
          success: false,
          token: undefined,
          code: 401,
          reason: 'no Authorization header',
        };
      }

      const [scheme, tokenFromHeader] = authorization.split(/\s+/, 2);
      if (scheme !== 'Bearer' || !tokenFromHeader) {
        return {
          success: false,
          token: undefined,
          code: 400,
          reason: 'invalid auth scheme',
        };
      }
      token = tokenFromHeader;
    }

    const signature = getSignature(req);
    if (!signature) {
      return {
        success: false,
        token,
        code: 401,
        reason: 'require signature',
      };
    }

    const [err, payload] = await this._verifyToken(token, signature);
    if (err) {
      const { code, message } = err;
      return {
        success: false,
        token,
        code,
        reason: message,
      };
    }

    const { platform, data, exp, iat } = payload;

    const authenticator = this._getAuthenticatorOf(platform);
    if (!authenticator) {
      return {
        success: false,
        token,
        code: 404,
        reason: `unknown platform "${platform}"`,
      };
    }

    const ctxResult = authenticator.checkAuthContext(data);
    if (!ctxResult.success) {
      return {
        success: false,
        token,
        code: 400,
        reason: 'invalid auth data',
      };
    }

    const authData = {
      ...ctxResult.contextSupplment,
      platform,
      loginAt: new Date(iat * 1000),
      expireAt: new Date(exp * 1000),
    };

    return {
      success: true,
      token,
      context: authData as ContextOfAuthenticator<Authenticator>,
    };
  }

  private async _handleSignRequest(req: IncomingMessage, res: ServerResponse) {
    try {
      const body = await parseBody(req);
      if (!body) {
        respondApiError(res, undefined, 400, 'invalid body format');
        return;
      }

      const { platform, credential } = body as SignRequestBody<unknown>;
      if (!platform || !credential) {
        respondApiError(res, platform, 400, 'invalid sign params');
        return;
      }

      const authenticator = this._getAuthenticatorOf(platform);
      if (!authenticator) {
        respondApiError(res, platform, 404, `unknown platform "${platform}"`);
        return;
      }

      const verifyResult = await authenticator.verifyCredential(credential);
      if (!verifyResult.success) {
        const { code, reason } = verifyResult;
        respondApiError(res, platform, code, reason);
        return;
      }

      const token = await this.httpOperator.issueAuth(
        res,
        platform,
        verifyResult.data,
        { signatureOnly: true }
      );

      respondApiOk(res, platform, token);
    } catch (err) {
      respondApiError(res, undefined, 500, err.message);
    }
  }

  private async _handleRefreshRequest(
    req: IncomingMessage,
    res: ServerResponse
  ) {
    // get signature from cookie
    const signature = getSignature(req);
    if (!signature) {
      respondApiError(res, undefined, 401, 'no signature found');
      return;
    }

    try {
      // verify token in body but ignore expiration
      const body = await parseBody(req);
      if (!body) {
        respondApiError(res, undefined, 400, 'invalid body format');
        return;
      }

      const { token } = body as RefreshRequestBody;
      if (!token) {
        respondApiError(res, undefined, 400, 'empty token received');
        return;
      }

      const [err, payload] = await this._verifyToken(token, signature, {
        ignoreExpiration: true,
      });
      if (err) {
        const { platform, code, message } = err;
        respondApiError(res, platform, code, message);
        return;
      }

      const { refreshTill, platform, data } = payload;
      if (!refreshTill) {
        respondApiError(res, platform, 400, 'token not refreshable');
        return;
      }

      if (refreshTill * 1000 >= Date.now()) {
        // refresh signature and issue new token
        const authenticator = this._getAuthenticatorOf(platform);
        if (!authenticator) {
          respondApiError(res, platform, 404, `unknown platform "${platform}"`);
          return;
        }

        const refreshResult = await authenticator.verifyRefreshment(data);
        if (!refreshResult.success) {
          const { code, reason } = refreshResult;
          respondApiError(res, platform, code, reason);
          return;
        }

        const newToken = await this.httpOperator.issueAuth(
          res,
          platform,
          refreshResult.data,
          { refreshTill, signatureOnly: true }
        );
        respondApiOk(res, platform, newToken);
      } else {
        respondApiError(res, platform, 401, 'refreshment period expired');
      }
    } catch (err) {
      respondApiError(res, undefined, 500, err.message);
    }
  }

  private async _handleVerifyRequest(
    req: IncomingMessage,
    res: ServerResponse
  ) {
    // get signature from cookie
    const signature = getSignature(req);
    if (!signature) {
      respondApiError(res, undefined, 401, 'no signature found');
      return;
    }

    try {
      // verify token in body
      const body = await parseBody(req);
      if (!body) {
        respondApiError(res, undefined, 400, 'invalid body format');
        return;
      }

      const { token } = body as VerifyRequestBody;
      if (!token) {
        respondApiError(res, undefined, 400, 'empty token received');
        return;
      }

      const [err, payload] = await this._verifyToken(token, signature);
      if (err) {
        const { platform, code, message } = err;
        respondApiError(res, platform, code, message);
        return;
      }

      const { platform } = payload;
      const authenticator = this._getAuthenticatorOf(platform);
      if (!authenticator) {
        respondApiError(res, platform, 404, `unknown platform "${platform}"`);
        return;
      }

      respondApiOk(res, platform, token);
    } catch (err) {
      respondApiError(res, undefined, 500, err.message);
    }
  }

  private async _verifyToken(
    token: string,
    signature: string,
    jwtVerifyOptions?: JWTVerifyOptions
  ): Promise<[null | AuthError, AuthTokenPayload<unknown>]> {
    try {
      const payload: AuthTokenPayload<unknown> = await thenifiedly.call(
        verifyJwt,
        `${token}.${signature}`,
        this.secret,
        jwtVerifyOptions
      );

      return [null, payload];
    } catch (err) {
      const code =
        err.name === 'TokenExpiredError' || err.name === 'NotBeforeError'
          ? 401
          : 400;

      const payload = decodeJwt(`${token}.`);
      return [
        new AuthError(
          typeof payload === 'string' ? undefined : payload?.platform,
          code,
          err.message
        ),
        null as never,
      ];
    }
  }

  private _getAuthenticatorOf(platform: string): null | Authenticator {
    for (const authenticator of this.authenticators) {
      if (platform === authenticator.platform) {
        return authenticator;
      }
    }
    return null;
  }
}

const ControllerP = makeClassProvider({
  lifetime: 'singleton',
  deps: [AuthenticatorListI, ConfigsI] as const,
})(AuthController);

type ControllerP<Authenticator extends AnyServerAuthenticator> =
  AuthController<Authenticator>;

export default ControllerP;
