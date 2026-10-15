import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnvLiveSources } from './env-live-sources';

afterEach(() => vi.unstubAllEnvs());

describe('默认直播源', () => {
  it('未配置时下发内置直播列表，重复读取 key 不变', () => {
    vi.stubEnv('DEFAULT_LIVE_SOURCES', '');
    const list = getEnvLiveSources();
    expect(list.map((s) => [s.name, s.isAdult, s.url])).toEqual([
      ['央视频道', false, 'https://raw.githubusercontent.com/best-fan/iptv-sources/main/cn_cctv.m3u8'],
      ['卫视频道', false, 'https://raw.githubusercontent.com/best-fan/iptv-sources/main/cn_province.m3u8'],
      ['成人直播', true, '/adult-live.m3u'],
    ]);
    expect(list.every((s) => s.key.startsWith('builtinlive_'))).toBe(true);
    expect(getEnvLiveSources()).toEqual(list);
  });

  it('站内路径可用，协议相对地址和目录穿越会被整表忽略', () => {
    vi.stubEnv('DEFAULT_LIVE_SOURCES', JSON.stringify([{ name: '站内', url: '/lists/live.m3u' }]));
    expect(getEnvLiveSources()[0]?.url).toBe('/lists/live.m3u');
    vi.stubEnv('DEFAULT_LIVE_SOURCES', JSON.stringify([{ name: '坏', url: '//evil.example/list.m3u' }]));
    expect(getEnvLiveSources()).toEqual([]);
    vi.stubEnv('DEFAULT_LIVE_SOURCES', JSON.stringify([{ name: '坏', url: '/../secret.m3u' }]));
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
