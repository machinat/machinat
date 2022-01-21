import type { MachinatUser } from '@machinat/core';
import type { MarshallableInstance } from '@machinat/core/base/Marshaler';
import { MESSENGER } from './constant';

type MessengerUserValue = {
  pageId: number;
  psid: string;
};

export default class MessengerUser
  implements MachinatUser, MarshallableInstance<MessengerUserValue>
{
  static typeName = 'MessengerUser';

  static fromJSONValue(value: MessengerUserValue): MessengerUser {
    const { pageId, psid } = value;
    return new MessengerUser(pageId, psid);
  }

  platform = MESSENGER;
  pageId: number;
  psid: string;

  constructor(pageId: number, psid: string) {
    this.pageId = pageId;
    this.psid = psid;
  }

  get id(): string {
    return this.psid;
  }

  get uid(): string {
    return `messenger.${this.pageId}.${this.psid}`;
  }

  toJSONValue(): MessengerUserValue {
    const { pageId, psid } = this;
    return { pageId, psid };
  }

  // eslint-disable-next-line class-methods-use-this
  typeName(): string {
    return MessengerUser.typeName;
  }
}
