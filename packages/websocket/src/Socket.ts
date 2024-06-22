import { EventEmitter } from 'events';
import thenifiedly from 'thenifiedly';
import SocketError from './error.js';
import type { UpgradeRequestInfo, EventInput } from './types.js';
import { EmittableWebSocket } from './types.js';

type TimeoutID = ReturnType<typeof setTimeout>;

type WithSocket = {
  socket: Socket;
};

export const SOCKET_CONNECTING = 0;
export const SOCKET_OPEN = 1;
export const SOCKET_CLOSING = 2;
export const SOCKET_CLOSED = 3;

/**
 * Format
 *
 * In v0 all messages transmitted in plain text of JSON format for the ease of
 * implementation temporarily, the formation looks like:
 *
 * [frameType, sequence, body]
 *
 * FrameType: string, type of a frame sequence: number, the message sequence on
 * the socket it transmitted on body: object, body object correponded to the
 * frame type
 */
const FRAME_EVENTS = 'events';
const FRAME_REJECT = 'reject';
const FRAME_LOGIN = 'login';
const FRAME_CONNECT = 'connect';
const FRAME_DISCONNECT = 'disconnect';

/** Event frame carries events delivered on a specified connection */
export type EventsBody = {
  connId: string;
  values: EventInput[];
};

/** Reject frame reject an illegal frame transmitted before */
export type RejectBody = {
  seq: number; // seq of the rejected frame
  // code: number,
  reason: string;
};

/** Login frame request for signing in a connection */
export type LoginBody = {
  credential?: any;
};

/**
 * Connect frame initiate a connect handshake from Server or make a confirmation
 * to the connect frame received from Client
 */
export type ConnectBody = {
  seq: number; // reflect the responded "login" seq on server, "connect" seq on client
  connId: string;
};

/**
 * Disconnect frame initiate a disconnect handshake or make a confirmation to
 * the disconnect frame received from Server/Client
 */
export type DisconnectBody = {
  seq?: number; // the disconnect frame seq received if it's a confirmation
  connId: string;
  // code: number,
  reason?: string;
};

/*
 * Communication
 *
 * Connect Handshake: this initiate a connection
 *
 *  +---------+             +---------+
 *  | Client  |             | Server  |
 *  +---------+             +---------+
 *       |                        |
 *       | LOGIN                  |
 *       |----------------------->|
 *       |                        |
 *       |                        | verify auth
 *       |                        |------------
 *       |                        |           |
 *       |                        |<-----------
 *       |                        | --------------------------\
 *       |                        |-| or initiative by Server |
 *       |                        | |-------------------------|
 *       |                        |
 *       |                CONNECT |
 *       |<-----------------------|
 *       |                        |
 *       | CONNECT                |
 *       |----------------------->|
 *       |                        | -----------------------\
 *       |                        |-| ok to emit event now |
 *       |                        | |----------------------|
 *       |               DISPATCH |
 *       |<-----------------------|
 *       |                        |
 *
 * Disconnect Handshake: disconnect a connected connection, this can be initiate
 *                       on both Client and Server
 *
 *                        +---------+                +---------+
 *                        | Client  |                | Server  |
 *                        +---------+                +---------+
 *                             |                           |
 *                             |                DISCONNECT |
 *                             |<--------------------------|
 * --------------------------\ |                           |
 * | event before DISCONNECT |-|                           |
 * | echoed back still count | |                           |
 * |-------------------------| |                           |
 *                             |                           |
 *                             | DISPATCH                  |
 *                             |-------------------------->|
 *                             |                           |
 *                             | DISCONNECT                |
 *                             |-------------------------->|
 *                             |                           |
 *
 */
const STATE_CONNECTED_OK = 0;

const FLAG_CONNECT_SENT = 1;
const FLAG_CONNECT_RECEIVED = 1 << 1;
const FLAG_DISCONNECT_SENT = 1 << 2;
const FLAG_DISCONNECT_RECEIVED = 1 << 3;
const FLAG_OUTDATING = 1 << 4;

