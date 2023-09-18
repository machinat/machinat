import { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';
import moxy, { Mock } from '@moxyjs/moxy';
import { LineReceiver } from '../Receiver.js';
import LineChannel from '../Channel.js';
import LineChat from '../Chat.js';
import LineUser from '../User.js';
import type { LineBot } from '../Bot.js';

const bot = moxy<LineBot>({
  render: async () => ({ jobs: [], tasks: [], results: [] }),
} as never);

const agentSettingsAccessor = moxy({
  getLineChatChannelSettingsByBotUserId: async (botUserId: string) => ({
    channelId: `_CHANNEL_ID_${botUserId}_`,
    providerId: '_PROVIDER_ID_',
    accessToken: `_ACCESS_TOKEN_${botUserId}_`,
    channelSecret: `_CHANNEL_SECRET_${botUserId}_`,
    botUserId: '_BOT_USER_ID_',
  }),
  getAgentSettings: async () => null,
  getAgentSettingsBatch: async () => [],
  getLineLoginChannelSettings: async () => null,
});

const popEventMock = new Mock();
const popEventWrapper = moxy((popEvent) => popEventMock.proxify(popEvent));

const createReq = ({
  method,
  url = '/',
  body = '',
  headers = {},
}): IncomingMessage => {
  const req = new Readable({
    read() {
      if (body) req.push(body);
      req.push(null);
    },
  });
  return Object.assign(req, {
    method,
    url,
    body,
    headers,
  }) as never;
};

const createRes = (): ServerResponse =>
  moxy({
    finished: false,
    statusCode: 200,
    writeHead(code) {
      this.statusCode = code;
    },
    end(...args) {
      this.finished = true;
      for (let i = args.length - 1; i >= 0; i -= 1) {
        if (typeof args[i] === 'function') args[i]();
      }
    },
  } as never);

beforeEach(() => {
  popEventMock.reset();
  popEventWrapper.mock.reset();
  agentSettingsAccessor.mock.reset();
});

it.each(['GET', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'UPDATE', 'UPGRADE'])(
  'responds 405 if req.method is %s',
  async (method) => {
    const receiver = new LineReceiver({
      bot,
      agentSettingsAccessor,
      popEventWrapper,
      shouldVerifyRequest: false,
    });

    const req = createReq({ method });
    const res = createRes();

    await receiver.handleRequest(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.finished).toBe(true);
  },
);

it('responds 400 if body is empty', async () => {
  const receiver = new LineReceiver({
    bot,
    agentSettingsAccessor,
    popEventWrapper,
    shouldVerifyRequest: false,
  });

  const req = createReq({ method: 'POST' });
  const res = createRes();

  await receiver.handleRequest(req, res);

  expect(res.statusCode).toBe(400);
  expect(res.finished).toBe(true);
});

it('responds 400 if body is not not valid json format', async () => {
  const receiver = new LineReceiver({
    bot,
    agentSettingsAccessor,
    popEventWrapper,
    shouldVerifyRequest: false,
  });

  const req = createReq({ method: 'POST', body: "I'm Jason" });
  const res = createRes();

  await receiver.handleRequest(req, res);

  expect(res.statusCode).toBe(400);
  expect(res.finished).toBe(true);
});

it('responds 400 if body is in invalid format', async () => {
  const receiver = new LineReceiver({
    bot,
    agentSettingsAccessor,
    popEventWrapper,
    shouldVerifyRequest: false,
  });

  const req = createReq({
    method: 'POST',
    body: '{"there":"is no events hahaha"}',
  });
  const res = createRes();

  await receiver.handleRequest(req, res);

  expect(res.statusCode).toBe(400);
  expect(res.finished).toBe(true);
});

it('respond 200 and pop events received', async () => {
  const receiver = new LineReceiver({
    bot,
    agentSettingsAccessor,
    popEventWrapper,
    shouldVerifyRequest: false,
  });

  const body = {
    destination: 'FOO',
    events: [
      {
        replyToken: '0f3779fba3b349968c5d07db31eab56f',
        type: 'message',
        timestamp: 1462629479859,
        source: {
          type: 'user',
          userId: 'U4af4980629',
        },
        message: {
          id: '325708',
          type: 'text',
          text: 'Hello, world',
        },
      },
      {
        replyToken: '8cf9239d56244f4197887e939187e19e',
        type: 'follow',
        timestamp: 1462629479859,
        source: {
          type: 'user',
          userId: 'U4af4980629',
        },
      },
    ],
  };

  const bodyStr = JSON.stringify(body);

  const req = createReq({
    method: 'POST',
    body: bodyStr,
  });
  const res = createRes();

  await receiver.handleRequest(req, res);

  expect(res.statusCode).toBe(200);
  expect(res.finished).toBe(true);

  expect(popEventMock).toHaveBeenCalledTimes(2);

  for (const {
    args: [ctx],
  } of popEventMock.calls) {
    expect(ctx.platform).toBe('line');
    expect(ctx.bot).toBe(bot);

    const { metadata, event } = ctx;

    expect(event.platform).toBe('line');
    expect(event.channel).toEqual(new LineChannel('_CHANNEL_ID_FOO_'));
    expect(event.thread).toEqual(
      new LineChat('_CHANNEL_ID_FOO_', 'user', 'U4af4980629'),
    );
    expect(event.user).toEqual(new LineUser('_PROVIDER_ID_', 'U4af4980629'));

    expect(metadata).toEqual({
      source: 'webhook',
      request: {
        method: 'POST',
        url: '/',
        headers: {},
        body: bodyStr,
      },
    });
  }

  const event1 = popEventMock.calls[0].args[0].event;
  expect(event1.category).toBe('message');
  expect(event1.type).toBe('text');
  expect(event1.payload).toEqual(body.events[0]);

  const event2 = popEventMock.calls[1].args[0].event;
  expect(event2.type).toBe('follow');
  expect(event2.category).toBe('action');
  expect(event2.payload).toEqual(body.events[1]);

  expect(
    agentSettingsAccessor.getLineChatChannelSettingsByBotUserId,
  ).toHaveBeenCalledTimes(1);
  expect(
    agentSettingsAccessor.getLineChatChannelSettingsByBotUserId,
  ).toHaveBeenCalledWith('FOO');
});

test('reply(message)', async () => {
  const receiver = new LineReceiver({
    bot,
    agentSettingsAccessor,
    popEventWrapper,
    shouldVerifyRequest: false,
  });

  await receiver.handleRequest(
    createReq({
      method: 'POST',
      body: '{"destination":"xxx","events":[{"replyToken":"_REPLY_TOKEN_","type":"message","timestamp":1462629479859,"source":{"type":"user","userId":"xxx"},"message":{"id":"325708","type":"text","text":"Hello, world"}}]}',
    }),
    createRes(),
  );

  const { reply, event } = popEventMock.calls[0].args[0];

  await expect(reply('hello world')).resolves.toEqual({
    jobs: [],
    results: [],
    tasks: [],
  });

  expect(bot.render).toHaveBeenCalledTimes(1);
  expect(bot.render).toHaveBeenCalledWith(event.thread, 'hello world', {
    replyToken: event.replyToken,
  });

  await reply('hello world');
  expect(bot.render).toHaveBeenCalledTimes(2);
  expect(bot.render).toHaveBeenCalledWith(event.thread, 'hello world', {});
});

it('validate request', async () => {
  const receiver = new LineReceiver({
    bot,
    agentSettingsAccessor,
    popEventWrapper,
    shouldVerifyRequest: true,
  });

  agentSettingsAccessor.getLineChatChannelSettingsByBotUserId.mock.fakeResolvedValue(
    {
      channelSecret: '__LINE_CHANNEL_SECRET__',
      channelId: '_CHANNEL_ID_',
      providerId: '_PROVIDER_ID_',
      accessToken: '_ACCESS_TOKEN_',
    },
  );

  const body =
    '{"destination":"xxx","events":[{"replyToken":"xxx","type":"message","timestamp":1462629479859,"source":{"type":"user","userId":"xxx"},"message":{"id":"325708","type":"text","text":"Hello, world"}}]}';
  const hmac = 'tJIFpuDMyZ4a9XzwkNUBK2B/7NH5gxYJDR/57RCf+6k=';

  const req = createReq({
    method: 'POST',
    headers: { 'x-line-signature': hmac },
    body,
  });
  const res = createRes();

  await receiver.handleRequest(req, res);

  expect(res.statusCode).toBe(200);
  expect(res.finished).toBe(true);

  expect(popEventMock).toHaveBeenCalledTimes(1);
  const { event } = popEventMock.calls[0].args[0];

  expect(event.channel).toEqual(new LineChannel('_CHANNEL_ID_'));
  expect(event.thread).toEqual(new LineChat('_CHANNEL_ID_', 'user', 'xxx'));
  expect(event.user).toEqual(new LineUser('_PROVIDER_ID_', 'xxx'));

  expect(event.category).toBe('message');
  expect(event.type).toBe('text');
  expect(event.payload).toEqual({
    replyToken: 'xxx',
    type: 'message',
    timestamp: 1462629479859,
    source: { type: 'user', userId: 'xxx' },
    message: { id: '325708', type: 'text', text: 'Hello, world' },
  });
});

it('responds 401 if request validation failed', async () => {
  const receiver = new LineReceiver({
    bot,
    agentSettingsAccessor,
    popEventWrapper,
    shouldVerifyRequest: true,
  });

  const body =
    '{"destination":"xxx","events":[{"replyToken":"xxx","type":"message","timestamp":1462629479859,"source":{"type":"user","userId":"xxx"},"message":{"id":"325708","type":"text","text":"Hello, world"}}]}';
  const hmac = '_INVALID_SIGANATURE_';

  const req = createReq({
    method: 'POST',
    headers: { 'x-line-signature': hmac },
    body,
  });
  const res = createRes();

  await receiver.handleRequest(req, res);

  expect(res.statusCode).toBe(401);
  expect(res.finished).toBe(true);

  expect(popEventMock).not.toHaveBeenCalled();
});
