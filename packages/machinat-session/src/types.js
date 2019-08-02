// @flow
import type { MachinatChannel } from 'machinat-base/types';

export interface Session {
  get<T>(key: string): Promise<void | T>;
  set<T>(key: string, state: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  update<T>(key: string, (state: void | T) => void | T): Promise<void>;
  clear(): Promise<void>;
}

export interface SessionStore {
  getSession(channel: MachinatChannel): Session;
}
