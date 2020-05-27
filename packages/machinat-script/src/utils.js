// @flow
import invariant from 'invariant';
import { MACHINAT_SCRIPT_TYPE } from './constant';
import * as KEYWORDS from './keyword';
import type { CallStatus, SerializedCallStatus } from './types';

const keyworsSymbols = Object.values(KEYWORDS);
export const isKeyword = (type: any) => keyworsSymbols.includes(type);

export const isScript = (type: any): boolean %checks =>
  typeof type === 'object' && type.$$typeof === MACHINAT_SCRIPT_TYPE;

export const serializeScriptStatus = <Vars, Input, ReturnValue>({
  script,
  stoppedAt,
  vars,
}: CallStatus<Vars, Input, ReturnValue>): SerializedCallStatus<Vars> => {
  invariant(
    stoppedAt,
    'call status is not stopped at any break point when serialize'
  );

  return {
    name: script.name,
    stoppedAt,
    vars,
  };
};

export const counter = (begin?: number = 0) => {
  let n = begin;
  return () => n++; // eslint-disable-line no-plusplus
};
