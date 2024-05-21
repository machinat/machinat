import { IncomingMessage, ServerResponse } from 'http';
import { AuthHttpOperator } from '@sociably/auth';
import moxy from '@moxyjs/moxy';
import type { LineBot } from '../../Bot.js';
import LineChannel from '../../Channel.js';
import LineChat from '../../Chat.js';
import LineUser from '../../User.js';
import LineApiError from '../../error.js';
import ServerAuthenticator from '../ServerAuthenticator.js';
import { LiffOs, RefChatType } from '../constant.js';

const providerId = '_PROVIDER_ID_';
const botChannelId = '_BOT_CHAN_ID_';
const loginChannelId = '_LOGIN_CHAN_ID_';
const userId = '_USER_ID_';
const groupId = '_GROUP_ID_';
const roomId = '_ROOM_ID_';
const accessToken = '_ACCESS_TOKEN_';
const minProfileData = {
  userId,
  displayName: 'Jojo',
  pictureUrl: 'https://profile.line-scdn.net/jojojojojo',
};
const botChannel = new LineChannel(botChannelId);

const bot = moxy<LineBot>({
  requestApi: async ({ url }) =>
    url === `oauth2/v2.1/verify?access_token=${accessToken}`
      ? { scope: 'profile', client_id: loginChannelId, expires_in: 2591659 }
      : url === 'v2/profile'
      ? { ...minProfileData, statusMessage: 'OlaOlaOla' }
      : url === `v2/bot/profile/${userId}`
      ? { ...minProfileData, statusMessage: 'OlaOlaOla', language: 'jp' }
      : url === `v2/bot/group/${groupId}/member/${userId}`
      ? minProfileData
      : url === `v2/bot/room/${roomId}/member/${userId}`
      ? minProfileData
      : {},
} as never);

const httpOperator = moxy<AuthHttpOperator>({
  getRedirectUrl: (path) =>
    `https://sociably.io/my_app/webview${path ? `/${path}` : ''}`,
} as never);

const agentSettings = {
  providerId,
  channelId: botChannelId,
  accessToken: '_ACCESS_TOKEN_',
  channelSecret: '_CHANNEL_SECRET_',
  botUserId: '_BOT_USER_ID_',
  liffApps: {
    default: `${loginChannelId}-_LIFF_1_`,
    compact: `${loginChannelId}-_LIFF_2_`,
  },
};

const loginChannelSettings = {
  providerId,
  channelId: loginChannelId,
  liffIds: [`${loginChannelId}-_LIFF_1_`],
  refChatChannelIds: [botChannelId],
};

const agentSettingsAccessor = moxy({
  getAgentSettings: async () => agentSettings,
  getAgentSettingsBatch: async () => [agentSettings],
  getLineChatChannelSettingsByBotUserId: async () => null,
  getLineLoginChannelSettings: async () => loginChannelSettings,
});

beforeEach(() => {
  agentSettingsAccessor.mock.reset();
  bot.mock.reset();
  httpOperator.mock.reset();
});

describe('.constructor(options)', () => {
  it('ok', () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);
    expect(authenticator.platform).toBe('line');
  });
});

