// @flow
import WS from 'ws';
import { Emitter, Controller, Engine, resolvePlugins } from 'machinat-base';
import Renderer from 'machinat-renderer';
import Queue from 'machinat-queue';

import type { MachinatNode, MachinatUser } from 'machinat/types';
import type { MachinatBot, SegmentWithoutPause } from 'machinat-base/types';
import type { HTTPUpgradeReceivable } from 'machinat-http-adaptor/types';
import type { WebSocketChannel } from './channel';
import type {
  WebSocketEvent,
  WebSocketMetadata,
  EventOrder,
  WebSocketResponse,
  WebSocketJob,
  WebSocketResult,
  WebSocketBotOptions,
  WebSocketComponent,
  ConnectionId,
} from './types';

import { WEBSOCKET, WEBSOCKET_NATIVE_TYPE } from './constant';
import Distributor from './distributor';
import { LocalOnlyBroker } from './broker';
import WebSocketReceiver from './receiver';
import WebSocketWorker from './worker';

const WSServer = WS.Server;

type WebSocketBotOptionsInput = $Shape<WebSocketBotOptions>;

const createJobs = (
  channel: WebSocketChannel,
  segments: SegmentWithoutPause<EventOrder, WebSocketComponent>[]
): WebSocketJob[] => {
  const jobs = new Array(segments.length);
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    jobs[i] = {
      channel,
      order:
        segment.type === 'text'
          ? {
              type: 'message',
              subtype: 'text',
              payload: segment.value,
            }
          : segment.value,
    };
  }
  return jobs;
};

class WebSocketBot
  extends Emitter<
    WebSocketChannel,
    ?MachinatUser,
    WebSocketEvent,
    WebSocketMetadata,
    EventOrder,
    WebSocketComponent,
    WebSocketJob,
    WebSocketResult,
    void
  >
  implements
    HTTPUpgradeReceivable<WebSocketReceiver>,
    MachinatBot<
      WebSocketChannel,
      ?MachinatUser,
      WebSocketEvent,
      WebSocketMetadata,
      WebSocketResponse,
      EventOrder,
      WebSocketComponent,
      WebSocketJob,
      WebSocketResult,
      void,
      WebSocketBotOptionsInput
    > {
  _distributor: Distributor;
  options: WebSocketBotOptions;
  receiver: WebSocketReceiver;

  controller: Controller<
    WebSocketChannel,
    ?MachinatUser,
    WebSocketEvent,
    WebSocketMetadata,
    WebSocketResponse,
    EventOrder,
    WebSocketComponent,
    void
  >;

  engine: Engine<
    WebSocketChannel,
    EventOrder,
    WebSocketComponent,
    WebSocketJob,
    WebSocketResult
  >;

  worker: WebSocketWorker;

  constructor(optionsInput?: WebSocketBotOptionsInput) {
    super();

    const defaultOptions: WebSocketBotOptions = {
      verifyUpgrade: undefined,
    };
    const options = Object.assign(defaultOptions, optionsInput);
    this.options = options;

    const broker = new LocalOnlyBroker();
    const distributor = new Distributor(broker, err => this.emitError(err));
    this._distributor = distributor;

    const wsServer = new WSServer({ noServer: true });

    const { eventMiddlewares, dispatchMiddlewares } = resolvePlugins(
      this,
      options.plugins
    );

    this.controller = new Controller(WEBSOCKET, this, eventMiddlewares);
    this.receiver = new WebSocketReceiver(wsServer, distributor, options);

    this.receiver.bindIssuer(
      this.controller.eventIssuerThroughMiddlewares(this.emitEvent.bind(this)),
      this.emitError.bind(this)
    );

    const queue = new Queue();
    const worker = new WebSocketWorker(distributor);

    const renderer = new Renderer(WEBSOCKET, WEBSOCKET_NATIVE_TYPE, () => {
      throw new TypeError(
        'general component not supported at websocket platform'
      );
    });

    this.engine = new Engine(
      WEBSOCKET,
      (this: any),
      renderer,
      queue,
      worker,
      dispatchMiddlewares
    );
  }

  async render(
    channel: WebSocketChannel,
    message: MachinatNode
  ): Promise<null | WebSocketResult[]> {
    const tasks = await this.engine.renderTasks(
      createJobs,
      channel,
      message,
      undefined,
      true
    );

    if (tasks === null) {
      return null;
    }

    const response = await this.engine.dispatch(channel, tasks, message);
    return response === null ? null : response.results;
  }

  disconnect(connId: ConnectionId, reason: string) {
    return this._distributor.disconnect(connId, reason);
  }
}

export default WebSocketBot;
