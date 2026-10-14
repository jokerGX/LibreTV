import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnvLiveSources } from './env-live-sources';

afterEach(() => vi.unstubAllEnvs());

describe('默认直播源', () => {
  it('未配置时下发内置直播列表，重复读取 key 不变', () => {
    vi.stubEnv('DEFAULT_LIVE_SOURCES', '');
    const list = getEnvLiveSources();
    expect(list.map((s) => s.name)).toEqual(['央视频道', '卫视频道']);
    expect(list.every((s) => s.url.startsWith('https://') && s.key.startsWith('builtinlive_') && s.isAdult === false)).toBe(true);
    expect(getEnvLiveSources()).toEqual(list);
  });

  it('显式空数组也不下发', () => {
    vi.stubEnv('DEFAULT_LIVE_SOURCES', '[]');
    expect(getEnvLiveSources()).toEqual([]);
  });

  it('部署者配置保留过滤标记', () => {
    vi.stubEnv(
      'DEFAULT_LIVE_SOURCES',
      JSON.stringify([{ name: '列表示例', url: 'https://example.com/list.m3u/', isAdult: true }])
    );
    expect(getEnvLiveSources()).toEqual([
      {
        key: 'envlive_0',
        name: '列表示例',
        url: 'https://example.com/list.m3u',
        epg: undefined,
        isAdult: true,
      },
    ]);
  });
});