const MASK_CONNECTING = FLAG_CONNECT_SENT | FLAG_CONNECT_RECEIVED;
const MASK_DISCONNECTING = FLAG_DISCONNECT_SENT | FLAG_DISCONNECT_RECEIVED;

const HANDSHAKE_TIMEOUT = 20 * 1000;

function handleWsMessage(this: EmittableWebSocket & WithSocket, data: any) {
  const { socket } = this;
  socket._handlePacket(data).catch(socket._emitError.bind(socket));
}

function handleWsOpen(this: EmittableWebSocket & WithSocket) {
  this.socket._emitOpen();
}

function handleWsClose(
  this: EmittableWebSocket & WithSocket,
  code: number,
  reason: string,
) {
  const { socket } = this;
  socket._emitClose(code, reason);
}

function handleWsError(this: EmittableWebSocket & WithSocket, err: Error) {
  this.socket._emitError(err);
}

/**
 * Socket encapsulate protocol detail and provide a high level api for
 * communicating operation and notification
 */
class Socket extends EventEmitter {
  isClient: boolean;
  request: null | UpgradeRequestInfo;

  private _ws: EmittableWebSocket & WithSocket;
  private _seq: number;

  private _connectStates: Map<string, number>;
  private _handshakeTimeouts: Map<string, TimeoutID>;

  constructor(wsSocket: EmittableWebSocket, request?: UpgradeRequestInfo) {
    super();

    this.request = request || null;
    this.isClient = !request;
    this._seq = 0;

    this._connectStates = new Map();
    this._handshakeTimeouts = new Map();

    const wss = wsSocket as EmittableWebSocket & WithSocket;
    wss.socket = this;

    wss.on('message', handleWsMessage);
    wss.on('open', handleWsOpen);
    wss.on('close', handleWsClose);
    wss.on('error', handleWsError);
    this._ws = wss;
  }

  getConnectedIds(): string[] {
    const ids: string[] = [];

    for (const [id, status] of this._connectStates) {
      if (status === STATE_CONNECTED_OK) {
        ids.push(id);
      }
    }

    return ids;
  }

  readyState(): number {
    return this._ws.readyState;
  }

  isConnected(connectionId: string): boolean {
    const state = this._connectStates.get(connectionId);
    return this._ws.readyState === SOCKET_OPEN && state === STATE_CONNECTED_OK;
  }

  isConnecting(connectionId: string): boolean {
    const state = this._connectStates.get(connectionId);
    return (
      this._ws.readyState === SOCKET_OPEN &&
      state !== undefined &&
      !!(state & MASK_CONNECTING)
    );
  }

  isDisconnecting(connectionId: string): boolean {
    const state = this._connectStates.get(connectionId);
    return (
      this._ws.readyState === SOCKET_OPEN &&
      state !== undefined &&
      !!(state & MASK_DISCONNECTING)
    );
  }

  async dispatch(body: EventsBody): Promise<number> {
    const { connId } = body;

    const state = this._connectStates.get(connId);
    if (state !== STATE_CONNECTED_OK) {
      throw new SocketError(`connection [${connId}] is not connected`);
    }

    const seq = await this._send(FRAME_EVENTS, body);
    return seq;
  }

  reject(body: RejectBody): Promise<number> {
    return this._send(FRAME_REJECT, body);
  }

  async login(body: LoginBody): Promise<number> {
    if (!this.isClient) {
      throw new SocketError("can't sign in on server side");
    }

    const seq = await this._send(FRAME_LOGIN, body);
    return seq;
  }

  // initiate CONNECT handshake
  async connect(body: ConnectBody): Promise<number> {
    const { connId } = body;

    let state = this._connectStates.get(connId);
    // throw if already connected or disconnecting or waiting for CONNECT echo
    if (
      state === STATE_CONNECTED_OK ||
      (state !== undefined &&
        (state & MASK_DISCONNECTING || state & FLAG_CONNECT_SENT))
    ) {
      throw new SocketError(`connection [${connId}] is already connected`);
    }

    this._addHandshakeTimeout(connId, undefined);
    const seq = await this._send(FRAME_CONNECT, body);

    state = this._connectStates.get(connId);
    if (state !== undefined) {
      this._connectStates.set(connId, state & FLAG_CONNECT_SENT);
    } else {
      this._connectStates.set(connId, FLAG_CONNECT_SENT);
    }

    return seq;
  }

