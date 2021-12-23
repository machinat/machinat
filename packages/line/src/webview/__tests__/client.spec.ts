import url from 'url';
import { JSDOM } from 'jsdom';
import moxy, { Moxy } from '@moxyjs/moxy';
import ClientAuthorizer from '../client';
import LineChat from '../../channel';
import LineUser from '../../user';
import { LiffContextOs } from '../../constant';
import { LineUserProfile } from '../../profiler';

const liffContext = {
  type: 'utou',
  utouId: '_UTOU_ID_',
  userId: '_USER_ID_',
  viewType: 'full',
  accessTokenHash: 'XXXXXX',
  availability: {
    shareTargetPicker: {
      permission: true,
      minVer: '10.3.0',
    },
  },
};

const liff = moxy({
  init: () => Promise.resolve(),
  getOS: () => 'ios',
  getLanguage: () => 'en-US',
  getVersion: () => 'v2.1',
  isInClient: () => true,
  isLoggedIn: () => true,
  login: () => {},
  getAccessToken: () => '_ACCESS_TOKEN_',
  getContext: () => liffContext,
  getProfile: () =>
    Promise.resolve({
      userId: '_USER_ID_',
      displayName: 'John',
      pictureUrl: 'https://example.com/abcdefghijklmn',
      statusMessage: 'Hello, LINE!',
    }),
  closeWindow: () => {},
});

const { document } = new JSDOM('').window;
const window = moxy(
  {
    document,
    liff,
    location: url.parse(
      'https://machinat.io/foo?bar=baz'
    ) as unknown as Moxy<Location>,
  },
  { includeProperties: ['*'] }
);

beforeAll(() => {
  (global as any).window = window;
  (global as any).document = document;
});

beforeEach(() => {
  liff.mock.reset();
  window.mock.reset();
  window.document.body.innerHTML = `
    <html>
      <head>
        <script src="..."/>
      </head>
      <body>
        <dev id="app"/>
      </body>
    </html>
  `;
});

describe('#constructor()', () => {
  test('properties', () => {
    const authorizer = new ClientAuthorizer({
      liffId: '_LIFF_ID_',
    });

    expect(authorizer.platform).toBe('line');
    expect(authorizer.liffId).toBe('_LIFF_ID_');
    expect(authorizer.shouldLoadSDK).toBe(true);
    expect(authorizer.marshalTypes.map((t) => t.name)).toMatchInlineSnapshot(`
      Array [
        "LineChat",
        "LineUser",
        "LineUserProfile",
        "LineGroupProfile",
      ]
    `);
  });

  it('throw if liffId is empty', () => {
    expect(
      () => new ClientAuthorizer({} as never)
    ).toThrowErrorMatchingInlineSnapshot(`"options.liffId must not be empty"`);
  });
});

describe('#init()', () => {
  it('add liff sdk and call init() after loaded', async () => {
    const authorizer = new ClientAuthorizer({
      liffId: '_LIFF_ID_',
    });

    const promise = authorizer.init();

    const liffScriptEle: any = window.document.getElementById('LIFF');
    expect(liffScriptEle.tagName).toBe('SCRIPT');
    expect(liffScriptEle.getAttribute('src')).toBe(
      'https://static.line-scdn.net/liff/edge/2/sdk.js'
    );
    expect(liff.init.mock).not.toHaveBeenCalled();

    liffScriptEle.onload();

    await expect(promise).resolves.toBe(undefined);
    expect(liff.init.mock).toHaveBeenCalledTimes(1);
    expect(liff.login.mock).not.toHaveBeenCalled();
  });

  it('skip adding sdk if options.shouldLoadSDK set to false', async () => {
    const authorizer = new ClientAuthorizer({
      liffId: '_LIFF_ID_',
      shouldLoadSDK: false,
    });

    await expect(authorizer.init()).resolves.toBe(undefined);

    expect(document.getElementById('LIFF')).toBe(null);
    expect(liff.init.mock).toHaveBeenCalledTimes(1);
  });

  it('wait for redirect while in LIFF primary redirecting', async () => {
    jest.useFakeTimers();

    window.location.mock
      .getter('search')
      .fakeReturnValue('?liff.state=__DATA_FROM_LIFF__');

    const authorizer = new ClientAuthorizer({
      liffId: '_LIFF_ID_',
      shouldLoadSDK: false,
    });

    const promise = authorizer.init();
    setImmediate(jest.runAllTimers);

    await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(
      `"redirect timeout"`
    );

    expect(document.getElementById('LIFF')).toBe(null);
    expect(liff.init.mock).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });
});

