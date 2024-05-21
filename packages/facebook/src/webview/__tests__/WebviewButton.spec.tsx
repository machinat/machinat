import moxy from '@moxyjs/moxy';
import FacebookChat from '../../Chat.js';
import FacebookUser from '../../User.js';
import ServerAuthenticator from '../ServerAuthenticator.js';
import WebviewButton from '../WebviewButton.js';

const authenticator = moxy<ServerAuthenticator>({
  getAuthUrl: () =>
    'https://sociably.io/foo/auth/facebook?login=__LOGIN_TOKEN__',
} as never);

beforeEach(() => {
  authenticator.mock.reset();
});

test('rendering to UrlButton', () => {
  expect(
    WebviewButton(
      authenticator,
      new FacebookChat('12345', { id: '67890' }),
    )({ title: 'Foo' }),
  ).toMatchInlineSnapshot(`
    <UrlButton
      title="Foo"
      url="https://sociably.io/foo/auth/facebook?login=__LOGIN_TOKEN__"
    />
  `);

  expect(
    WebviewButton(
      authenticator,
      new FacebookChat('12345', { id: '67890' }),
    )({ title: 'Foo', webviewHeightRatio: 'compact', hideShareButton: true }),
  ).toMatchInlineSnapshot(`
    <UrlButton
      hideShareButton={true}
      title="Foo"
      url="https://sociably.io/foo/auth/facebook?login=__LOGIN_TOKEN__"
      webviewHeightRatio="compact"
    />
  `);

  expect(
    WebviewButton(
      authenticator,
      new FacebookChat('12345', { id: '67890' }),
    )({ title: 'Foo', page: '/foo?bar=baz', params: { hello: 'world' } }),
  ).toMatchInlineSnapshot(`
    <UrlButton
      title="Foo"
      url="https://sociably.io/foo/auth/facebook?login=__LOGIN_TOKEN__"
    />
  `);

  expect(authenticator.getAuthUrl).toHaveBeenCalledTimes(3);
  expect(authenticator.getAuthUrl).toHaveBeenNthCalledWith(
    1,
    new FacebookUser('12345', '67890'),
    {},
  );
  expect(authenticator.getAuthUrl).toHaveBeenNthCalledWith(
    2,
    new FacebookUser('12345', '67890'),
    {},
  );
  expect(authenticator.getAuthUrl).toHaveBeenNthCalledWith(
    3,
    new FacebookUser('12345', '67890'),
    { redirectUrl: 'foo?bar=baz', webviewParams: { hello: 'world' } },
  );
});

test('throw if thread is not a FacebookChat', () => {
  expect(() =>
    WebviewButton(authenticator, null as never)({ title: 'Foo' }),
  ).toThrowErrorMatchingInlineSnapshot(
    `"WebviewButton can only be used in the FacebookChat with a user ID"`,
  );
  expect(() =>
    WebviewButton(authenticator, null as never)({ title: 'Foo', page: '/foo' }),
  ).toThrowErrorMatchingInlineSnapshot(
    `"WebviewButton can only be used in the FacebookChat with a user ID"`,
  );
  expect(() =>
    WebviewButton(authenticator, {
      platform: 'test',
      uid: 'test.foo',
    } as never)({
      title: 'Foo',
    }),
  ).toThrowErrorMatchingInlineSnapshot(
    `"WebviewButton can only be used in the FacebookChat with a user ID"`,
  );

  expect(authenticator.getAuthUrl).not.toHaveBeenCalled();
});
