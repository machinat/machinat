import { makeClassProvider } from '@machinat/core/service';
import type {
  MachinatProfile,
  UserProfiler,
} from '@machinat/core/base/Profiler';
import type { MarshallableInstance } from '@machinat/core/base/Marshaler';
import { BotP } from './bot';
import type LineChat from './channel';
import type LineUser from './user';
import type { LineRawUserProfile } from './types';
import { LINE } from './constant';

export class LineUserProfile
  implements MachinatProfile, MarshallableInstance<LineRawUserProfile>
{
  static typeName = 'LineUserProfile';

  static fromJSONValue(data: LineRawUserProfile): LineUserProfile {
    return new LineUserProfile(data);
  }

  data: LineRawUserProfile;
  platform = LINE;
  firstName = undefined;
  lastName = undefined;
  timezone = undefined;

  constructor(data: LineRawUserProfile) {
    this.data = data;
  }

  get id(): string {
    return this.data.userId;
  }

  get name(): string {
    return this.data.displayName;
  }

  get avatarUrl(): undefined | string {
    return this.data.pictureUrl;
  }

  get languageCode(): undefined | string {
    return this.data.language;
  }

  get statusMessage(): undefined | string {
    return this.data.statusMessage;
  }

  toJSONValue(): LineRawUserProfile {
    return this.data;
  }

  // eslint-disable-next-line class-methods-use-this
  typeName(): string {
    return LineUserProfile.typeName;
  }
}

type LineGroupSummary = {
  groupId: string;
  groupName: string;
  pictureUrl: string;
};

export class LineGroupProfile
  implements MachinatProfile, MarshallableInstance<LineGroupSummary>
{
  static typeName = 'LineGroupProfile';

  static fromJSONValue(data: LineGroupSummary): LineGroupProfile {
    return new LineGroupProfile(data);
  }

  data: LineGroupSummary;
  platform = LINE;
  firstName = undefined;
  lastName = undefined;
  languageCode = undefined;
  timezone = undefined;

  constructor(data: LineGroupSummary) {
    this.data = data;
  }

  get id(): string {
    return this.data.groupId;
  }

  get name(): string {
    return this.data.groupName;
  }

  get avatarUrl(): undefined | string {
    return this.data.pictureUrl;
  }

  toJSONValue(): LineGroupSummary {
    return this.data;
  }

  // eslint-disable-next-line class-methods-use-this
  typeName(): string {
    return LineGroupProfile.typeName;
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
    const requestApi = !inChat
      ? `v2/bot/profile/${user.id}`
      : inChat.type === 'group'
      ? `v2/bot/group/${inChat.id}/member/${user.id}`
      : inChat.type === 'room'
      ? `v2/bot/room/${inChat.id}/member/${user.id}`
      : `v2/bot/profile/${user.id}`;

    const profileData: LineRawUserProfile = await this.bot.makeApiCall(
      'GET',
      requestApi
    );

    return new LineUserProfile(profileData);
  }

  /**
   * Get profile object of a group chat. Throws if a user/room chat is received.
   */
  async getGroupProfile(chat: LineChat): Promise<LineGroupProfile> {
    if (chat.type !== 'group') {
      throw new Error(`expect a group chat, got ${chat.type}`);
    }

    const groupSummary: LineGroupSummary = await this.bot.makeApiCall(
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
