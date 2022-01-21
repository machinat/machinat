import type { MachinatChannel } from '@machinat/core';
import type { MarshallableInstance } from '@machinat/core/base/Marshaler';
import { TELEGRAM } from './constant';
import type { TelegramChatType, RawChat } from './types';
import type TelegramUser from './User';

type TelegramChatValue = {
  botId: number;
  type: TelegramChatType;
  id: number;
};

class TelegramChat
  implements MachinatChannel, MarshallableInstance<TelegramChatValue>
{
  static typeName = 'TelegramChat';

  static fromJSONValue(value: TelegramChatValue): TelegramChat {
    const { botId, type, id } = value;
    return new TelegramChat(botId, { id, type });
  }

  static fromUser(botId: number, user: TelegramUser): TelegramChat {
    const rawUser = user.data;
    return new TelegramChat(botId, {
      id: user.id,
      type: 'private',
      username: rawUser?.username,
      first_name: rawUser?.first_name,
      last_name: rawUser?.last_name,
    });
  }

  botId: number;
  data: RawChat;
  platform = TELEGRAM;

  constructor(botId: number, data: RawChat) {
    this.botId = botId;
    this.data = data;
  }

  /** Unique identifier for this chat. This number may be greater than 32 bits and some programming languages may have difficulty/silent defects in interpreting it. But it is smaller than 52 bits, so a signed 64 bit integer or double-precision float type are safe for storing this identifier. */
  get id(): number {
    return this.data.id;
  }

  /** Type of chat */
  get type(): TelegramChatType {
    return this.data.type;
  }

  get uid(): string {
    return `telegram.${this.botId}.${this.id}`;
  }

  toJSONValue(): TelegramChatValue {
    const { botId, id, type } = this;
    return { botId, id, type };
  }

  // eslint-disable-next-line class-methods-use-this
  typeName(): string {
    return TelegramChat.typeName;
  }
}

export default TelegramChat;
