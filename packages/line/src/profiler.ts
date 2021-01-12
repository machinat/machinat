import { makeClassProvider } from '@machinat/core/service';
import type {
  MachinatProfile,
  UserProfiler,
} from '@machinat/core/base/Profiler';
import type { Marshallable } from '@machinat/core/base/Marshaler';
import { BotP } from './bot';
import type LineChat from './channel';
import type LineUser from './user';
import type { LineRawUserProfile } from './types';
import { LINE } from './constant';

export class LineUserProfile
  implements MachinatProfile, Marshallable<LineRawUserProfile> {
  static fromJSONValue(data: LineRawUserProfile): LineUserProfile {
    return new LineUserProfile(data);
  }

  data: LineRawUserProfile;
  platform = LINE;

  constructor(data: LineRawUserProfile) {
    this.data = data;
  }

  get id(): string {
    return this.data.userId;
  }

  get name(): string {
    return this.data.displayName;
  }

  get displayName(): string {
    return this.data.displayName;
  }

  get language(): undefined | string {
    return this.data.language;
  }

  get pictureUrl(): undefined | string {
    return this.data.pictureUrl;
  }

  get statusMessage(): undefined | string {
    return this.data.statusMessage;
  }

  toJSONValue(): LineRawUserProfile {
    return this.data;
  }

  typeName(): string {
    return this.constructor.name;
  }
}

type LineGroupSummary = {
  groupId: string;
  groupName: string;
  pictureUrl: string;
};

export class LineGroupProfile
  implements MachinatProfile, Marshallable<LineGroupSummary> {
  static fromJSONValue(data: LineGroupSummary): LineGroupProfile {
    return new LineGroupProfile(data);
  }

  data: LineGroupSummary;
  platform = LINE;

  get id(): string {
    return this.data.groupId;
  }

  get name(): string {
    return this.data.groupName;
  }

  get pictureUrl(): undefined | string {
    return this.data.pictureUrl;
  }

  constructor(data: LineGroupSummary) {
    this.data = data;
  }

  toJSONValue(): LineGroupSummary {
    return this.data;
  }

  typeName(): string {
    return this.constructor.name;
  }
}

type GetUserProfileOptions = {
  inChat?: LineChat;
};

/**
 * @category Provider
 */
export class LineProfiler implements UserProfiler<LineUser> {
  bot: BotP;

  constructor(bot: BotP) {
    this.bot = bot;
  }

  async getUserProfile(
    user: LineUser,
    { inChat }: GetUserProfileOptions = {}
  ): Promise<LineUserProfile> {
    let requestApi: string;
    if (inChat) {
      requestApi =
        inChat.type === 'group'
          ? `v2/bot/group/${inChat.id}/member/${user.id}`
          : inChat.type === 'room'
          ? `v2/bot/room/${inChat.id}/member/${user.id}`
          : `v2/bot/profile/${user.id}`;
    } else {
      requestApi = `v2/bot/profile/${user.id}`;
    }

    const { body: profileData } = await this.bot.dispatchAPICall(
      'GET',
      requestApi
    );

    return new LineUserProfile(profileData);
  }

  async getGroupProfile(
    chat: LineChat & { type: 'group' }
  ): Promise<LineGroupProfile> {
    if (chat.type !== 'group') {
      throw new Error(`expect a group chat, got ${chat.type}`);
    }

    const { body: groupSummary } = await this.bot.dispatchAPICall(
      'GET',
      `v2/bot/group/${chat.id}/summary`
    );

    return new LineGroupProfile(groupSummary);
  }
}

export const ProfilerP = makeClassProvider({
  lifetime: 'scoped',
  deps: [BotP] as const,
})(LineProfiler);

export type ProfilerP = LineProfiler;
