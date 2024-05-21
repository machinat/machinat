import moxy from '@moxyjs/moxy';
import TwitterChat from '../../Chat.js';
import TweetTarget from '../../TweetTarget.js';
import ServerAuthenticator from '../ServerAuthenticator.js';
import WebviewButton from '../WebviewButton.js';

const authenticator = moxy<ServerAuthenticator>({
  getAuthUrl: () =>
    'https://sociably.io/foo/auth/twitter?login=__LOGIN_TOKEN__',
} as never);

beforeEach(() => {
  authenticator.mock.reset();
});

test('rendering to UrlButton', () => {
  const chat = new TwitterChat('1234567890', '9876543210');

  expect(WebviewButton(authenticator, chat)({ label: 'Foo' }))
    .toMatchInlineSnapshot(`
    <UrlButton
      label="Foo"
      url="https://sociably.io/foo/auth/twitter?login=__LOGIN_TOKEN__"
    />
  `);

  expect(
    WebviewButton(
      authenticator,
      chat,
    )({ label: 'Foo', page: '/foo?bar=baz', params: { hello: 'world' } }),
  ).toMatchInlineSnapshot(`
    <UrlButton
      label="Foo"
      url="https://sociably.io/foo/auth/twitter?login=__LOGIN_TOKEN__"
    />
  `);

  expect(authenticator.getAuthUrl).toHaveBeenCalledTimes(2);
  expect(authenticator.getAuthUrl).toHaveBeenNthCalledWith(
    1,
    '1234567890',
    '9876543210',
    {},
  );
  expect(authenticator.getAuthUrl).toHaveBeenNthCalledWith(
    2,
    '1234567890',
    '9876543210',
    { redirectUrl: 'foo?bar=baz', webviewParams: { hello: 'world' } },
  );
});

test('rendering to null if thread is not a TwitterChat', () => {
  expect(WebviewButton(authenticator, null as never)({ label: 'Foo' })).toBe(
    null,
  );
  expect(
    WebviewButton(authenticator, null as never)({ label: 'Foo', page: '/foo' }),
  ).toBe(null);
  expect(
    WebviewButton(authenticator, new TweetTarget('12345'))({ label: 'Foo' }),
  ).toBe(null);

  expect(authenticator.getAuthUrl).not.toHaveBeenCalled();
});
