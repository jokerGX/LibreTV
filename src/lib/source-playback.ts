import verifiedSources from '../../public/verified-sources.json';
import searchSources from '../../public/api-sources.json';

export type PlaybackStatus = 'verified' | 'pending';

export function normalizeSourceUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

const verifiedUrls = new Set(verifiedSources.sources.map((s) => normalizeSourceUrl(s.url)));
const knownUrls = new Set(searchSources.sources.map((s) => normalizeSourceUrl(s.url)));

/** 历史播放抽查状态；搜索探活成功不会自动升级为播放已验证。 */
export function getPlaybackStatus(url: string | undefined): PlaybackStatus | undefined {
  if (!url) return undefined;
  const normalized = normalizeSourceUrl(url);
  if (verifiedUrls.has(normalized)) return 'verified';
  if (knownUrls.has(normalized)) return 'pending';
  return undefined;
}

/** 同一影片内优先展示已验证来源；不丢弃其他结果，同等级保持返回顺序。 */
export function orderPlaybackSources<T extends { sourceUrl?: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) =>
    Number(getPlaybackStatus(b.sourceUrl) === 'verified') -
    Number(getPlaybackStatus(a.sourceUrl) === 'verified')
  );
}
