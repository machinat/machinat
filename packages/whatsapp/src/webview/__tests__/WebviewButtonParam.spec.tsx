import moxy from '@moxyjs/moxy';
import WhatsAppChat from '../../Chat.js';
import ServerAuthenticator from '../ServerAuthenticator.js';
import WebviewButtonParam from '../WebviewButtonParam.js';

const authenticator = moxy<ServerAuthenticator>({
  getAuthUrlPostfix: () => '/foo/auth/whatsapp?login=__LOGIN_TOKEN__',
} as never);

beforeEach(() => {
  authenticator.mock.reset();
});

test('rendering to UrlButtonParam', () => {
  expect(
    WebviewButtonParam(
      authenticator,
      new WhatsAppChat('1234567890', '9876543210'),
    )({}),
  ).toMatchInlineSnapshot(`
    <UrlButtonParam
      urlPostfix="/foo/auth/whatsapp?login=__LOGIN_TOKEN__"
    />
  `);

  expect(
    WebviewButtonParam(
      authenticator,
      new WhatsAppChat('1234567890', '9876543210'),
    )({ page: '/foo?bar=baz' }),
  ).toMatchInlineSnapshot(`
    <UrlButtonParam
      urlPostfix="/foo/auth/whatsapp?login=__LOGIN_TOKEN__"
    />
  `);

  expect(
    WebviewButtonParam(
      authenticator,
      new WhatsAppChat('1234567890', '9876543210'),
    )({ page: '/foo', index: 1, params: { hello: 'world' } }),
  ).toMatchInlineSnapshot(`
    <UrlButtonParam
      index={1}
      urlPostfix="/foo/auth/whatsapp?login=__LOGIN_TOKEN__"
    />
  `);

  expect(authenticator.getAuthUrlPostfix).toHaveBeenCalledTimes(3);
  expect(authenticator.getAuthUrlPostfix).toHaveBeenCalledWith(
    new WhatsAppChat('1234567890', '9876543210'),
    {},
  );
  expect(authenticator.getAuthUrlPostfix).toHaveBeenNthCalledWith(
    2,
    new WhatsAppChat('1234567890', '9876543210'),
    { redirectUrl: 'foo?bar=baz' },
  );
  expect(authenticator.getAuthUrlPostfix).toHaveBeenNthCalledWith(
    3,
    new WhatsAppChat('1234567890', '9876543210'),
    {
      redirectUrl: 'foo',
      webviewParams: { hello: 'world' },
    },
  );
});

test('throw if thread is not a WhatsAppChat', () => {
  expect(() =>
    WebviewButtonParam(authenticator, null as never)({}),
  ).toThrowErrorMatchingInlineSnapshot(
    `"WebviewButtonParam can only be used in WhatsAppChat"`,
  );
  expect(() =>
    WebviewButtonParam(authenticator, null as never)({ page: '/foo' }),
  ).toThrowErrorMatchingInlineSnapshot(
    `"WebviewButtonParam can only be used in WhatsAppChat"`,
  );
  const wrongThread = {
    platform: 'test',
    uid: 'test.foo',
    uniqueIdentifier: { platform: 'test', id: 'foo' },
  };
  expect(() =>
    WebviewButtonParam(authenticator, wrongThread as never)({}),
  ).toThrowErrorMatchingInlineSnapshot(
    `"WebviewButtonParam can only be used in WhatsAppChat"`,
  );

  expect(authenticator.getAuthUrlPostfix).not.toHaveBeenCalled();
});
