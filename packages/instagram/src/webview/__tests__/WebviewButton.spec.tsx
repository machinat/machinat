import moxy from '@moxyjs/moxy';
import InstagramAgent from '../../Agent.js';
import InstagramChat from '../../Chat.js';
import InstagramUser from '../../User.js';
import ServerAuthenticator from '../ServerAuthenticator.js';
import WebviewButton from '../WebviewButton.js';

const authenticator = moxy<ServerAuthenticator>({
  getAuthUrl: async () =>
    'https://sociably.io/foo/auth/facebook?login=__LOGIN_TOKEN__',
} as never);

beforeEach(() => {
  authenticator.mock.reset();
});

test('rendering to UrlButton', async () => {
  await expect(
    WebviewButton(
      authenticator,
      new InstagramChat('12345', { id: '67890' }),
    )({ title: 'Foo' }),
  ).resolves.toMatchInlineSnapshot(`
    <UrlButton
      title="Foo"
      url="https://sociably.io/foo/auth/facebook?login=__LOGIN_TOKEN__"
    />
  `);

  await expect(
    WebviewButton(
      authenticator,
      new InstagramChat('12345', { id: '67890' }),
    )({ title: 'Foo', webviewHeightRatio: 'compact', hideShareButton: true }),
  ).resolves.toMatchInlineSnapshot(`
    <UrlButton
      hideShareButton={true}
      title="Foo"
      url="https://sociably.io/foo/auth/facebook?login=__LOGIN_TOKEN__"
      webviewHeightRatio="compact"
    />
  `);

  await expect(
    WebviewButton(
      authenticator,
      new InstagramChat('12345', { id: '67890' }),
    )({ title: 'Foo', page: '/foo?bar=baz', params: { hello: 'world' } }),
  ).resolves.toMatchInlineSnapshot(`
    <UrlButton
      title="Foo"
      url="https://sociably.io/foo/auth/facebook?login=__LOGIN_TOKEN__"
    />
  `);

  expect(authenticator.getAuthUrl).toHaveBeenCalledTimes(3);
  expect(authenticator.getAuthUrl).toHaveBeenNthCalledWith(
    1,
    new InstagramUser('12345', '67890'),
    {},
  );
  expect(authenticator.getAuthUrl).toHaveBeenNthCalledWith(
    2,
    new InstagramUser('12345', '67890'),
    {},
  );
  expect(authenticator.getAuthUrl).toHaveBeenNthCalledWith(
    3,
    new InstagramUser('12345', '67890'),
    { redirectUrl: 'foo?bar=baz', webviewParams: { hello: 'world' } },
  );
});

test('throw if thread is not a InstagramChat', async () => {
  await expect(
    WebviewButton(
      authenticator,
      new InstagramAgent('1234567890', '9876543210'),
    )({ title: 'Foo' }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"WebviewButton can only be used in the InstagramChat with a user ID"`,
  );
  await expect(
    WebviewButton(
      authenticator,
      new InstagramUser('1234567890', '9876543210') as never,
    )({ title: 'Foo', page: '/foo' }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"WebviewButton can only be used in the InstagramChat with a user ID"`,
  );
  await expect(
    WebviewButton(authenticator, {
      platform: 'test',
      uid: 'test.foo',
    } as never)({
      title: 'Foo',
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"WebviewButton can only be used in the InstagramChat with a user ID"`,
  );

  expect(authenticator.getAuthUrl).not.toHaveBeenCalled();
});