describe('#fetchCredential()', () => {
  it('resolve credential containing liff infos and access token', async () => {
    const authorizer = new ClientAuthorizer({
      liffId: '_LIFF_ID_',
      shouldLoadSDK: false,
    });

    await authorizer.init();
    await expect(authorizer.fetchCredential()).resolves.toEqual({
      success: true,
      credential: {
        accessToken: '_ACCESS_TOKEN_',
        os: 'ios',
        language: 'en-US',
        userId: '_USER_ID_',
      },
    });

    expect(liff.login.mock).not.toHaveBeenCalled();
  });

  test('credential in group chat', async () => {
    const authorizer = new ClientAuthorizer({
      liffId: '_LIFF_ID_',
      shouldLoadSDK: false,
    });

    liff.getContext.mock.fakeReturnValue({
      ...liffContext,
      type: 'group',
      groupId: '_GROUP_ID_',
      utouId: undefined,
    });

    await authorizer.init();
    await expect(authorizer.fetchCredential()).resolves.toEqual({
      success: true,
      credential: {
        accessToken: '_ACCESS_TOKEN_',
        os: 'ios',
        language: 'en-US',
        userId: '_USER_ID_',
        groupId: '_GROUP_ID_',
      },
    });

    expect(liff.login.mock).not.toHaveBeenCalled();
  });

  test('credential in room chat', async () => {
    const authorizer = new ClientAuthorizer({
      liffId: '_LIFF_ID_',
      shouldLoadSDK: false,
    });

    liff.getContext.mock.fakeReturnValue({
      ...liffContext,
      type: 'room',
      roomId: '_ROOM_ID_',
      utouId: undefined,
    });

    await authorizer.init();
    await expect(authorizer.fetchCredential()).resolves.toEqual({
      success: true,
      credential: {
        accessToken: '_ACCESS_TOKEN_',
        os: 'ios',
        language: 'en-US',
        userId: '_USER_ID_',
        roomId: '_ROOM_ID_',
      },
    });

    expect(liff.login.mock).not.toHaveBeenCalled();
  });

  it('call liff.login() if liff.isLoggedIn() is false', async () => {
    jest.useFakeTimers();

    liff.isLoggedIn.mock.fakeReturnValue(false);

    const authorizer = new ClientAuthorizer({
      liffId: '_LIFF_ID_',
      shouldLoadSDK: false,
    });

    expect(liff.login.mock).not.toHaveBeenCalled();

    await authorizer.init();
    const promise = authorizer.fetchCredential();
    setImmediate(jest.runAllTimers);

    expect(liff.isLoggedIn.mock).toHaveBeenCalledTimes(1);
    expect(liff.login.mock).toHaveBeenCalledTimes(1);
    expect(liff.login.mock).toHaveBeenCalledWith({
      redirectUri: 'https://machinat.io/foo?bar=baz',
    });

    await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(
      `"redirect timeout"`
    );

    jest.useRealTimers();
  });
});

