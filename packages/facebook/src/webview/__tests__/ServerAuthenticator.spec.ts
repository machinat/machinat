import moxy from '@moxyjs/moxy';
import BasicAuthenticator, {
  AuthDelegatorOptions,
} from '@sociably/auth/basicAuth';
import { MetaApiError } from '@sociably/meta-api';
import FacebookBot from '../../Bot.js';
import FacebookProfiler from '../../Profiler.js';
import FacebookPage from '../../Page.js';
import FacebookUser from '../../User.js';
import FacebookChat from '../../Chat.js';
import UserProfile from '../../UserProfile.js';
import ServerAuthenticator from '../ServerAuthenticator.js';
import { FacebookAuthCredential, FacebookAuthData } from '../types.js';
import { FacebookThread } from '../../types.js';

const bot = moxy<FacebookBot>({
  pageId: '12345',
} as never);

const profileData = {
  id: '67890',
  name: 'Jphn Doe',
  first_name: 'John',
  last_name: 'Doe',
  profile_pic: 'https://...',
};
const profiler = moxy<FacebookProfiler>({
  getUserProfile: async () => new UserProfile(profileData),
} as never);

const requestDelegator = moxy(async () => {});
const loginUrl = `https://sociably.io/foo/auth/facebook?login=__LOGIN_TOKEN__`;

const basicAuthenticator = moxy<BasicAuthenticator>({
  getAuthUrl() {
    return loginUrl;
  },
  createRequestDelegator() {
    return requestDelegator;
  },
} as never);

const pageSettings = { pageId: '12345', accessToken: '_ACCESS_TOKEN_' };
const agentSettingsAccessor = moxy({
  getAgentSettings: async () => pageSettings,
  getAgentSettingsBatch: async () => [pageSettings],
});

beforeEach(() => {
  profiler.mock.reset();
  requestDelegator.mock.reset();
  basicAuthenticator.mock.reset();
  agentSettingsAccessor.mock.reset();
});

describe('.delegateAuthRequest(req, res, routing)', () => {
  const req = moxy();
  const res = moxy();
  const routing = {
    originalPath: '/auth/facebook/login',
    basePath: '/',
    matchedPath: 'auth/facebook',
    trailingPath: 'login',
  };

  let authenticator: ServerAuthenticator;
  let delegatorOptions: AuthDelegatorOptions<
    FacebookAuthCredential,
    FacebookAuthData,
    FacebookThread
  >;
  beforeEach(() => {
    authenticator = new ServerAuthenticator(
      bot,
      profiler,
      basicAuthenticator,
      agentSettingsAccessor,
    );
    delegatorOptions =
      basicAuthenticator.createRequestDelegator.mock.calls[0].args[0];
  });

  test('delegation options', async () => {
    await expect(
      authenticator.delegateAuthRequest(req, res, routing),
    ).resolves.toBe(undefined);

    expect(requestDelegator).toHaveReturnedTimes(1);
    expect(requestDelegator).toHaveBeenCalledWith(req, res, routing);

    expect(basicAuthenticator.createRequestDelegator).toHaveReturnedTimes(1);

    expect(delegatorOptions).toMatchInlineSnapshot(`
      {
        "bot": {
          "pageId": "12345",
        },
        "checkAuthData": [Function],
        "checkCurrentAuthUsability": [Function],
        "platform": "facebook",
        "platformColor": "#4B69FF",
        "platformImageUrl": "https://sociably.js.org/img/icon/messenger.png",
        "platformName": "Facebook",
        "verifyCredential": [Function],
      }
    `);

    expect(
      delegatorOptions.checkAuthData({
        page: '12345',
        user: '67890',
        profile: profileData,
      }),
    ).toEqual({
      ok: true,
      thread: new FacebookChat('12345', { id: '67890' }),
      data: { page: '12345', user: '67890', profile: profileData },
      chatLinkUrl: 'https://m.me/12345',
    });
  });

  test('options.checkCurrentAuthUsability(credential, data)', () => {
    expect(
      delegatorOptions.checkCurrentAuthUsability(
        { page: '12345', user: '67890' },
        { page: '12345', user: '67890' },
      ),
    ).toEqual({ ok: true });
    expect(
      delegatorOptions.checkCurrentAuthUsability(
        { page: '11111', user: '67890' },
        { page: '12345', user: '67890' },
      ),
    ).toEqual({ ok: false });
    expect(
      delegatorOptions.checkCurrentAuthUsability(
        { page: '12345', user: '66666' },
        { page: '12345', user: '67890' },
      ),
    ).toEqual({ ok: false });
  });

  describe('options.verifyCredential', () => {
    it('return ok when verification passed', async () => {
      await expect(
        delegatorOptions.verifyCredential({ page: '12345', user: '67890' }),
      ).resolves.toEqual({
        ok: true,
        data: { page: '12345', user: '67890', profile: profileData },
      });

      expect(agentSettingsAccessor.getAgentSettings).toHaveBeenCalledTimes(1);
      expect(agentSettingsAccessor.getAgentSettings).toHaveBeenCalledWith(
        new FacebookPage('12345'),
      );

      expect(profiler.getUserProfile).toHaveBeenCalledTimes(1);
      expect(profiler.getUserProfile).toHaveBeenCalledWith(
        new FacebookPage('12345'),
        new FacebookUser('12345', '67890'),
      );
    });

    it('fail if fail to find page settings', async () => {
      agentSettingsAccessor.getAgentSettings.mock.fakeResolvedValue(null);
      await expect(
        delegatorOptions.verifyCredential({ page: '12345', user: '67890' }),
      ).resolves.toMatchInlineSnapshot(`
        {
          "code": 404,
          "ok": false,
          "reason": "Facebook page "12345" not registered",
        }
      `);
    });

    it('fail if fail to get user profile', async () => {
      profiler.getUserProfile.mock.fakeRejectedValue(
        new MetaApiError({
          error: { code: 404, message: 'user not found' } as never,
        }),
      );
      await expect(
        delegatorOptions.verifyCredential({ page: '12345', user: '67890' }),
      ).resolves.toMatchInlineSnapshot(`
        {
          "code": 404,
          "ok": false,
          "reason": "user "67890" not found or not authorized",
        }
      `);
    });
  });
});