describe('.getLiffUrl(channel, path, chat)', () => {
  test('return LIFF URL', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);
    await expect(
      authenticator.getLiffUrl(botChannel),
    ).resolves.toMatchInlineSnapshot(
      `"https://liff.line.me/_LOGIN_CHAN_ID_-_LIFF_1_?chatChannelId=_BOT_CHAN_ID_&liffId=_LOGIN_CHAN_ID_-_LIFF_1_"`,
    );
    await expect(
      authenticator.getLiffUrl(botChannel, { liffAppChoice: 'compact' }),
    ).resolves.toMatchInlineSnapshot(
      `"https://liff.line.me/_LOGIN_CHAN_ID_-_LIFF_2_?chatChannelId=_BOT_CHAN_ID_&liffId=_LOGIN_CHAN_ID_-_LIFF_2_"`,
    );
    await expect(
      authenticator.getLiffUrl(botChannel, { path: '/foo' }),
    ).resolves.toMatchInlineSnapshot(
      `"https://liff.line.me/_LOGIN_CHAN_ID_-_LIFF_1_/foo?chatChannelId=_BOT_CHAN_ID_&liffId=_LOGIN_CHAN_ID_-_LIFF_1_"`,
    );
    await expect(
      authenticator.getLiffUrl(botChannel, { path: 'foo?bar=baz' }),
    ).resolves.toMatchInlineSnapshot(
      `"https://liff.line.me/_LOGIN_CHAN_ID_-_LIFF_1_/foo?bar=baz&chatChannelId=_BOT_CHAN_ID_&liffId=_LOGIN_CHAN_ID_-_LIFF_1_"`,
    );
    await expect(
      authenticator.getLiffUrl(botChannel, {
        path: 'foo?bar=baz',
        chat: new LineChat('_BOT_CHAN_ID_', 'user', '_USER_ID_'),
      }),
    ).resolves.toMatchInlineSnapshot(
      `"https://liff.line.me/_LOGIN_CHAN_ID_-_LIFF_1_/foo?bar=baz&chatChannelId=_BOT_CHAN_ID_&liffId=_LOGIN_CHAN_ID_-_LIFF_1_"`,
    );
    await expect(
      authenticator.getLiffUrl(botChannel, {
        path: 'foo?bar=baz',
        chat: new LineChat('_BOT_CHAN_ID_', 'group', '_GROUP_ID_'),
      }),
    ).resolves.toMatchInlineSnapshot(
      `"https://liff.line.me/_LOGIN_CHAN_ID_-_LIFF_1_/foo?bar=baz&chatChannelId=_BOT_CHAN_ID_&liffId=_LOGIN_CHAN_ID_-_LIFF_1_&groupId=_GROUP_ID_"`,
    );
    await expect(
      authenticator.getLiffUrl(botChannel, {
        path: 'foo?bar=baz',
        chat: new LineChat('_BOT_CHAN_ID_', 'room', '_ROOM_ID_'),
        liffAppChoice: 'compact',
        webviewParams: { hello: 'world' },
      }),
    ).resolves.toMatchInlineSnapshot(
      `"https://liff.line.me/_LOGIN_CHAN_ID_-_LIFF_2_/foo?bar=baz&chatChannelId=_BOT_CHAN_ID_&liffId=_LOGIN_CHAN_ID_-_LIFF_2_&roomId=_ROOM_ID_&webviewParams=%7B%22hello%22%3A%22world%22%7D"`,
    );
  });

  it('throw if messaging channel settings not found', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    agentSettingsAccessor.getAgentSettings.mock.fakeResolvedValue(null);
    await expect(
      authenticator.getLiffUrl(botChannel),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"liff setting for messaging channel "_BOT_CHAN_ID_" not found"`,
    );

    agentSettingsAccessor.getAgentSettings.mock.fakeResolvedValue({
      providerId: '_PROVIDER_ID_',
      channelId: '_CHANNEL_ID_',
      accessToken: '_ACCESS_TOKEN_',
      channelSecret: '_CHANNEL_SECRET_',
      // no liff
    });
    await expect(
      authenticator.getLiffUrl(botChannel),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"liff setting for messaging channel "_BOT_CHAN_ID_" not found"`,
    );
  });
});

test('.delegateAuthRequest() respond 403', async () => {
  const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);
  const req = {
    url: '/my_app/auth/line',
    type: 'GET',
    headers: {},
  } as unknown as IncomingMessage;

  const res = moxy(new ServerResponse({} as never));

  await expect(authenticator.delegateAuthRequest(req, res)).resolves.toBe(
    undefined,
  );

  expect(res.statusCode).toBe(403);
  expect(res.end).toHaveBeenCalled();
});

