import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEnvSources } from './env-sources';

afterEach(() => vi.unstubAllEnvs());

describe('默认点播源与部署者覆盖', () => {
  it('未配置时直接下发实测源，URL key 在重复读取时保持稳定', () => {
    vi.stubEnv('DEFAULT_SOURCES', '');
    const sources = getEnvSources();
    expect(sources.length).toBeGreaterThan(0);
    expect(new Set(sources.map((s) => s.url)).size).toBe(sources.length);
    expect(sources.every((s) => s.key.startsWith('builtin_') && s.url.startsWith('https://'))).toBe(true);
    expect(getEnvSources()).toEqual(sources);
  });

  it('部署者可以显式关闭全部预置源', () => {
    vi.stubEnv('DEFAULT_SOURCES', '[]');
    expect(getEnvSources()).toEqual([]);
  });

  it('部署者自定义配置替换内置源并保留既有 key 与归一化行为', () => {
    vi.stubEnv('DEFAULT_SOURCES', JSON.stringify([{ name: ' 自建源 ', url: 'https://example.com/api.php/provide/vod/' }]));
    expect(getEnvSources()).toEqual([{ key: 'env_0', name: '自建源', url: 'https://example.com/api.php/provide/vod', detail: undefined, isAdult: false }]);
  });
});
