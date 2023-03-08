export const LINE = 'line' as const;

export const PATH_REPLY = 'v2/bot/message/reply';

export const PATH_PUSH = 'v2/bot/message/push';

export const PATH_MULTICAST = 'v2/bot/message/multicast';

export const PATH_RICHMENU = 'v2/bot/richmenu';

export enum LiffOs {
  Ios,
  Android,
  Web,
}

export enum LiffReferer {
  Utou,
  Group,
  Room,
  External,
  None,
}