describe('.verifyCredential(credential)', () => {
  const credential = {
    accessToken,
    contextType: 'external' as const,
    os: 'ios' as const,
    language: 'zh-TW',
    userId,
  };

  it('verify access token and user ID through LINE API', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    await expect(authenticator.verifyCredential(credential)).resolves.toEqual({
      ok: true,
      data: {
        provider: providerId,
        client: loginChannelId,
        ref: RefChatType.External,
        os: LiffOs.Ios,
        lang: 'zh-TW',
        user: userId,
      },
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(2);
    expect(bot.requestApi).toHaveBeenCalledWith({
      method: 'GET',
      url: `oauth2/v2.1/verify?access_token=${credential.accessToken}`,
    });
    expect(bot.requestApi).toHaveBeenCalledWith({
      accessToken: credential.accessToken,
      method: 'GET',
      url: `v2/profile`,
    });
  });

  it("verify user and messaging channel when it's available", async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    await expect(
      authenticator.verifyCredential({
        ...credential,
        chatChannelId: botChannelId,
        contextType: 'utou',
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        provider: providerId,
        chan: botChannelId,
        client: loginChannelId,
        ref: RefChatType.Utou,
        os: LiffOs.Ios,
        lang: 'zh-TW',
        user: userId,
      },
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(3);
    expect(bot.requestApi).toHaveBeenCalledWith({
      channel: botChannel,
      method: 'GET',
      url: `v2/bot/profile/${userId}`,
    });
  });

  it('use bound chat channel id if available', async () => {
    agentSettingsAccessor.getAgentSettings.mock.fakeResolvedValue({
      ...agentSettings,
      isLinkedWithLoginChannel: true,
    });
    agentSettingsAccessor.getLineLoginChannelSettings.mock.fakeResolvedValue({
      ...loginChannelSettings,
      linkedChatChannelId: botChannelId,
    });

    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    await expect(
      authenticator.verifyCredential({
        ...credential,
        contextType: 'utou',
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        provider: providerId,
        chan: botChannelId,
        client: loginChannelId,
        ref: RefChatType.Utou,
        os: LiffOs.Ios,
        lang: 'zh-TW',
        user: userId,
      },
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(2);
    expect(bot.requestApi).toHaveBeenCalledWith({
      accessToken: credential.accessToken,
      method: 'GET',
      url: `v2/profile`,
    });
  });

  it('verify group member', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    await expect(
      authenticator.verifyCredential({
        ...credential,
        chatChannelId: botChannelId,
        contextType: 'group',
        groupId,
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        provider: providerId,
        chan: botChannelId,
        group: groupId,
        client: loginChannelId,
        ref: RefChatType.Group,
        os: LiffOs.Ios,
        lang: 'zh-TW',
        user: userId,
      },
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(3);
    expect(bot.requestApi).toHaveBeenCalledWith({
      channel: botChannel,
      method: 'GET',
      url: `v2/bot/group/${groupId}/member/${userId}`,
    });
  });

  it('verify room member', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    await expect(
      authenticator.verifyCredential({
        ...credential,
        chatChannelId: botChannelId,
        contextType: 'room',
        roomId,
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        provider: providerId,
        chan: botChannelId,
        room: roomId,
        client: loginChannelId,
        ref: RefChatType.Room,
        os: LiffOs.Ios,
        lang: 'zh-TW',
        user: userId,
      },
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(3);
    expect(bot.requestApi).toHaveBeenCalledWith({
      channel: botChannel,
      method: 'GET',
      url: `v2/bot/room/${roomId}/member/${userId}`,
    });
  });

  it('fail if accessToken is absent', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);
    await expect(authenticator.verifyCredential({} as never)).resolves
      .toMatchInlineSnapshot(`
      {
        "code": 400,
        "ok": false,
        "reason": "access token is empty",
      }
    `);
  });

  it('fail if token verify api respond error', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    bot.requestApi.mock.wrap((originalImpl) => async (options) => {
      if (options.url.startsWith('oauth2/v2.1/verify')) {
        throw new LineApiError({
          code: 400,
          headers: {},
          body: {
            error: 'invalid_request',
            error_description: 'The access token expired',
          },
        });
      }
      return originalImpl(options);
    });

    await expect(authenticator.verifyCredential(credential as never)).resolves
      .toMatchInlineSnapshot(`
      {
        "code": 400,
        "ok": false,
        "reason": "invalid_request: The access token expired",
      }
    `);
  });

  it('fail if login channel not registered', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    agentSettingsAccessor.getLineLoginChannelSettings.mock.fakeResolvedValue(
      null,
    );

    await expect(authenticator.verifyCredential(credential)).resolves
      .toMatchInlineSnapshot(`
      {
        "code": 404,
        "ok": false,
        "reason": "login channel "_LOGIN_CHAN_ID_" not registered",
      }
    `);
  });

  it('fail if messaging channel id not match', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    await expect(
      authenticator.verifyCredential({
        ...credential,
        chatChannelId: '_WRONG_CHANNEL_',
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "code": 403,
        "ok": false,
        "reason": "messaging channel "_WRONG_CHANNEL_" not match",
      }
    `);
  });

  it('fail if user id not match', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    await expect(
      authenticator.verifyCredential({
        ...credential,
        userId: '_WORNG_USER_',
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "code": 401,
        "ok": false,
        "reason": "user and access token not match",
      }
    `);
  });

  it('fail when chat user not found', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    bot.requestApi.mock.wrap((originalImpl) => async (options) => {
      if (options.url.startsWith('v2/bot/profile')) {
        throw new LineApiError({
          code: 404,
          headers: {},
          body: { message: 'user profile not found' },
        });
      }
      return originalImpl(options);
    });

    await expect(
      authenticator.verifyCredential({
        ...credential,
        chatChannelId: botChannelId,
        contextType: 'utou',
      }),
    ).resolves.toEqual({
      ok: false,
      code: 404,
      reason: 'user profile not found',
    });
  });

  test('fail if group member not found', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    bot.requestApi.mock.wrap((originalImpl) => async (options) => {
      if (options.url.startsWith('v2/bot/group')) {
        throw new LineApiError({
          code: 404,
          headers: {},
          body: { message: 'group member not found' },
        });
      }
      return originalImpl(options);
    });

    await expect(
      authenticator.verifyCredential({
        ...credential,
        chatChannelId: botChannelId,
        contextType: 'group',
        groupId,
      }),
    ).resolves.toEqual({
      ok: false,
      code: 404,
      reason: 'group member not found',
    });
  });

  it('fail if room member not found', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    bot.requestApi.mock.wrap((originalImpl) => async (options) => {
      if (options.url.startsWith('v2/bot/room')) {
        throw new LineApiError({
          code: 404,
          headers: {},
          body: { message: 'room member not found' },
        });
      }
      return originalImpl(options);
    });

    await expect(
      authenticator.verifyCredential({
        ...credential,
        chatChannelId: botChannelId,
        contextType: 'room',
        roomId,
      }),
    ).resolves.toEqual({
      ok: false,
      code: 404,
      reason: 'room member not found',
    });
  });

  it('fail if chat type not match', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);
    const expectedResult = {
      ok: false,
      code: 400,
      reason: 'chat type not match',
    };

    await expect(
      authenticator.verifyCredential({
        ...credential,
        chatChannelId: botChannelId,
        contextType: 'utou',
        roomId,
      }),
    ).resolves.toEqual(expectedResult);
    await expect(
      authenticator.verifyCredential({
        ...credential,
        chatChannelId: botChannelId,
        contextType: 'group',
      }),
    ).resolves.toEqual(expectedResult);
    await expect(
      authenticator.verifyCredential({
        ...credential,
        chatChannelId: botChannelId,
        contextType: 'room',
        groupId,
      }),
    ).resolves.toEqual(expectedResult);
  });

  it('throw if unknown error happen', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    bot.requestApi.mock.fake(async () => {
      throw new Error('connection error');
    });

    await expect(authenticator.verifyCredential(credential)).rejects.toThrow(
      new Error('connection error'),
    );
  });
});

