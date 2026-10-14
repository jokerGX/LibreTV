import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnvLiveSources } from './env-live-sources';

afterEach(() => vi.unstubAllEnvs());

describe('默认直播源', () => {
  it('未配置时不下发直播源', () => {
    vi.stubEnv('DEFAULT_LIVE_SOURCES', '');
    expect(getEnvLiveSources()).toEqual([]);
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
