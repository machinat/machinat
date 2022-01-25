import moxy from '@moxyjs/moxy';
import { BasicProfiler, MachinatProfile } from '../Profiler';

const fooProfiler = moxy({
  getUserProfile: async () =>
    ({
      platform: 'test',
      name: 'FOO',
      avatarUrl: 'http://foo...',
    } as MachinatProfile),
});
const barProfiler = moxy({
  getUserProfile: async () =>
    ({
      platform: 'test',
      name: 'BAR',
      avatarUrl: 'http://bar...',
    } as MachinatProfile),
});

it('proxy #getUserProfile() call to the profiler corresponded to the user platform', async () => {
  const profiler = new BasicProfiler(
    new Map([
      ['foo', fooProfiler],
      ['bar', barProfiler],
    ]) as never
  );

  await expect(
    profiler.getUserProfile({ platform: 'foo', uid: 'foo1' })
  ).resolves.toEqual({
    platform: 'test',
    name: 'FOO',
    avatarUrl: 'http://foo...',
  });
  await expect(
    profiler.getUserProfile({ platform: 'bar', uid: 'bar1' })
  ).resolves.toEqual({
    platform: 'test',
    name: 'BAR',
    avatarUrl: 'http://bar...',
  });

  expect(fooProfiler.getUserProfile.mock).toHaveBeenCalledTimes(1);
  expect(fooProfiler.getUserProfile.mock).toHaveBeenCalledWith({
    platform: 'foo',
    uid: 'foo1',
  });

  expect(barProfiler.getUserProfile.mock).toHaveBeenCalledTimes(1);
  expect(barProfiler.getUserProfile.mock).toHaveBeenCalledWith({
    platform: 'bar',
    uid: 'bar1',
  });

  await expect(
    profiler.getUserProfile({ platform: 'foo', uid: 'foo2' })
  ).resolves.toEqual({
    platform: 'test',
    name: 'FOO',
    avatarUrl: 'http://foo...',
  });

  expect(fooProfiler.getUserProfile.mock).toHaveBeenCalledTimes(2);
  expect(fooProfiler.getUserProfile.mock).toHaveBeenCalledWith({
    platform: 'foo',
    uid: 'foo2',
  });
});

it('throw if user from unsupported platform received', async () => {
  const profiler = new BasicProfiler(
    new Map([
      ['foo', fooProfiler],
      ['bar', barProfiler],
    ])
  );

  await expect(
    profiler.getUserProfile({ platform: 'baz', uid: 'baz1' })
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `"user of platform 'baz' is not supported"`
  );
});
