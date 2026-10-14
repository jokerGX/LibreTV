import type { SourceConfig } from './types';
import verifiedSources from '../../public/verified-sources.json';

/**
 * 部署者通过 DEFAULT_SOURCES 环境变量预置的采集站。
 * 未配置时使用本 fork 中经过搜索、详情与播放分片检测的源列表。
 * 显式设置 [] 可关闭默认源；部署者配置始终优先。
 * 格式为 JSON 数组：[{"name":"源名","url":"https://.../api.php/provide/vod","detail":"https://...","isAdult":false}]
 * 解析失败时告警并整体忽略，不影响站点运行。
 */
export function getEnvSources(): SourceConfig[] {
  const raw = process.env.DEFAULT_SOURCES;
  const useBundled = !raw || !raw.trim();
  try {
    const parsed: unknown = useBundled ? verifiedSources.sources : JSON.parse(raw!);
    if (!Array.isArray(parsed)) throw new Error('必须是 JSON 数组');
    const list: SourceConfig[] = parsed.map((item, i) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`第 ${i + 1} 项不是对象`);
      }
      const { name, url, detail, isAdult } = item as Record<string, unknown>;
      if (typeof name !== 'string' || !name.trim()) {
        throw new Error(`第 ${i + 1} 项缺少 name`);
      }
      if (typeof url !== 'string' || !/^https?:\/\//.test(url.trim())) {
        throw new Error(`第 ${i + 1} 项的 url 必须以 http:// 或 https:// 开头`);
      }
      return {
        // 内置源使用稳定的 URL key，更新测速排序不会改变用户勾选状态。
        key: useBundled ? `builtin_${encodeURIComponent(url.trim().replace(/\/+$/, ''))}` : `env_${i}`,
        name: name.trim(),
        url: url.trim().replace(/\/+$/, ''),
        detail: typeof detail === 'string' && detail.trim() ? detail.trim() : undefined,
        isAdult: isAdult === true,
      };
    });
    return list;
  } catch (err) {
    console.warn('[LibreTV] DEFAULT_SOURCES 解析失败，已忽略：', err instanceof Error ? err.message : err);
    return [];
  }
}
