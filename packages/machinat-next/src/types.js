// @flow
import type { IncomingMessage, ServerResponse } from 'http';
import type { BotPlugin } from 'machinat-base/types';

export type NextMetadata = {|
  source: 'next',
  request: {|
    method: string,
    url: string,
    headers: {| [string]: string |},
    encrypted: boolean,
  |},
|};

export type NextPesponse = void | {
  page: string,
  query: {| [string]: any |},
};

export type NextEvent = {|
  platform: 'next',
  type: 'request',
  payload: {
    req?: IncomingMessage,
    res?: ServerResponse,
  },
|};

export type NextChannel = {|
  platform: string,
  type: string,
  uid: string,
|};

export type NextPlugin = BotPlugin<
  NextChannel,
  NextEvent,
  NextMetadata,
  NextPesponse,
  void,
  any,
  void,
  void
>;

export type NextBotOptions = {|
  nextApp: any,
  noPrepare?: boolean,
  basePath?: string,
  plugins?: NextPlugin[],
|};