describe('#checkAuthContext(data)', () => {
  it('resolve utou chat', () => {
    const authorizer = new ClientAuthorizer({
      liffId: '_LIFF_ID_',
      shouldLoadSDK: false,
    });

    expect(
      authorizer.checkAuthContext({
        provider: '_PROVIDER_ID_',
        channel: '_BOT_CHANNEL_ID_',
        client: '_CLIENT_ID_',
        os: LiffContextOs.Web,
        lang: 'en-US',
        user: '_USER_ID_',
        group: undefined,
        room: undefined,
        name: undefined,
        pic: undefined,
      })
    ).toEqual({
      success: true,
      contextSupplment: {
        providerId: '_PROVIDER_ID_',
        channelId: '_BOT_CHANNEL_ID_',
        clientId: '_CLIENT_ID_',
        user: new LineUser('_PROVIDER_ID_', '_USER_ID_'),
        channel: new LineChat('_BOT_CHANNEL_ID_', 'user', '_USER_ID_'),
        profile: null,
        os: 'web',
        language: 'en-US',
      },
    });
  });

  it('resolve group chat', () => {
    const authorizer = new ClientAuthorizer({
      liffId: '_LIFF_ID_',
      shouldLoadSDK: false,
    });

    expect(
      authorizer.checkAuthContext({
        provider: '_PROVIDER_ID_',
        channel: '_BOT_CHANNEL_ID_',
        client: '_CLIENT_ID_',
        os: LiffContextOs.Ios,
        lang: 'zh-TW',
        group: '_GROUP_ID_',
        user: '_USER_ID_',
        room: undefined,
        name: undefined,
        pic: undefined,
      })
    ).toEqual({
      success: true,
      contextSupplment: {
        providerId: '_PROVIDER_ID_',
        channelId: '_BOT_CHANNEL_ID_',
        clientId: '_CLIENT_ID_',
        user: new LineUser('_PROVIDER_ID_', '_USER_ID_'),
        channel: new LineChat('_BOT_CHANNEL_ID_', 'group', '_GROUP_ID_'),
        profile: null,
        os: 'ios',
        language: 'zh-TW',
      },
    });
  });

  it('resolve room chat', () => {
    const authorizer = new ClientAuthorizer({
      liffId: '_LIFF_ID_',
      shouldLoadSDK: false,
    });

    expect(
      authorizer.checkAuthContext({
        provider: '_PROVIDER_ID_',
        channel: '_BOT_CHANNEL_ID_',
        client: '_CLIENT_ID_',
        os: LiffContextOs.Android,
        lang: 'jp',
        room: '_ROOM_ID_',
        user: '_USER_ID_',
        group: undefined,
        name: undefined,
        pic: undefined,
      })
    ).toEqual({
      success: true,
      contextSupplment: {
        providerId: '_PROVIDER_ID_',
        channelId: '_BOT_CHANNEL_ID_',
        clientId: '_CLIENT_ID_',
        user: new LineUser('_PROVIDER_ID_', '_USER_ID_'),
        channel: new LineChat('_BOT_CHANNEL_ID_', 'room', '_ROOM_ID_'),
        profile: null,
        os: 'android',
        language: 'jp',
      },
    });
  });

  it('resolve profile if profile data proivded', () => {
    const authorizer = new ClientAuthorizer({
      liffId: '_LIFF_ID_',
      shouldLoadSDK: false,
    });

    expect(
      authorizer.checkAuthContext({
        provider: '_PROVIDER_ID_',
        channel: '_BOT_CHANNEL_ID_',
        client: '_CLIENT_ID_',
        os: LiffContextOs.Ios,
        lang: 'zh-TW',
        user: '_USER_ID_',
        group: '_GROUP_ID_',
        room: undefined,
        name: 'Jojo Doe',
        pic: 'http://advanture.com/Egypt.jpg',
      })
    ).toEqual({
      success: true,
      contextSupplment: {
        providerId: '_PROVIDER_ID_',
        channelId: '_BOT_CHANNEL_ID_',
        clientId: '_CLIENT_ID_',
        user: new LineUser('_PROVIDER_ID_', '_USER_ID_'),
        channel: new LineChat('_BOT_CHANNEL_ID_', 'group', '_GROUP_ID_'),
        profile: new LineUserProfile({
          userId: '_USER_ID_',
          displayName: 'Jojo Doe',
          pictureUrl: 'http://advanture.com/Egypt.jpg',
        }),
        os: 'ios',
        language: 'zh-TW',
      },
    });
  });
});

test('#closeWebview', async () => {
  const authorizer = new ClientAuthorizer({
    liffId: '_LIFF_ID_',
    shouldLoadSDK: false,
  });
  await authorizer.init();

  expect(authorizer.closeWebview()).toBe(true);
  expect(liff.closeWindow.mock).toHaveBeenCalledTimes(1);
});
