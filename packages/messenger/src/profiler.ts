import { makeClassProvider } from '@machinat/core/service';
import type {
  MachinatProfile,
  UserProfiler,
} from '@machinat/core/base/Profiler';
import type { MarshallableInstance } from '@machinat/core/base/Marshaler';
import { BotP } from './bot';
import type MessengerUser from './user';
import type { RawUserProfile } from './types';
import { ConfigsI } from './interface';
import { MESSENGER } from './constant';
import GraphApiError from './error';

export class MessengerUserProfile
  implements MachinatProfile, MarshallableInstance<RawUserProfile>
{
  static typeName = 'MessengerUserProfile';

  static fromJSONValue(data: RawUserProfile): MessengerUserProfile {
    return new MessengerUserProfile(data);
  }

  data: RawUserProfile;
  platform = MESSENGER;

  constructor(data: RawUserProfile) {
    this.data = data;
  }

  get id(): string {
    return this.data.id;
  }

  get name(): string {
    return this.data.name;
  }

  get firstName(): string {
    return this.data.first_name;
  }

  get lastName(): string {
    return this.data.last_name;
  }

  get avatarUrl(): string {
    return this.data.profile_pic;
  }

  get locale(): undefined | string {
    return this.data.locale;
  }

  get timezone(): undefined | number {
    return this.data.timezone;
  }

  get gender(): undefined | string {
    return this.data.gender;
  }

  toJSONValue(): RawUserProfile {
    return this.data;
  }

  // eslint-disable-next-line class-methods-use-this
  typeName(): string {
    return MessengerUserProfile.typeName;
  }
}

const DEFAULT_PROFILE_FIELDS = [
  'id',
  'name',
  'first_name',
  'last_name',
  'profile_pic',
];

type ProfilerOptions = {
  optionalProfileFields?: ('locale' | 'timezone' | 'gender')[];
};

/**
 * MessengerProfiler fetch user profile from Messenger platform.
 * @category Provider
 */
export class MessengerProfiler implements UserProfiler<MessengerUser> {
  bot: BotP;
  profileFields: string;

  constructor(bot: BotP, { optionalProfileFields = [] }: ProfilerOptions = {}) {
    this.bot = bot;
    this.profileFields = [
      ...optionalProfileFields,
      ...DEFAULT_PROFILE_FIELDS,
    ].join(',');
  }

  async getUserProfile(
    user: MessengerUser
  ): Promise<null | MessengerUserProfile> {
    let rawProfile: RawUserProfile;

    try {
      rawProfile = await this.bot.makeApiCall(
        'GET',
        `${user.id}?fields=${this.profileFields}`
      );
    } catch (err) {
      if (err instanceof GraphApiError) {
        const errSubCode = err.info.error_subcode;
        if (errSubCode === 2018218) {
          // can't get porfile from user login with phone number
          // https://developers.facebook.com/docs/messenger-platform/identity/user-profile#profile_unavailable
          return null;
        }
      }
      throw err;
    }

    return new MessengerUserProfile(rawProfile);
  }
}

export const ProfilerP = makeClassProvider({
  lifetime: 'scoped',
  deps: [BotP, ConfigsI] as const,
})(MessengerProfiler);

export type ProfilerP = MessengerProfiler;
