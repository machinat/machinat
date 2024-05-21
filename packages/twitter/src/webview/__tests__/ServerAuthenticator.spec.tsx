import moxy from '@moxyjs/moxy';
import BasicAuthenticator from '@sociably/auth/basicAuth';
import TwitterUser from '../../User.js';
import TwitterChat from '../../Chat.js';
import TwitterBot from '../../Bot.js';
import TwitterProfiler from '../../Profiler.js';
import UserProfile from '../../UserProfile.js';
import TwitterApiError from '../../Error.js';
import ServerAuthenticator from '../ServerAuthenticator.js';
import { RawUser } from '../../types.js';

const bot = moxy<TwitterBot>({
  requestApi() {},
} as never);

const rawUserData = {
  id: 9876543210,
  id_str: '9876543210',
  name: 'John Doe',
  screen_name: 'johndoe',
} as RawUser;

const profiler = moxy<TwitterProfiler>({
  getUserProfile: async () => new UserProfile(rawUserData),
} as never);

const requestDelegator = moxy(async () => {});
const loginUrl = `https://sociably.io/MyApp/auth/twitter?login=__LOGIN_TOKEN__`;

const basicAuthenticator = moxy<BasicAuthenticator>({
  getAuthUrl() {
    return loginUrl;
  },
  createRequestDelegator() {
    return requestDelegator;
  },
} as never);

beforeEach(() => {
  profiler.mock.reset();
  requestDelegator.mock.reset();
  basicAuthenticator.mock.reset();
});

