import moxy from '@moxyjs/moxy';
import BasicAuthenticator, {
  AuthDelegatorOptions,
} from '@sociably/auth/basicAuth';
import { MetaApiError } from '@sociably/meta-api';
import InstagramBot from '../../Bot.js';
import InstagramProfiler from '../../Profiler.js';
import InstagramAgent from '../../Agent.js';
import InstagramUser from '../../User.js';
import InstagramChat from '../../Chat.js';
import UserProfile from '../../UserProfile.js';
import ServerAuthenticator from '../ServerAuthenticator.js';
import { InstagramAuthCredential, InstagramAuthData } from '../types.js';

const bot = moxy<InstagramBot>({ a: 'bot' } as never);

const profileData = {
  id: '43210',
  name: 'John Doe',
  username: 'john.doe.1234',
  profile_pic: 'https://...',
  is_verified_user: false,
  follower_count: 123,
  is_user_follow_business: true,
  is_business_follow_user: false,
};
const profiler = moxy<InstagramProfiler>({
  getUserProfile: async () => new UserProfile(profileData),
} as never);

const requestDelegator = moxy(async () => {});
const loginUrl = `https://sociably.io/foo/auth/instagram?login=__LOGIN_TOKEN__`;

const basicAuthenticator = moxy<BasicAuthenticator>({
  getAuthUrl() {
    return loginUrl;
  },
  createRequestDelegator() {
    return requestDelegator;
  },
} as never);

const accountId = '1234567890';
const pageId = '1111111111';
const accessToken = '_ACCESS_TOKEN_';
const agentUsername = 'jojodoe123';

