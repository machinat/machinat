import moxy from '@moxyjs/moxy';
import nock from 'nock';
import type StateControllerI from '@sociably/core/base/StateController';
import LineChannel from '../../Channel';
import type { LineBot } from '../../Bot';
import { LineAssetsManager } from '../AssetsManager';

const state = moxy({
  get: async () => null,
  set: async () => true,
  update: async () => true,
  getAll: async () => null,
  delete: async () => true,
  clear: () => {},
});

const stateController = moxy<StateControllerI>({
  globalState() {
    return state;
  },
} as never);

const bot = moxy<LineBot>({
  channelId: '_CHANNEL_ID_',
  requestApi: () => ({}),
} as never);

const channelSettingsAccessor = moxy({
  getAgentSettings: async () => ({
    channelId: `__CHANNEL_ID__`,
    providerId: '__PROVIDER_ID__',
    accessToken: `__ACCESS_TOKEN__`,
    channelSecret: `__CHANNEL_SECRET__`,
  }),
  getAgentSettingsBatch: async () => [],
  getLineChatChannelSettingsByBotUserId: async () => null,
  getLineLoginChannelSettings: async () => null,
});

const channel = new LineChannel('1234567');

beforeEach(() => {
  stateController.mock.reset();
  state.mock.reset();
  bot.mock.reset();
  channelSettingsAccessor.mock.reset();
});

const manager = new LineAssetsManager(
  stateController,
  bot,
  channelSettingsAccessor
);

test('get asset id', async () => {
  await expect(manager.getAssetId(channel, 'foo', 'bar')).resolves.toBe(
    undefined
  );
  await expect(manager.getRichMenu(channel, 'my_rich_menu')).resolves.toBe(
    undefined
  );

  expect(stateController.globalState).toHaveBeenCalledTimes(2);
  expect(stateController.globalState.mock.calls.map((call) => call.args[0]))
    .toMatchInlineSnapshot(`
    Array [
      "$line.foo.1234567",
      "$line.rich_menu.1234567",
    ]
  `);

  expect(state.get).toHaveBeenCalledTimes(2);
  expect(state.get).toHaveBeenNthCalledWith(1, 'bar');
  expect(state.get).toHaveBeenNthCalledWith(2, 'my_rich_menu');

  state.get.mock.fakeReturnValue('baz');
  await expect(manager.getAssetId(channel, 'foo', 'bar')).resolves.toBe('baz');

  state.get.mock.fakeReturnValue('_RICH_MENU_ID_');
  await expect(manager.getRichMenu(channel, 'my_rich_menu')).resolves.toBe(
    '_RICH_MENU_ID_'
  );

  expect(stateController.globalState).toHaveBeenCalledTimes(4);
  expect(state.get).toHaveBeenCalledTimes(4);
});

test('set asset id', async () => {
  await expect(manager.saveAssetId(channel, 'foo', 'bar', 'baz')).resolves.toBe(
    true
  );

  await expect(
    manager.saveRichMenu(channel, 'my_rich_menu', '_RICH_MENU_ID_')
  ).resolves.toBe(true);

  expect(stateController.globalState).toHaveBeenCalledTimes(2);
  expect(stateController.globalState.mock.calls.map((call) => call.args[0]))
    .toMatchInlineSnapshot(`
    Array [
      "$line.foo.1234567",
      "$line.rich_menu.1234567",
    ]
  `);

  expect(state.set).toHaveBeenCalledTimes(2);
  expect(state.set).toHaveBeenNthCalledWith(1, 'bar', 'baz');
  expect(state.set).toHaveBeenNthCalledWith(
    2,
    'my_rich_menu',
    '_RICH_MENU_ID_'
  );

  state.set.mock.fake(async () => false);
  await expect(manager.saveAssetId(channel, 'foo', 'bar', 'baz')).resolves.toBe(
    false
  );

  await expect(
    manager.saveRichMenu(channel, 'my_rich_menu', '_RICH_MENU_ID_')
  ).resolves.toBe(false);
  expect(state.set).toHaveBeenCalledTimes(4);
});

test('get all assets', async () => {
  await expect(manager.getAllAssets(channel, 'foo')).resolves.toBe(null);
  await expect(manager.getAllRichMenus(channel)).resolves.toBe(null);

  expect(stateController.globalState).toHaveBeenCalledTimes(2);
  expect(stateController.globalState.mock.calls.map((call) => call.args[0]))
    .toMatchInlineSnapshot(`
    Array [
      "$line.foo.1234567",
      "$line.rich_menu.1234567",
    ]
  `);

  expect(state.getAll).toHaveBeenCalledTimes(2);

  const resources = new Map([
    ['bar', '1'],
    ['baz', '2'],
  ]);
  state.getAll.mock.fake(async () => resources);

  await expect(manager.getAllAssets(channel, 'foo')).resolves.toEqual(
    resources
  );
  await expect(manager.getAllRichMenus(channel)).resolves.toEqual(resources);

  expect(stateController.globalState).toHaveBeenCalledTimes(4);
  expect(state.getAll).toHaveBeenCalledTimes(4);
});

