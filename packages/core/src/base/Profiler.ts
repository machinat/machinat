import type { MachinatUser } from '../types';
import { makeInterface, makeClassProvider } from '../service';

export interface MachinatProfile {
  readonly platform: string;
  readonly name: string;
  readonly pictureUrl: undefined | string;
}

export interface UserProfiler<User extends MachinatUser> {
  getUserProfile(user: User): Promise<MachinatProfile>;
}

/**
 * @category Base
 */
export class BaseProfiler implements UserProfiler<MachinatUser> {
  static PlatformMap = makeInterface<UserProfiler<any>>({
    name: 'ProfilerPlatformMap',
    polymorphic: true,
  });

  private _platformMapping: Map<string, BaseProfiler>;

  constructor(platformMapping: Map<string, BaseProfiler>) {
    this._platformMapping = platformMapping;
  }

  async getUserProfile(user: MachinatUser): Promise<MachinatProfile> {
    const profiler = this._platformMapping.get(user.platform);
    if (!profiler) {
      throw new TypeError(
        `user of platform '${user.platform}' is not supported`
      );
    }

    return profiler.getUserProfile(user);
  }
}

export const ProfilerP = makeClassProvider({
  lifetime: 'transient',
  deps: [BaseProfiler.PlatformMap] as const,
})(BaseProfiler);

export type ProfilerP = UserProfiler<MachinatUser>;