  // initiate DISCONNECT handshake
  async disconnect(body: DisconnectBody): Promise<void | number> {
    const { connId } = body;

    let state = this._connectStates.get(connId);
    if (state === undefined) {
      // throw if not even connecting
      throw new SocketError(
        `connection [${connId}] not existed or already disconnected`,
      );
    } else if (state & FLAG_DISCONNECT_SENT) {
      // return nothing while waiting for echo
      return undefined;
    }

    if (state === STATE_CONNECTED_OK) {
      this._addHandshakeTimeout(connId, undefined);
    }

    const seq = await this._send(FRAME_DISCONNECT, body);

    state = this._connectStates.get(connId);
    if (state !== undefined) {
      this._connectStates.set(connId, state | FLAG_DISCONNECT_SENT);
    }

    return seq;
  }

  ping(): void {
    this._ws.ping();
  }

  close(code?: number, reason?: string): void {
    this._ws.close(code, reason);
  }

  async _send(frame: string, body: unknown): Promise<number> {
    const { readyState } = this._ws;
    if (readyState !== SOCKET_OPEN) {
      throw new SocketError('socket is not ready');
    }

    this._seq += 1;
    const seq = this._seq;

    const packet = JSON.stringify([frame, seq, body]);

    await thenifiedly.callMethod('send', this._ws, packet);
    return seq;
  }

  _emitError(err: Error): void {
    this.emit('error', err, this);
  }

  _emitEvent(body: EventsBody, seq: number): void {
    this.emit('events', body, seq, this);
  }

  _emitReject(body: RejectBody, seq: number): void {
    this.emit('reject', body, seq, this);
  }

  _emitLogin(body: LoginBody, seq: number): void {
    this.emit('login', body, seq, this);
  }

  _emitConnect(body: ConnectBody, seq: number): void {
    this.emit('connect', body, seq, this);
  }

  _emitConnectFail(body: DisconnectBody, seq?: number): void {
    this.emit('connect_fail', body, seq, this);
  }

  _emitDisconnect(body: DisconnectBody, seq?: number): void {
    this.emit('disconnect', body, seq, this);
  }

  _emitOpen(): void {
    this.emit('open', this);
  }

  _emitClose(code: number, reason: string): void {
    for (const [connId, state] of this._connectStates.entries()) {
      if (state === STATE_CONNECTED_OK || state & MASK_DISCONNECTING) {
        this._emitDisconnect({ connId, reason });
      } else if (state & MASK_CONNECTING) {
        this._emitConnectFail({ connId, reason });
      }
    }

    for (const timeoutId of this._handshakeTimeouts.values()) {
      clearTimeout(timeoutId);
    }

    this._connectStates.clear();
    this._handshakeTimeouts.clear();

    this.emit('close', code, reason, this);
  }

  async _handlePacket(data: string): Promise<void> {
    const [frameType, seq, body] = JSON.parse(data);

    this._seq = seq + 1;

    if (frameType === FRAME_EVENTS) {
      await this._handleEvents(body, seq);
    } else if (frameType === FRAME_REJECT) {
      this._emitReject(body, seq);
    } else if (frameType === FRAME_LOGIN) {
      await this._handleLogin(body, seq);
    } else if (frameType === FRAME_CONNECT) {
      await this._handleConnect(body, seq);
    } else if (frameType === FRAME_DISCONNECT) {
      await this._handleDisconnect(body, seq);
    } else {
      await this.reject({ seq, reason: 'unknown frame type' });
    }
  }

  async _handleEvents(body: EventsBody, seq: number): Promise<void> {
    const { connId } = body;

    const state = this._connectStates.get(connId);
    if (
      state === STATE_CONNECTED_OK ||
      // accept when DISCONNECT sent but not yet echoed back
      (state !== undefined &&
        !(state & MASK_CONNECTING) &&
        !(state & FLAG_DISCONNECT_RECEIVED))
    ) {
      this._emitEvent(body, seq);
    } else {
      await this.reject({ seq, reason: 'connection is not connected' });
    }
  }

