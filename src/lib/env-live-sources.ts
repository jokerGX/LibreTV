import type { LiveSourceConfig } from './types';
import bundledLive from '../../public/live-sources.json';

/** 公网 http(s)，或站内根路径（排除 //host 与 ..） */
function isLiveSourceUrl(url: string): boolean {
  const trimmed = url.trim();
  if (/^https?:\/\//.test(trimmed)) return true;
  return trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('..') && !trimmed.includes('\\');
}

/**
 * 部署者通过 DEFAULT_LIVE_SOURCES 环境变量预置的直播源（M3U 订阅）。
 * 未配置时下发内置列表。显式设置 [] 则不下发。
 * 格式为 JSON 数组：[{"name":"源名","url":"https://.../list.m3u","epg":"https://.../epg.xml.gz","isAdult":false}]
 * url 也可以是站内绝对路径（如 /adult-live.m3u），客户端会补成当前站点地址后再拉取。
 * 解析失败时告警并整体忽略，不影响站点运行。
 */
export function getEnvLiveSources(): LiveSourceConfig[] {
  const raw = process.env.DEFAULT_LIVE_SOURCES;
  const useBundled = !raw || !raw.trim();
  try {
    const parsed: unknown = useBundled ? bundledLive.sources : JSON.parse(raw!);
    if (!Array.isArray(parsed)) throw new Error('必须是 JSON 数组');
    const list: LiveSourceConfig[] = parsed.map((item, i) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`第 ${i + 1} 项不是对象`);
      }
      const { name, url, epg, isAdult } = item as Record<string, unknown>;
      if (typeof name !== 'string' || !name.trim()) {
        throw new Error(`第 ${i + 1} 项缺少 name`);
      }
      if (typeof url !== 'string' || !isLiveSourceUrl(url)) {
        throw new Error(`第 ${i + 1} 项的 url 必须以 http://、https:// 或 / 开头`);
      }
      const normalized = url.trim().replace(/\/+$/, '');
      return {
        key: useBundled ? `builtinlive_${encodeURIComponent(normalized)}` : `envlive_${i}`,
        name: name.trim(),
        url: normalized,
        epg: typeof epg === 'string' && epg.trim() ? epg.trim() : undefined,
        isAdult: isAdult === true,
      };
    });
    return list;
  } catch (err) {
    console.warn('[LibreTV] DEFAULT_LIVE_SOURCES 解析失败，已忽略：', err instanceof Error ? err.message : err);
    return [];
  }
}