const agentSettings = {
  accountId,
  pageId,
  accessToken,
  username: agentUsername,
};
const agentSettingsAccessor = moxy({
  getAgentSettings: async () => agentSettings,
  getAgentSettingsBatch: async () => [agentSettings],
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
    originalPath: '/auth/instagram/login',
    basePath: '/',
    matchedPath: 'auth/instagram',
    trailingPath: 'login',
  };

  let authenticator: ServerAuthenticator;
  let delegatorOptions: AuthDelegatorOptions<
    InstagramAuthCredential,
    InstagramAuthData,
    InstagramChat
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
          "a": "bot",
        },
        "checkAuthData": [Function],
        "checkCurrentAuthUsability": [Function],
        "platform": "instagram",
        "platformColor": "#4B69FF",
        "platformImageUrl": "https://sociably.js.org/img/icon/messenger.png",
        "platformName": "Instagram",
        "verifyCredential": [Function],
      }
    `);

    expect(
      delegatorOptions.checkAuthData({
        agent: { id: '1234567890', name: 'jojodoe123' },
        user: '9876543210',
        profile: profileData,
      }),
    ).toEqual({
      ok: true,
      thread: new InstagramChat('1234567890', { id: '9876543210' }),
      data: {
        agent: { id: '1234567890', name: 'jojodoe123' },
        user: '9876543210',
        profile: profileData,
      },
      chatLinkUrl: `https://ig.me/m/${'jojodoe123'}`,
    });
  });

  test('options.checkCurrentAuthUsability(credential, data)', () => {
    expect(
      delegatorOptions.checkCurrentAuthUsability(
        { agent: { id: '1234567890', name: 'jojodoe123' }, user: '67890' },
        { agent: { id: '1234567890', name: 'jojodoe123' }, user: '67890' },
      ),
    ).toEqual({ ok: true });
    expect(
      delegatorOptions.checkCurrentAuthUsability(
        { agent: { id: '1111111111', name: 'janedoe555' }, user: '67890' },
        { agent: { id: '1234567890', name: 'jojodoe123' }, user: '67890' },
      ),
    ).toEqual({ ok: false });
    expect(
      delegatorOptions.checkCurrentAuthUsability(
        { agent: { id: '1234567890', name: 'jojodoe123' }, user: '66666' },
        { agent: { id: '1234567890', name: 'jojodoe123' }, user: '67890' },
      ),
    ).toEqual({ ok: false });
  });

  describe('options.verifyCredential', () => {
    it('return ok when verification passed', async () => {
      await expect(
        delegatorOptions.verifyCredential({
          agent: { id: '1234567890', name: 'jojodoe123' },
          user: '9876543210',
        }),
      ).resolves.toEqual({
        ok: true,
        data: {
          agent: { id: '1234567890', name: 'jojodoe123' },
          user: '9876543210',
          profile: profileData,
        },
      });

      expect(agentSettingsAccessor.getAgentSettings).toHaveBeenCalledTimes(1);
      expect(agentSettingsAccessor.getAgentSettings).toHaveBeenCalledWith(
        new InstagramAgent('1234567890'),
      );

      expect(profiler.getUserProfile).toHaveBeenCalledTimes(1);
      expect(profiler.getUserProfile).toHaveBeenCalledWith(
        '1234567890',
        '9876543210',
      );
    });

    it('fail if fail to find agent settings', async () => {
      agentSettingsAccessor.getAgentSettings.mock.fakeResolvedValue(null);
      await expect(
        delegatorOptions.verifyCredential({
          agent: { id: '1234567890', name: 'jojodoe123' },
          user: '9876543210',
        }),
      ).resolves.toMatchInlineSnapshot(`
        {
          "code": 404,
          "ok": false,
          "reason": "instagram agent account "1234567890" not registered",
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
        delegatorOptions.verifyCredential({
          agent: { id: '1234567890', name: 'jojodoe123' },
          user: '0000000000',
        }),
      ).resolves.toMatchInlineSnapshot(`
        {
          "code": 404,
          "ok": false,
          "reason": "user "0000000000" not found or not authorized",
        }
      `);
    });
  });
});

test('.getAuthUrl(id, path)', async () => {
  const user = new InstagramUser('1234567890', '9876543210');

  const authenticator = new ServerAuthenticator(
    bot,
    profiler,
    basicAuthenticator,
    agentSettingsAccessor,
  );
  await expect(authenticator.getAuthUrl(user)).resolves.toBe(loginUrl);
  await expect(
    authenticator.getAuthUrl(user, { redirectUrl: '/foo?bar=baz' }),
  ).resolves.toBe(loginUrl);
  await expect(
    authenticator.getAuthUrl(user, {
      redirectUrl: '/foo',
      webviewParams: { bar: 'baz' },
    }),
  ).resolves.toBe(
    `${loginUrl}&webviewParams=${encodeURIComponent('{"bar":"baz"}')}`,
  );

  expect(basicAuthenticator.getAuthUrl).toHaveBeenCalledTimes(3);
  expect(basicAuthenticator.getAuthUrl).toHaveBeenNthCalledWith(
    1,
    'instagram',
    { agent: { id: '1234567890', name: 'jojodoe123' }, user: '9876543210' },
    undefined,
  );
  expect(basicAuthenticator.getAuthUrl).toHaveBeenNthCalledWith(
    2,
    'instagram',
    { agent: { id: '1234567890', name: 'jojodoe123' }, user: '9876543210' },
    '/foo?bar=baz',
  );
  expect(basicAuthenticator.getAuthUrl).toHaveBeenNthCalledWith(
    3,
    'instagram',
    { agent: { id: '1234567890', name: 'jojodoe123' }, user: '9876543210' },
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
      authenticator.verifyRefreshment({
        agent: { id: '1234567890', name: 'jojodoe123' },
        user: '9876543210',
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        agent: { id: '1234567890', name: 'jojodoe123' },
        user: '9876543210',
        profile: profileData,
      },
    });

    expect(agentSettingsAccessor.getAgentSettings).toHaveBeenCalledTimes(1);
    expect(agentSettingsAccessor.getAgentSettings).toHaveBeenCalledWith(
      new InstagramAgent('1234567890'),
    );

    expect(profiler.getUserProfile).toHaveBeenCalledTimes(1);
    expect(profiler.getUserProfile).toHaveBeenCalledWith(
      '1234567890',
      '9876543210',
    );
  });

  it('fails if agent not found', async () => {
    agentSettingsAccessor.getAgentSettings.mock.fakeResolvedValue(null);
    await expect(
      authenticator.verifyRefreshment({
        agent: { id: '8888888888', name: 'foooo' },
        user: '67890',
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "code": 404,
        "ok": false,
        "reason": "instagram agent account "8888888888" not registered",
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
      agent: { id: '1234567890', name: 'jojodoe123' },
      user: '9876543210',
      profile: profileData,
    }),
  ).toEqual({
    ok: true,
    contextDetails: {
      agentUsername: 'jojodoe123',
      channel: new InstagramAgent('1234567890', 'jojodoe123'),
      thread: new InstagramChat('1234567890', { id: '9876543210' }),
      user: new InstagramUser('1234567890', '9876543210'),
      userProfile: new UserProfile(profileData),
    },
  });

  expect(
    authenticator.checkAuthData({
      agent: { id: '5555555555', name: 'jojodoe123' },
      user: '6666666666',
    }),
  ).toEqual({
    ok: true,
    contextDetails: {
      agentUsername: 'jojodoe123',
      channel: new InstagramAgent('5555555555', 'jojodoe123'),
      thread: new InstagramChat('5555555555', { id: '6666666666' }),
      user: new InstagramUser('5555555555', '6666666666'),
      userProfile: null,
    },
  });
});