  async _handleLogin(body: LoginBody, seq: number): Promise<void> {
    if (this.isClient) {
      await this.reject({
        seq,
        reason: "can't sign in to client",
      });
    } else {
      this._emitLogin(body, seq);
    }
  }

  async _handleConnect(body: ConnectBody, seq: number): Promise<void> {
    const { connId } = body;

    const state = this._connectStates.get(connId);
    if (state === undefined) {
      // handle fresh connect initiation
      this._connectStates.set(connId, FLAG_CONNECT_RECEIVED);
      if (this.isClient) {
        // confirm at client side
        await this.connect({ connId, seq });

        this._accomplishConnect(body, seq);
      } else {
        // reject initiating connect handshake from client
        await this.disconnect({
          connId,
          seq,
          reason: 'initiate connect handshake from client is not allowed',
        });

        this._connectStates.delete(connId);
      }
    } else if (state & FLAG_CONNECT_SENT && !(state & MASK_DISCONNECTING)) {
      // CONNECT confirmed, set as connected
      this._accomplishConnect(body, seq);
    } else {
      // if disconnecting while connecting, add flag and do nothing
      this._connectStates.set(connId, state | FLAG_CONNECT_RECEIVED);
    }
  }

  async _handleDisconnect(body: DisconnectBody, seq: number): Promise<void> {
    const { connId } = body;

    const state = this._connectStates.get(connId);
    if (state === undefined) {
      // reject if not even start connecting
      await this.reject({
        seq,
        reason: 'connection is not connected',
      });
    } else if (state & FLAG_DISCONNECT_SENT || state & MASK_CONNECTING) {
      // DISCONNECT confirmed, remove state
      this._accomplishDisconnect(body, seq);
    } else {
      // echo back to finish handshake
      this._connectStates.set(connId, state | FLAG_DISCONNECT_RECEIVED);
      await this.disconnect({ connId, seq, reason: 'echo' });
      this._accomplishDisconnect(body, seq);
    }
  }

  _outdateHandshakeCallback = this._outdateHandshake.bind(this);

  _outdateHandshake(connId: string, seq?: number): void {
    const state = this._connectStates.get(connId);
    if (state !== undefined && state !== STATE_CONNECTED_OK) {
      this._connectStates.delete(connId);

      const reason = 'handshake timeout';
      if (state & MASK_CONNECTING) {
        this._emitConnectFail({ connId, seq, reason }, seq);
      } else {
        this._emitDisconnect({ connId, seq, reason }, seq);
      }
    }

    this._handshakeTimeouts.delete(connId);
  }

  _addHandshakeTimeout(connectionId: string, seq?: number): void {
    if (this._handshakeTimeouts.has(connectionId)) {
      return;
    }

    const state = this._connectStates.get(connectionId);
    if (state !== undefined) {
      this._connectStates.set(connectionId, state | FLAG_OUTDATING);
    }

    const timeoutId = setTimeout(
      this._outdateHandshakeCallback,
      HANDSHAKE_TIMEOUT,
      connectionId,
      seq,
    );
    this._handshakeTimeouts.set(connectionId, timeoutId);
  }

  _accomplishConnect(body: ConnectBody, seq: number): void {
    this._emitConnect(body, seq);

    const { connId } = body;
    this._connectStates.set(connId, STATE_CONNECTED_OK);

    const timeoutId = this._handshakeTimeouts.get(connId);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      this._handshakeTimeouts.delete(connId);
    }
  }

  _accomplishDisconnect(body: DisconnectBody, seq?: number): void {
    const { connId } = body;
    const state = this._connectStates.get(connId);

    if (state === undefined || state & MASK_CONNECTING) {
      this._emitConnectFail(body, seq);
    } else {
      this._emitDisconnect(body, seq);
    }

    this._connectStates.delete(connId);

    const timeoutId = this._handshakeTimeouts.get(connId);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      this._handshakeTimeouts.delete(connId);
    }
  }
}

export default Socket;
