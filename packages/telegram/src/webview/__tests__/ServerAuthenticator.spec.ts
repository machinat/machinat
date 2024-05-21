import type { IncomingMessage, ServerResponse } from 'http';
import moxy from '@moxyjs/moxy';
import type { AuthHttpOperator } from '@sociably/auth';
import type { TelegramBot } from '../../Bot.js';
import { TelegramServerAuthenticator } from '../ServerAuthenticator.js';
import TelegramChat from '../../Chat.js';
import TelegramUser from '../../User.js';
import TelegramApiError from '../../Error.js';

const createReq = ({ url }) =>
  moxy<IncomingMessage>({
    method: 'GET',
    headers: {},
    url,
  } as never);

const res = moxy<ServerResponse>({
  writeHead() {},
  end() {},
} as never);

const agentSettings = {
  botToken: '12345:_BOT_TOKEN_',
  botName: 'MyBot',
  secretToken: '_SECRET_TOKEN_',
};

const agentSettingsAccessor = moxy({
  getAgentSettings: async () => agentSettings,
  getAgentSettingsBatch: async () => [],
});

const httpOperator = moxy<AuthHttpOperator>({
  async issueAuth() {},
  async issueError() {},
  redirect() {},
  getAuthUrl: () => 'https://sociably.io/MyApp/auth/telegram',
} as never);

const bot = moxy<TelegramBot>({
  requestApi() {
    throw new Error();
  },
} as never);

const botUser = new TelegramUser(12345, true);

const authenticator = new TelegramServerAuthenticator(
  bot,
  agentSettingsAccessor,
  httpOperator,
);

beforeEach(() => {
  bot.mock.reset();
  res.mock.reset();
  httpOperator.mock.reset();
  agentSettingsAccessor.mock.reset();
});

const MockDate = moxy(Date);
MockDate.now.mock.fake(() => 1601136786000);
const _Date = Date;

beforeAll(() => {
  global.Date = MockDate;
});

afterAll(() => {
  global.Date = _Date;
});

