import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnvLiveSources } from './env-live-sources';
import { parseM3u } from './m3u-parser';

afterEach(() => vi.unstubAllEnvs());

describe('默认直播源', () => {
  it('未配置时下发站内直播列表，并带上过滤标记', () => {
    vi.stubEnv('DEFAULT_LIVE_SOURCES', '');
    const sources = getEnvLiveSources();
    expect(sources).toEqual([
      {
        key: `builtin_live_${encodeURIComponent('/ext-live.m3u')}`,
        name: '扩展直播',
        url: '/ext-live.m3u',
        epg: undefined,
        isAdult: true,
      },
    ]);
  });

  it('显式空数组关闭预置直播源', () => {
    vi.stubEnv('DEFAULT_LIVE_SOURCES', '[]');
    expect(getEnvLiveSources()).toEqual([]);
  });

  it('内置直播列表能解析出已测通的频道', () => {
    const text = readFileSync('public/ext-live.m3u', 'utf8');
    const channels = parseM3u(text, 'https://example.com/ext-live.m3u');
    expect(channels).toHaveLength(24);
    expect(channels.every((c) => /^https?:\/\//.test(c.url) && c.url.endsWith('.m3u8'))).toBe(true);
    expect(new Set(channels.map((c) => c.url)).size).toBe(24);
  });
});