describe('.delegateAuthRequest(req, res, routing)', () => {
  test('pass to handler created by BasicAuthenticator', async () => {
    const authenticator = new ServerAuthenticator(
      bot,
      profiler,
      basicAuthenticator,
    );
    const req = moxy();
    const res = moxy();
    const routing = {
      originalPath: '/auth/twitter/login',
      matchedPath: '/auth/twitter',
      trailingPath: 'login',
      basePath: '/',
    };

    await expect(
      authenticator.delegateAuthRequest(req, res, routing),
    ).resolves.toBe(undefined);

    expect(requestDelegator).toHaveReturnedTimes(1);
    expect(requestDelegator).toHaveBeenCalledWith(req, res, routing);
  });

  test('BasicAuthenticator.createRequestDelegator() options', async () => {
    (() => new ServerAuthenticator(bot, profiler, basicAuthenticator))();

    expect(basicAuthenticator.createRequestDelegator).toHaveReturnedTimes(1);

    const delegatorOptions =
      basicAuthenticator.createRequestDelegator.mock.calls[0].args[0];
    expect(delegatorOptions).toMatchInlineSnapshot(`
      {
        "bot": {
          "requestApi": [MockFunction moxy(requestApi)],
        },
        "checkAuthData": [Function],
        "checkCurrentAuthUsability": [Function],
        "platform": "twitter",
        "platformColor": "#1D9BF0",
        "platformImageUrl": "https://sociably.js.org/img/icon/twitter.png",
        "platformName": "Twitter",
        "verifyCredential": [Function],
      }
    `);

    expect(
      delegatorOptions.checkAuthData({
        agent: '1234567890',
        user: { id: '9876543210', data: rawUserData },
      }),
    ).toEqual({
      ok: true,
      thread: new TwitterChat('1234567890', '9876543210'),
      data: {
        agent: '1234567890',
        user: { id: '9876543210', data: rawUserData },
      },
      chatLinkUrl:
        'https://twitter.com/messages/compose?recipient_id=1234567890',
    });
  });

  test('option.checkCurrentAuthUsability() check if auth is still valid', () => {
    (() => new ServerAuthenticator(bot, profiler, basicAuthenticator))();

    const { checkCurrentAuthUsability } =
      basicAuthenticator.createRequestDelegator.mock.calls[0].args[0];

    expect(
      checkCurrentAuthUsability(
        { agent: '1234567890', user: '9876543210' },
        { agent: '1234567890', user: { id: '9876543210', data: rawUserData } },
      ),
    ).toEqual({ ok: true });
    expect(
      checkCurrentAuthUsability(
        { agent: '1111111111', user: '9876543210' },
        { agent: '1234567890', user: { id: '9876543210', data: rawUserData } },
      ),
    ).toEqual({ ok: false });
    expect(
      checkCurrentAuthUsability(
        { agent: '1234567890', user: '9999999999' },
        { agent: '1234567890', user: { id: '9876543210', data: rawUserData } },
      ),
    ).toEqual({ ok: false });
  });

  test('options.verifyCredential() verify user by profiler.getUserProfiler()', async () => {
    (() => new ServerAuthenticator(bot, profiler, basicAuthenticator))();

    const { verifyCredential } =
      basicAuthenticator.createRequestDelegator.mock.calls[0].args[0];

    await expect(
      verifyCredential({
        agent: '1234567890',
        user: '9876543210',
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        agent: '1234567890',
        user: { id: '9876543210', data: rawUserData },
      },
    });

    expect(profiler.getUserProfile).toHaveBeenCalledTimes(1);
    expect(profiler.getUserProfile).toHaveBeenCalledWith(
      new TwitterUser('1234567890'),
      new TwitterUser('9876543210'),
    );

    profiler.getUserProfile.mock.fakeRejectedValue(
      new TwitterApiError(418, { detail: "I'm a teapot" } as never),
    );

    await expect(
      verifyCredential({
        agent: '1234567890',
        user: '9876543210',
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "code": 418,
        "ok": false,
        "reason": "I'm a teapot",
      }
    `);
  });
});

test('.getAuthUrl(id, path)', () => {
  const authenticator = new ServerAuthenticator(
    bot,
    profiler,
    basicAuthenticator,
  );
  expect(authenticator.getAuthUrl('1234567890', '9876543210')).toBe(loginUrl);
  expect(
    authenticator.getAuthUrl('1234567890', '9876543210', {
      redirectUrl: '/foo?bar=baz',
    }),
  ).toBe(loginUrl);
  expect(
    authenticator.getAuthUrl('1234567890', '9876543210', {
      redirectUrl: '/foo',
      webviewParams: { bar: 'baz' },
    }),
  ).toBe(`${loginUrl}&webviewParams=${encodeURIComponent('{"bar":"baz"}')}`);

  expect(basicAuthenticator.getAuthUrl).toHaveBeenCalledTimes(3);
  expect(basicAuthenticator.getAuthUrl).toHaveBeenNthCalledWith(
    1,
    'twitter',
    { agent: '1234567890', user: '9876543210' },
    undefined,
  );
  expect(basicAuthenticator.getAuthUrl).toHaveBeenNthCalledWith(
    2,
    'twitter',
    { agent: '1234567890', user: '9876543210' },
    '/foo?bar=baz',
  );
  expect(basicAuthenticator.getAuthUrl).toHaveBeenNthCalledWith(
    3,
    'twitter',
    { agent: '1234567890', user: '9876543210' },
    '/foo',
  );
});

test('.verifyCredential() fails anyway', async () => {
  const authenticator = new ServerAuthenticator(
    bot,
    profiler,
    basicAuthenticator,
  );
  await expect(authenticator.verifyCredential()).resolves
    .toMatchInlineSnapshot(`
    {
      "code": 403,
      "ok": false,
      "reason": "should use backend based flow only",
    }
  `);
});

describe('.verifyRefreshment(data)', () => {
  const authenticator = new ServerAuthenticator(
    bot,
    profiler,
    basicAuthenticator,
  );

  test('verify auth through profiler.getUserProfiler() API', async () => {
    await expect(
      authenticator.verifyRefreshment({
        agent: '1234567890',
        user: { id: '9876543210', data: rawUserData },
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        agent: '1234567890',
        user: { id: '9876543210', data: rawUserData },
      },
    });

    expect(profiler.getUserProfile).toHaveBeenCalledTimes(1);
    expect(profiler.getUserProfile).toHaveBeenCalledWith(
      new TwitterUser('1234567890'),
      new TwitterUser('9876543210'),
    );
  });

  it('fails if profiler.getUserProfiler() throw', async () => {
    profiler.getUserProfile.mock.fakeRejectedValue(
      new TwitterApiError(418, { detail: "I'm a teapot" } as never),
    );

    await expect(
      authenticator.verifyRefreshment({
        agent: '1234567890',
        user: { id: '9876543210', data: rawUserData },
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "code": 418,
        "ok": false,
        "reason": "I'm a teapot",
      }
    `);
  });
});

test('.checkAuthData(data)', () => {
  const authenticator = new ServerAuthenticator(
    bot,
    profiler,
    basicAuthenticator,
  );
  expect(
    authenticator.checkAuthData({
      agent: '1234567890',
      user: { id: '9876543210', data: rawUserData },
    }),
  ).toEqual({
    ok: true,
    contextDetails: {
      agentId: '1234567890',
      channel: new TwitterUser('1234567890'),
      thread: new TwitterChat('1234567890', '9876543210'),
      user: new TwitterUser('9876543210', rawUserData),
      userProfile: new UserProfile(rawUserData),
    },
  });
});