test('.getAuthUrl(id, path)', () => {
  const user = new FacebookUser('12345', '67890');

  const authenticator = new ServerAuthenticator(
    bot,
    profiler,
    basicAuthenticator,
    agentSettingsAccessor,
  );
  expect(authenticator.getAuthUrl(user)).toBe(loginUrl);
  expect(authenticator.getAuthUrl(user, { redirectUrl: '/foo?bar=baz' })).toBe(
    loginUrl,
  );
  expect(
    authenticator.getAuthUrl(user, {
      redirectUrl: '/foo',
      webviewParams: { bar: 'baz' },
    }),
  ).toBe(`${loginUrl}&webviewParams=${encodeURIComponent('{"bar":"baz"}')}`);

  expect(basicAuthenticator.getAuthUrl).toHaveBeenCalledTimes(3);
  expect(basicAuthenticator.getAuthUrl).toHaveBeenNthCalledWith(
    1,
    'facebook',
    { page: '12345', user: '67890' },
    undefined,
  );
  expect(basicAuthenticator.getAuthUrl).toHaveBeenNthCalledWith(
    2,
    'facebook',
    { page: '12345', user: '67890' },
    '/foo?bar=baz',
  );
  expect(basicAuthenticator.getAuthUrl).toHaveBeenNthCalledWith(
    3,
    'facebook',
    { page: '12345', user: '67890' },
    '/foo',
  );
});

test('.verifyCredential() fails anyway', async () => {
  const authenticator = new ServerAuthenticator(
    bot,
    profiler,
    basicAuthenticator,
    agentSettingsAccessor,
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
    agentSettingsAccessor,
  );

  test('returns ok when verification passed', async () => {
    await expect(
      authenticator.verifyRefreshment({ page: '12345', user: '67890' }),
    ).resolves.toEqual({
      ok: true,
      data: { page: '12345', user: '67890', profile: profileData },
    });

    expect(agentSettingsAccessor.getAgentSettings).toHaveBeenCalledTimes(1);
    expect(agentSettingsAccessor.getAgentSettings).toHaveBeenCalledWith(
      new FacebookPage('12345'),
    );

    expect(profiler.getUserProfile).toHaveBeenCalledTimes(1);
    expect(profiler.getUserProfile).toHaveBeenCalledWith(
      new FacebookPage('12345'),
      new FacebookUser('12345', '67890'),
    );
  });

  it('fails if page not found', async () => {
    agentSettingsAccessor.getAgentSettings.mock.fakeResolvedValue(null);
    await expect(
      authenticator.verifyRefreshment({ page: '54321', user: '67890' }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "code": 404,
        "ok": false,
        "reason": "Facebook page "54321" not registered",
      }
    `);
  });
});

test('.checkAuthData(data)', () => {
  const authenticator = new ServerAuthenticator(
    bot,
    profiler,
    basicAuthenticator,
    agentSettingsAccessor,
  );

  expect(
    authenticator.checkAuthData({
      page: '12345',
      user: '67890',
      profile: profileData,
    }),
  ).toEqual({
    ok: true,
    contextDetails: {
      pageId: '12345',
      channel: new FacebookPage('12345'),
      thread: new FacebookChat('12345', { id: '67890' }),
      user: new FacebookUser('12345', '67890'),
      userProfile: new UserProfile(profileData),
    },
  });

  expect(authenticator.checkAuthData({ page: '98765', user: '43210' })).toEqual(
    {
      ok: true,
      contextDetails: {
        pageId: '98765',
        channel: new FacebookPage('98765'),
        thread: new FacebookChat('98765', { id: '43210' }),
        user: new FacebookUser('98765', '43210'),
        userProfile: null,
      },
    },
  );
});