describe('.delegateAuthRequest() on root route', () => {
  const telegramLoginSearch = {
    id: '67890',
    auth_date: '1601136776',
    first_name: 'John',
    last_name: 'Doe',
    username: 'johndoe',
    photo_url: 'https://...',
    hash: '2fab0fcc9f122624f9007c7d93852afad07584bad3937ac45dda7882b58fabc8',
  };

  it('receive login request and redirct user to webview', async () => {
    const search = new URLSearchParams({
      ...telegramLoginSearch,
      botId: '12345',
    });

    const req = createReq({ url: `/auth/telegram?${search}` });
    await authenticator.delegateAuthRequest(req, res, {
      originalPath: '/auth/telegram',
      basePath: '/',
      matchedPath: 'auth/telegram',
      trailingPath: '',
    });

    expect(httpOperator.redirect).toHaveBeenCalledTimes(1);
    expect(httpOperator.redirect).toHaveBeenCalledWith(res, undefined, {
      assertInternal: true,
    });

    expect(httpOperator.issueError).not.toHaveBeenCalled();
    expect(httpOperator.issueAuth).toHaveBeenCalledTimes(1);
    expect(httpOperator.issueAuth).toHaveBeenCalledWith(res, 'telegram', {
      botId: 12345,
      botName: 'MyBot',
      chat: undefined,
      user: {
        id: 67890,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
      },
      photo: 'https://...',
    });
  });

  it('verify user is a chat member if `chatId` query param given', async () => {
    const search = new URLSearchParams({
      ...telegramLoginSearch,
      botId: '12345',
      chatId: '55555',
    });

    const req = createReq({ url: `/auth/telegram?${search}` });

    // getChatMember
    bot.requestApi.mock.fakeOnce(async () => ({
      user: {
        id: 67890,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        language_code: 'en-US',
      },
      status: 'member',
    }));

    // getChat
    bot.requestApi.mock.fakeOnce(async () => ({
      id: 55555,
      type: 'group',
      title: 'Does',
    }));

    await authenticator.delegateAuthRequest(req, res, {
      originalPath: '/auth/telegram',
      basePath: '/',
      matchedPath: 'auth/telegram',
      trailingPath: '',
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(2);
    expect(bot.requestApi).toHaveBeenNthCalledWith(1, {
      channel: botUser,
      method: 'getChatMember',
      params: {
        user_id: 67890,
        chat_id: 55555,
      },
    });
    expect(bot.requestApi).toHaveBeenNthCalledWith(2, {
      channel: botUser,
      method: 'getChat',
      params: { chat_id: 55555 },
    });

    expect(httpOperator.issueAuth).toHaveBeenCalledTimes(1);
    expect(httpOperator.issueAuth).toHaveBeenCalledWith(res, 'telegram', {
      botId: 12345,
      botName: 'MyBot',
      chat: {
        type: 'group',
        id: 55555,
        title: 'Does',
      },
      user: {
        id: 67890,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        language_code: 'en-US',
      },
      photo: 'https://...',
    });
  });

  it('fail if bot settings not found', async () => {
    agentSettingsAccessor.getAgentSettings.mock.fakeResolvedValue(null);

    const search = new URLSearchParams({
      ...telegramLoginSearch,
      botId: '12345',
    });

    const req = createReq({ url: `/auth/telegram?${search}` });
    await authenticator.delegateAuthRequest(req, res, {
      originalPath: '/auth/telegram',
      basePath: '/',
      matchedPath: 'auth/telegram',
      trailingPath: '',
    });

    expect(bot.requestApi).not.toHaveBeenCalled();

    expect(httpOperator.issueError).toHaveBeenCalledTimes(1);
    expect(httpOperator.issueError).toHaveBeenCalledWith(
      res,
      'telegram',
      404,
      expect.any(String),
    );
    expect(httpOperator.issueError.mock.calls[0].args[3]).toMatchInlineSnapshot(
      `"bot "12345" not registered"`,
    );
  });

  it('fail if user is not a member of telegramChat', async () => {
    const search = new URLSearchParams({
      ...telegramLoginSearch,
      botId: '12345',
      chatId: '23456',
    });

    const req = createReq({ url: `/auth/telegram?${search}` });

    bot.requestApi.mock.fake(async () => {
      throw new TelegramApiError({
        ok: false,
        error_code: 400,
        description: 'Bad Request: user not found',
      });
    });

    await authenticator.delegateAuthRequest(req, res, {
      originalPath: '/auth/telegram',
      basePath: '/',
      matchedPath: 'auth/telegram',
      trailingPath: '',
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(2);

    expect(httpOperator.issueError).toHaveBeenCalledTimes(1);
    expect(httpOperator.issueError).toHaveBeenCalledWith(
      res,
      'telegram',
      400,
      expect.any(String),
    );
    expect(httpOperator.issueError.mock.calls[0].args[3]).toMatchInlineSnapshot(
      `"Bad Request: user not found"`,
    );
  });

  it('redirect to `redirectUrl` query param if specified', async () => {
    const search = new URLSearchParams({
      ...telegramLoginSearch,
      botId: '12345',
      redirectUrl: '/webview/hello_world.html',
    });

    const req = createReq({ url: `/auth/telegram?${search}` });
    await authenticator.delegateAuthRequest(req, res, {
      originalPath: '/auth/telegram',
      basePath: '/',
      matchedPath: 'auth/telegram',
      trailingPath: '',
    });

    expect(httpOperator.redirect).toHaveBeenCalledWith(
      res,
      '/webview/hello_world.html',
      { assertInternal: true },
    );

    expect(httpOperator.issueError).not.toHaveBeenCalled();
    expect(httpOperator.issueAuth).toHaveBeenCalledTimes(1);
  });

  it('issue error if auth_date expired (20 second)', async () => {
    const search = new URLSearchParams({
      ...telegramLoginSearch,
      botId: '12345',
      auth_date: '1601136765',
      hash: '7bacdcbfa60768f607cbe6de9589cc4aadb4b4cb0ca1a4098a53b2a73fadfc00',
    });

    const req = createReq({ url: `/auth/telegram?${search}` });
    await authenticator.delegateAuthRequest(req, res, {
      originalPath: '/auth/telegram',
      basePath: '/',
      matchedPath: 'auth/telegram',
      trailingPath: '',
    });

    expect(httpOperator.redirect).toHaveBeenCalledWith(res, undefined, {
      assertInternal: true,
    });

    expect(httpOperator.issueAuth).not.toHaveBeenCalled();
    expect(httpOperator.issueError).toHaveBeenCalledTimes(1);
    expect(httpOperator.issueError).toHaveBeenCalledWith(
      res,
      'telegram',
      401,
      expect.any(String),
    );
    expect(httpOperator.issueError.mock.calls[0].args[3]).toMatchInlineSnapshot(
      `"login expired"`,
    );
  });

  it('issue error if hash invalid', async () => {
    const search = new URLSearchParams({
      ...telegramLoginSearch,
      botId: '12345',
      hash: '_INVALID_HASH_',
    });

    const req = createReq({
      url: `/auth/telegram?${search}`,
    });
    await authenticator.delegateAuthRequest(req, res, {
      originalPath: '/auth/telegram',
      basePath: '/',
      matchedPath: 'auth/telegram',
      trailingPath: '',
    });

    expect(httpOperator.redirect).toHaveBeenCalledWith(res, undefined, {
      assertInternal: true,
    });

    expect(httpOperator.issueAuth).not.toHaveBeenCalled();
    expect(httpOperator.issueError).toHaveBeenCalledTimes(1);
    expect(httpOperator.issueError).toHaveBeenCalledWith(
      res,
      'telegram',
      401,
      expect.any(String),
    );
    expect(httpOperator.issueError.mock.calls[0].args[3]).toMatchInlineSnapshot(
      `"invalid auth signature"`,
    );
  });
});

describe('.delegateAuthRequest() on login route', () => {
  const loginRoute = {
    originalPath: '/auth/telegram/login',
    basePath: '/',
    matchedPath: 'auth/telegram',
    trailingPath: 'login',
  };

  test('render login page with Telegarm login button', async () => {
    const req = createReq({ url: `/auth/telegram/login?botId=12345` });
    await authenticator.delegateAuthRequest(req, res, loginRoute);

    expect(res.writeHead).toHaveBeenCalledTimes(1);
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/html',
    });
    expect(res.end).toHaveBeenCalledTimes(1);

    const pageHtml = res.end.mock.calls[0].args[0];
    expect(pageHtml).toMatchSnapshot();
    expect(pageHtml).toEqual(
      expect.stringContaining(
        'https://sociably.io/MyApp/auth/telegram?botId=12345',
      ),
    );
  });

  test('with `chatId` & `redirectUrl` specified', async () => {
    const req = createReq({
      url: `/auth/telegram/login?botId=12345&chatId=67890&redirectUrl=%2Fwebview%2Fhello_world`,
    });
    await authenticator.delegateAuthRequest(req, res, loginRoute);

    expect(res.writeHead).toHaveBeenCalledTimes(1);
    expect(res.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/html',
    });
    expect(res.end).toHaveBeenCalledTimes(1);

    const pageHtml = res.end.mock.calls[0].args[0];
    expect(pageHtml).toMatchSnapshot();
    expect(pageHtml).toEqual(
      expect.stringContaining(
        'https://sociably.io/MyApp/auth/telegram?botId=12345&chatId=67890&redirectUrl=%2Fwebview%2Fhello_world',
      ),
    );
  });

  test('login page with specified `appName` & `appIconUrl`', async () => {
    const req = createReq({ url: `/auth/telegram/login?botId=12345` });

    const authenticatorWithAppDetails = new TelegramServerAuthenticator(
      bot,
      agentSettingsAccessor,
      httpOperator,
      {
        appName: 'Mine Mine Mine App',
        appIconUrl: 'http://sociably.io/MyApp/icon.png',
      },
    );
    await authenticatorWithAppDetails.delegateAuthRequest(req, res, loginRoute);

    expect(res.writeHead).toHaveBeenCalledTimes(1);
    expect(res.end).toHaveBeenCalledTimes(1);

    const pageHtml = res.end.mock.calls[0].args[0];
    expect(pageHtml).toMatchSnapshot();
    expect(pageHtml).toEqual(
      expect.stringContaining('<h1>Mine Mine Mine App</h1>'),
    );
    expect(pageHtml).toEqual(
      expect.stringContaining('src="http://sociably.io/MyApp/icon.png"'),
    );
  });

  test('redirect with error if no `botId` query', async () => {
    const req = createReq({ url: `/auth/telegram/login` });
    await authenticator.delegateAuthRequest(req, res, loginRoute);

    expect(httpOperator.redirect).toHaveBeenCalledTimes(1);
    expect(httpOperator.redirect).toHaveBeenCalledWith(res, undefined, {
      assertInternal: true,
    });
    expect(httpOperator.issueError).toHaveBeenCalledTimes(1);
    expect(httpOperator.issueError).toHaveBeenCalledWith(
      res,
      'telegram',
      400,
      expect.any(String),
    );
    expect(httpOperator.issueError.mock.calls[0].args[3]).toMatchInlineSnapshot(
      `"invalid bot id "undefined""`,
    );
  });

  test('redirect with error if bot settings not found', async () => {
    agentSettingsAccessor.getAgentSettings.mock.fakeResolvedValue(null);

    const req = createReq({
      url: `/auth/telegram/login?botId=12345&redirectUrl=%2Fwebview%2Fhello_world`,
    });
    await authenticator.delegateAuthRequest(req, res, loginRoute);

    expect(httpOperator.redirect).toHaveBeenCalledTimes(1);
    expect(httpOperator.redirect).toHaveBeenCalledWith(
      res,
      '/webview/hello_world',
      { assertInternal: true },
    );
    expect(httpOperator.issueError).toHaveBeenCalledTimes(1);
    expect(httpOperator.issueError).toHaveBeenCalledWith(
      res,
      'telegram',
      404,
      expect.any(String),
    );
    expect(httpOperator.issueError.mock.calls[0].args[3]).toMatchInlineSnapshot(
      `"bot "12345" not registered"`,
    );
  });
});

test('.delegateAuthRequest() on unknown route', async () => {
  const req = createReq({ url: `/auth/telegram/unknown` });
  await authenticator.delegateAuthRequest(req, res, {
    originalPath: '/auth/telegram/unknown',
    basePath: '/',
    matchedPath: 'auth/telegram',
    trailingPath: 'unknown',
  });

  expect(res.writeHead).toHaveBeenCalledTimes(1);
  expect(res.writeHead).toHaveBeenCalledWith(404);
  expect(res.end).toHaveBeenCalledTimes(1);
});

test('.getAuthUrl()', () => {
  expect(authenticator.getAuthUrl(12345)).toMatchInlineSnapshot(
    `"https://sociably.io/MyApp/auth/telegram?botId=12345"`,
  );
  expect(
    authenticator.getAuthUrl(12345, { chatId: 67890 }),
  ).toMatchInlineSnapshot(
    `"https://sociably.io/MyApp/auth/telegram?botId=12345&chatId=67890"`,
  );
  expect(
    authenticator.getAuthUrl(12345, { redirectUrl: 'foo?bar=baz' }),
  ).toMatchInlineSnapshot(
    `"https://sociably.io/MyApp/auth/telegram?botId=12345&redirectUrl=foo%3Fbar%3Dbaz"`,
  );
  expect(
    authenticator.getAuthUrl(12345, {
      chatId: 67890,
      redirectUrl: 'foo?bar=baz',
      webviewParams: { hello: 'world' },
    }),
  ).toMatchInlineSnapshot(
    `"https://sociably.io/MyApp/auth/telegram?botId=12345&chatId=67890&redirectUrl=foo%3Fbar%3Dbaz&webviewParams=%7B%22hello%22%3A%22world%22%7D"`,
  );

  expect(httpOperator.getAuthUrl).toHaveBeenCalledTimes(4);
  expect(httpOperator.getAuthUrl).toHaveBeenCalledWith('telegram');
});

test('.verifyCredential() simply return not ok', async () => {
  await expect(authenticator.verifyCredential()).resolves
    .toMatchInlineSnapshot(`
    {
      "code": 403,
      "ok": false,
      "reason": "should initiate st server side only",
    }
  `);
});

describe('.verifyRefreshment()', () => {
  test('return ok and original data', async () => {
    const authData = {
      botId: 12345,
      botName: 'MyBot',
      user: {
        id: 67890,
        first_name: 'Jojo',
        last_name: 'Doe',
        username: 'jojodoe',
      },
      photo: undefined,
    };
    await expect(authenticator.verifyRefreshment(authData)).resolves.toEqual({
      ok: true,
      data: authData,
    });
  });

  it('verify user is a chat member if `chat` is specified', async () => {
    // getChatMember
    bot.requestApi.mock.fakeOnce(async () => ({
      user: {
        id: 67890,
        first_name: 'John',
        last_name: 'Doe',
        username: 'johndoe',
        language_code: 'en-US',
      },
      status: 'member',
    }));

    // getChat
    bot.requestApi.mock.fakeOnce(async () => ({
      id: 55555,
      type: 'group',
      title: 'Does',
    }));

    const authData = {
      botId: 12345,
      botName: 'MyBot',
      chat: {
        type: 'group' as const,
        id: 55555,
        title: 'Stardust Crusaders',
      },
      user: {
        id: 67890,
        first_name: 'Jojo',
        last_name: 'Doe',
        username: 'jojodoe',
      },
      photo: undefined,
    };
    await expect(authenticator.verifyRefreshment(authData)).resolves.toEqual({
      ok: true,
      data: authData,
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(2);
    expect(bot.requestApi).toHaveBeenNthCalledWith(1, {
      channel: botUser,
      method: 'getChatMember',
      params: {
        user_id: 67890,
        chat_id: 55555,
      },
    });
    expect(bot.requestApi).toHaveBeenNthCalledWith(2, {
      channel: botUser,
      method: 'getChat',
      params: { chat_id: 55555 },
    });
  });

  it('fail if chat member check fails', async () => {
    bot.requestApi.mock.fake(async () => {
      throw new TelegramApiError({
        ok: false,
        error_code: 404,
        description: 'Bad Request: user not found',
      });
    });

    await expect(
      authenticator.verifyRefreshment({
        botId: 12345,
        botName: 'MyBot',
        chat: { type: 'group', id: 55555, title: 'Stardust Crusaders' },
        user: {
          id: 67890,
          first_name: 'Jojo',
          last_name: 'Doe',
          username: 'jojodoe',
        },
        photo: undefined,
      }),
    ).resolves.toEqual({
      ok: false,
      code: 404,
      reason: 'Bad Request: user not found',
    });

    expect(bot.requestApi).toHaveBeenCalledTimes(2);
  });

  it('fail if bot settings not found', async () => {
    agentSettingsAccessor.getAgentSettings.mock.fakeResolvedValue(null);

    await expect(
      authenticator.verifyRefreshment({
        botId: 55555,
        botName: 'MyBot',
        chat: undefined,
        user: {
          id: 67890,
          first_name: 'Jojo',
          last_name: 'Doe',
          username: 'jojodoe',
        },
        photo: undefined,
      }),
    ).resolves.toMatchInlineSnapshot(`
      {
        "code": 404,
        "ok": false,
        "reason": "bot "55555" not registered",
      }
    `);
  });
});

test('.checkAuthData()', () => {
  const authData = {
    botId: 12345,
    botName: 'MyBot',
    chat: undefined,
    user: {
      id: 67890,
      first_name: 'Jojo',
      last_name: 'Doe',
      username: 'jojodoe',
    },
    photo: 'http://crazy.dm/stand.png',
  };

  const expectedUser = new TelegramUser(
    67890,
    false,
    {
      id: 67890,
      is_bot: false,
      first_name: 'Jojo',
      last_name: 'Doe',
      username: 'jojodoe',
    },
    'http://crazy.dm/stand.png',
  );

  expect(authenticator.checkAuthData(authData)).toEqual({
    ok: true,
    contextDetails: {
      botId: 12345,
      botName: 'MyBot',
      channel: new TelegramUser(12345, true),
      user: expectedUser,
      thread: new TelegramChat(12345, 67890, {
        type: 'private',
        id: 67890,
        first_name: 'Jojo',
        last_name: 'Doe',
        username: 'jojodoe',
      }),
      photoUrl: 'http://crazy.dm/stand.png',
    },
  });
  expect(
    authenticator.checkAuthData({
      ...authData,
      chat: { type: 'group', id: 67890 },
    }),
  ).toEqual({
    ok: true,
    contextDetails: {
      botId: 12345,
      botName: 'MyBot',
      channel: new TelegramUser(12345, true),
      user: expectedUser,
      thread: new TelegramChat(12345, 67890, { type: 'group', id: 67890 }),
      photoUrl: 'http://crazy.dm/stand.png',
    },
  });
});