describe('.verifyRefreshment()', () => {
  const authData = {
    provider: providerId,
    client: loginChannelId,
    ref: RefChatType.External,
    os: LiffOs.Ios,
    lang: 'zh-TW',
    user: '_USER_ID_',
  };

  it('return original data if ok', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    await expect(authenticator.verifyRefreshment(authData)).resolves.toEqual({
      ok: true,
      data: authData,
    });

    expect(bot.requestApi).not.toHaveBeenCalled();
  });

  test('with messaging channel', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    const authDataWithMessagingChannel = {
      ...authData,
      ref: RefChatType.Utou,
      chan: botChannelId,
    };
    await expect(
      authenticator.verifyRefreshment(authDataWithMessagingChannel),
    ).resolves.toEqual({
      ok: true,
      data: authDataWithMessagingChannel,
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(1);
    expect(bot.requestApi.mock.calls[0].args[0]).toMatchInlineSnapshot(`
      {
        "channel": LineChannel {
          "$$typeofChannel": true,
          "id": "_BOT_CHAN_ID_",
          "platform": "line",
        },
        "method": "GET",
        "url": "v2/bot/profile/_USER_ID_",
      }
    `);
  });

  test('with group chat', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    const authDataWithGroup = {
      ...authData,
      chan: botChannelId,
      ref: RefChatType.Group,
      group: '_GROUP_ID_',
    };
    await expect(
      authenticator.verifyRefreshment(authDataWithGroup),
    ).resolves.toEqual({
      ok: true,
      data: authDataWithGroup,
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(1);
    expect(bot.requestApi.mock.calls[0].args[0]).toMatchInlineSnapshot(`
      {
        "channel": LineChannel {
          "$$typeofChannel": true,
          "id": "_BOT_CHAN_ID_",
          "platform": "line",
        },
        "method": "GET",
        "url": "v2/bot/group/_GROUP_ID_/member/_USER_ID_",
      }
    `);
  });

  test('with room chat', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    const authDataWithRoom = {
      ...authData,
      chan: botChannelId,
      ref: RefChatType.Room,
      room: '_ROOM_ID_',
    };
    await expect(
      authenticator.verifyRefreshment(authDataWithRoom),
    ).resolves.toEqual({
      ok: true,
      data: authDataWithRoom,
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(1);
    expect(bot.requestApi.mock.calls[0].args[0]).toMatchInlineSnapshot(`
      {
        "channel": LineChannel {
          "$$typeofChannel": true,
          "id": "_BOT_CHAN_ID_",
          "platform": "line",
        },
        "method": "GET",
        "url": "v2/bot/room/_ROOM_ID_/member/_USER_ID_",
      }
    `);
  });

  it('fail if provider id not match', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    await expect(
      authenticator.verifyRefreshment({
        ...authData,
        provider: '_WORNG_PROVIDER_',
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "code": 400,
        "ok": false,
        "reason": "provider not match",
      }
    `);
  });

  it('fail if user id not match', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    await expect(
      authenticator.verifyRefreshment({
        ...authData,
        user: '_WORNG_USER_',
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "data": {
          "client": "_LOGIN_CHAN_ID_",
          "lang": "zh-TW",
          "os": 0,
          "provider": "_PROVIDER_ID_",
          "ref": 3,
          "user": "_WORNG_USER_",
        },
        "ok": true,
      }
    `);
  });

  it('fail if messaging channel id not match', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    await expect(
      authenticator.verifyRefreshment({ ...authData, chan: '_WORNG_CHANNEL_' }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "code": 403,
        "ok": false,
        "reason": "messaging channel "_WORNG_CHANNEL_" not match",
      }
    `);
  });

  it('fail if login channel not registered', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    agentSettingsAccessor.getLineLoginChannelSettings.mock.fakeResolvedValue(
      null,
    );

    await expect(
      authenticator.verifyRefreshment({
        ...authData,
        client: '_WORNG_CLIENT_',
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "code": 404,
        "ok": false,
        "reason": "login channel "_WORNG_CLIENT_" not registered",
      }
    `);
  });

  it('fail if chat type not match', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);
    const expectedResult = {
      ok: false,
      code: 400,
      reason: 'chat type not match',
    };

    await expect(
      authenticator.verifyRefreshment({
        ...authData,
        ref: RefChatType.Utou,
        chan: botChannelId,
        room: roomId,
      }),
    ).resolves.toEqual(expectedResult);
    await expect(
      authenticator.verifyRefreshment({
        ...authData,
        chan: botChannelId,
        ref: RefChatType.Group,
      }),
    ).resolves.toEqual(expectedResult);
    await expect(
      authenticator.verifyRefreshment({
        ...authData,
        chan: botChannelId,
        ref: RefChatType.Room,
        group: groupId,
      }),
    ).resolves.toEqual(expectedResult);
  });

  it('fail when user not found', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);
    bot.requestApi.mock.fakeRejectedValue(
      new LineApiError({
        code: 404,
        headers: {},
        body: { message: 'user profile not found' },
      }),
    );

    const authDataWithMessagingChannel = {
      ...authData,
      ref: RefChatType.Utou,
      chan: botChannelId,
    };
    await expect(
      authenticator.verifyRefreshment(authDataWithMessagingChannel),
    ).resolves.toEqual({
      ok: false,
      code: 404,
      reason: 'user profile not found',
    });
  });

  test('with group chat', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);
    bot.requestApi.mock.fakeRejectedValue(
      new LineApiError({
        code: 404,
        headers: {},
        body: { message: 'group member not found' },
      }),
    );

    const authDataWithGroup = {
      ...authData,
      chan: botChannelId,
      ref: RefChatType.Group,
      group: '_GROUP_ID_',
    };
    await expect(
      authenticator.verifyRefreshment(authDataWithGroup),
    ).resolves.toEqual({
      ok: false,
      code: 404,
      reason: 'group member not found',
    });
  });

  test('with room chat', async () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);
    bot.requestApi.mock.fakeRejectedValue(
      new LineApiError({
        code: 404,
        headers: {},
        body: { message: 'room member not found' },
      }),
    );

    const authDataWithRoom = {
      ...authData,
      chan: botChannelId,
      ref: RefChatType.Room,
      room: '_ROOM_ID_',
    };
    await expect(
      authenticator.verifyRefreshment(authDataWithRoom),
    ).resolves.toEqual({
      ok: false,
      code: 404,
      reason: 'room member not found',
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(1);
    expect(bot.requestApi.mock.calls[0].args[0]).toMatchInlineSnapshot(`
      {
        "channel": LineChannel {
          "$$typeofChannel": true,
          "id": "_BOT_CHAN_ID_",
          "platform": "line",
        },
        "method": "GET",
        "url": "v2/bot/room/_ROOM_ID_/member/_USER_ID_",
      }
    `);
  });
});

