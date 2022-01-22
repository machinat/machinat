import type { MachinatUser } from '../types';
import { makeInterface, makeClassProvider } from '../service';

export interface MachinatProfile {
  readonly platform: string;
  readonly name: string;
  readonly avatarUrl: undefined | string;
  readonly firstName: undefined | string;
  readonly lastName: undefined | string;
  readonly languageCode: undefined | string;
  readonly timeZone: undefined | number;
  data: any;
}

export interface UserProfiler<User extends MachinatUser> {
  getUserProfile(user: User): Promise<null | MachinatProfile>;
}

/**
 * @category Base
 */
export class BaseProfiler implements UserProfiler<MachinatUser> {
  static PlatformMap = makeInterface<UserProfiler<MachinatUser>>({
    name: 'ProfilerPlatformMap',
    polymorphic: true,
  });

  private _platformMapping: Map<string, UserProfiler<MachinatUser>>;

  constructor(platformMapping: Map<string, UserProfiler<MachinatUser>>) {
    this._platformMapping = platformMapping;
  }

  async getUserProfile(user: MachinatUser): Promise<null | MachinatProfile> {
    const profiler = this._platformMapping.get(user.platform);
    if (!profiler) {
      throw new TypeError(
        `user of platform '${user.platform}' is not supported`
      );
    }

    return profiler.getUserProfile(user);
  }
}

const ProfilerP = makeClassProvider({
  lifetime: 'transient',
  deps: [BaseProfiler.PlatformMap],
})(BaseProfiler);

type ProfilerP = UserProfiler<MachinatUser>;

export default ProfilerP;
