/// <reference lib="DOM" />
import { EventEmitter } from 'events';
import Socket from '../Socket.js';
import SocketError from '../error.js';
import { EmittableWebSocket } from '../types.js';

class WrappedWebSocket extends EventEmitter {
  private _ws: WebSocket;

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(webSocket: WebSocket) {
    super();
    this._ws = webSocket;

    this._ws.onmessage = (e) => {
      this.emit('message', e.data);
    };

    this._ws.onclose = (e) => {
      this.emit('close', e.code, e.reason);
    };

    this._ws.onerror = (e: ErrorEvent) => {
      this.emit('error', new SocketError(e.message));
    };

    this._ws.onopen = () => {
      this.emit('open');
    };
  }

  get binaryType() {
    return this._ws.binaryType;
  }

  set binaryType(t) {
    this._ws.binaryType = t;
  }

  get bufferedAmount() {
    return this._ws.bufferedAmount;
  }

  get extensions() {
    return this._ws.extensions;
  }

  get protocol() {
    return this._ws.protocol;
  }

  get readyState() {
    return this._ws.readyState;
  }

  get url() {
    return this._ws.url;
  }

  send(data, callback) {
    this._ws.send(data);
    callback();
  }

  close(code, reason) {
    this._ws.close(code, reason);
  }

  // eslint-disable-next-line class-methods-use-this
  ping() {
    // TODO: ping/pong in client side
  }
}

const SOCIABLY_WEBSOCKET_PROTOCOL_V0 = 'sociably-websocket-v0';

const createClientSocket = async (url: string): Promise<Socket> => {
  let webSocket: EmittableWebSocket;

  if (typeof WebSocket !== 'undefined') {
    webSocket = new WrappedWebSocket(
      new WebSocket(url, SOCIABLY_WEBSOCKET_PROTOCOL_V0),
    );
  } else {
    const { default: WebSocket } = await import('ws');
    webSocket = new WebSocket(url, SOCIABLY_WEBSOCKET_PROTOCOL_V0);
  }

  const socket = new Socket(webSocket);

  return new Promise((resolve, reject) => {
    let errorListener;
    const openListener = () => {
      resolve(socket);
      socket.removeListener('open', openListener);
      socket.removeListener('error', errorListener);
    };
    errorListener = (err) => {
      reject(err);
      socket.removeListener('open', openListener);
      socket.removeListener('error', errorListener);
    };
    socket.on('open', openListener);
    socket.on('error', errorListener);
  });
};

export default createClientSocket;