describe('.checkAuthData(data)', () => {
  const authData = {
    provider: '_PROVIDER_ID_',
    channel: '_CHANNEL_ID_',
    client: '1234567890',
    ref: RefChatType.External,
    os: LiffOs.Web,
    lang: 'en-US',
    user: '_USER_ID_',
  };

  test('with no messaging channel', () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    expect(authenticator.checkAuthData(authData)).toEqual({
      ok: true,
      contextDetails: {
        providerId: '_PROVIDER_ID_',
        clientId: '1234567890',
        channel: null,
        user: new LineUser('_PROVIDER_ID_', '_USER_ID_'),
        thread: null,
        refChatType: 'external',
        os: 'web',
        language: 'en-US',
      },
    });
  });

  test('with private chat', () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    expect(
      authenticator.checkAuthData({
        ...authData,
        chan: '_CHANNEL_ID_',
        ref: RefChatType.Utou,
        os: LiffOs.Ios,
        lang: 'zh-TW',
      }),
    ).toEqual({
      ok: true,
      contextDetails: {
        providerId: '_PROVIDER_ID_',
        clientId: '1234567890',
        channel: new LineChannel('_CHANNEL_ID_'),
        user: new LineUser('_PROVIDER_ID_', '_USER_ID_'),
        thread: new LineChat('_CHANNEL_ID_', 'user', '_USER_ID_'),
        refChatType: 'utou',
        os: 'ios',
        language: 'zh-TW',
      },
    });
  });

  test('with group chat', () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    expect(
      authenticator.checkAuthData({
        ...authData,
        chan: '_CHANNEL_ID_',
        group: '_GROUP_ID_',
        ref: RefChatType.Group,
        os: LiffOs.Ios,
        lang: 'zh-TW',
      }),
    ).toEqual({
      ok: true,
      contextDetails: {
        providerId: '_PROVIDER_ID_',
        clientId: '1234567890',
        channel: new LineChannel('_CHANNEL_ID_'),
        user: new LineUser('_PROVIDER_ID_', '_USER_ID_'),
        thread: new LineChat('_CHANNEL_ID_', 'group', '_GROUP_ID_'),
        refChatType: 'group',
        os: 'ios',
        language: 'zh-TW',
      },
    });
  });

  test('with room chat', () => {
    const authenticator = new ServerAuthenticator(bot, agentSettingsAccessor);

    expect(
      authenticator.checkAuthData({
        ...authData,
        chan: '_CHANNEL_ID_',
        room: '_ROOM_ID_',
        ref: RefChatType.Room,
        os: LiffOs.Android,
        lang: 'jp',
      }),
    ).toEqual({
      ok: true,
      contextDetails: {
        providerId: '_PROVIDER_ID_',
        clientId: '1234567890',
        channel: new LineChannel('_CHANNEL_ID_'),
        user: new LineUser('_PROVIDER_ID_', '_USER_ID_'),
        thread: new LineChat('_CHANNEL_ID_', 'room', '_ROOM_ID_'),
        refChatType: 'room',
        os: 'android',
        language: 'jp',
      },
    });
  });
});