test('unsave asset id', async () => {
  await expect(manager.unsaveAssetId(channel, 'foo', 'bar')).resolves.toBe(
    true
  );
  await expect(manager.unsaveRichMenu(channel, 'my_rich_menu')).resolves.toBe(
    true
  );

  expect(stateController.globalState).toHaveBeenCalledTimes(2);
  expect(stateController.globalState.mock.calls.map((call) => call.args[0]))
    .toMatchInlineSnapshot(`
    Array [
      "$line.foo.1234567",
      "$line.rich_menu.1234567",
    ]
  `);

  expect(state.delete).toHaveBeenCalledTimes(2);
  expect(state.delete).toHaveBeenNthCalledWith(1, 'bar');
  expect(state.delete).toHaveBeenNthCalledWith(2, 'my_rich_menu');

  state.delete.mock.fake(async () => false);
  await expect(manager.unsaveAssetId(channel, 'foo', 'bar')).resolves.toBe(
    false
  );
  await expect(manager.unsaveRichMenu(channel, 'my_rich_menu')).resolves.toBe(
    false
  );
  expect(state.delete).toHaveBeenCalledTimes(4);
});

test('.createRichMenu()', async () => {
  bot.requestApi.mock.fake(async () => ({
    richMenuId: '_RICH_MENU_ID_',
  }));

  const richMenuBody = {
    size: { width: 2500, height: 1686 },
    selected: false,
    name: 'Nice richmenu',
    chatBarText: 'Tap here',
    areas: [
      {
        bounds: { x: 0, y: 0, width: 2500, height: 1686 },
        action: { type: 'postback', data: 'action=buy&itemid=123' },
      },
    ],
  };

  await expect(
    manager.createRichMenu(channel, 'my_rich_menu', richMenuBody)
  ).resolves.toBe('_RICH_MENU_ID_');

  expect(bot.requestApi).toHaveBeenCalledTimes(1);
  expect(bot.requestApi).toHaveBeenCalledWith({
    channel,
    method: 'POST',
    url: 'v2/bot/richmenu',
    params: richMenuBody,
  });

  state.get.mock.fakeReturnValue('_ALREADY_EXISTED_ID_');
  await expect(
    manager.createRichMenu(channel, 'my_rich_menu', richMenuBody)
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"rich menu [ my_rich_menu ] already exist"`
  );

  expect(state.set).toHaveBeenCalledTimes(1);
  expect(state.set).toHaveBeenCalledWith('my_rich_menu', '_RICH_MENU_ID_');
});

test('.deleteRichMenu()', async () => {
  bot.requestApi.mock.fake(async () => ({}));

  await expect(manager.deleteRichMenu(channel, 'my_rich_menu')).resolves.toBe(
    false
  );

  state.get.mock.fake(async () => '_RICH_MENU_ID_');
  await expect(manager.deleteRichMenu(channel, 'my_rich_menu')).resolves.toBe(
    true
  );

  expect(bot.requestApi).toHaveBeenCalledTimes(1);
  expect(bot.requestApi).toHaveBeenCalledWith({
    channel,
    method: 'DELETE',
    url: 'v2/bot/richmenu/_RICH_MENU_ID_',
  });

  expect(state.delete).toHaveBeenCalledTimes(1);
  expect(state.delete).toHaveBeenCalledWith('my_rich_menu');
});

describe('.uploadRichMenuImage(channel, menuId, content, options)', () => {
  const richMenuId = '__RICHMENU_ID__';

  it('upload image content', async () => {
    const uploadCall = nock('https://api-data.line.me', {
      reqheaders: {
        authorization: 'Bearer __ACCESS_TOKEN__',
        'content-type': 'image/png',
      },
    })
      .post(`/v2/bot/richmenu/${richMenuId}/content`)
      .reply(200, {});

    await expect(
      manager.uploadRichMenuImage(channel, richMenuId, Buffer.from('IMAGE'), {
        contentType: 'image/png',
      })
    ).resolves.toBe(undefined);

    expect(channelSettingsAccessor.getAgentSettings).toHaveBeenCalledTimes(1);
    expect(channelSettingsAccessor.getAgentSettings).toHaveBeenCalledWith(
      channel
    );

    expect(uploadCall.isDone()).toBe(true);
  });

  it('throw if API call fail', async () => {
    const uploadCall = nock('https://api-data.line.me', {
      reqheaders: {
        authorization: 'Bearer __ACCESS_TOKEN__',
        'content-type': 'image/png',
      },
    })
      .post(`/v2/bot/richmenu/${richMenuId}/content`)
      .reply(400, { message: 'BOOM' });

    await expect(
      manager.uploadRichMenuImage(channel, richMenuId, Buffer.from('IMAGE'), {
        contentType: 'image/png',
      })
    ).rejects.toThrowError('BOOM');

    expect(channelSettingsAccessor.getAgentSettings).toHaveBeenCalledTimes(1);
    expect(channelSettingsAccessor.getAgentSettings).toHaveBeenCalledWith(
      channel
    );

    expect(uploadCall.isDone()).toBe(true);
  });

  it('throw if page not found', async () => {
    nock.disableNetConnect();

    channelSettingsAccessor.getAgentSettings.mock.fakeResolvedValue(null);

    await expect(
      manager.uploadRichMenuImage(channel, richMenuId, Buffer.from('IMAGE'), {
        contentType: 'image/png',
      })
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Line channel \\"[object Object]\\" not registered"`
    );

    expect(channelSettingsAccessor.getAgentSettings).toHaveBeenCalledTimes(1);
    expect(channelSettingsAccessor.getAgentSettings).toHaveBeenCalledWith(
      channel
    );

    nock.enableNetConnect();
  });
});
