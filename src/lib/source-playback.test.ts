import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { getPlaybackStatus, orderPlaybackSources } from './source-playback';
import { PlaybackStatusBadge } from '../components/playback-status-badge';
import { aggregateResults } from '../components/video-card';
import verifiedSources from '../../public/verified-sources.json';
import searchSources from '../../public/api-sources.json';

const verifiedUrl = verifiedSources.sources[0].url;
const pendingUrl = searchSources.sources.find((s) => !verifiedSources.sources.some((v) => v.url === s.url))!.url;

describe('播放抽查状态与来源优先级', () => {
  it('同一接口的尾斜杠不影响状态，未知或缺失地址不冒充已验证', () => {
    expect(getPlaybackStatus(verifiedUrl + '/')).toBe('verified');
    expect(getPlaybackStatus(pendingUrl)).toBe('pending');
    expect(getPlaybackStatus('https://example.com/api.php/provide/vod')).toBeUndefined();
    expect(getPlaybackStatus(undefined)).toBeUndefined();
  });

  it('晚到的已验证来源排前面，待验证结果仍保留且同等级保持返回顺序', () => {
    const early = { id: 'early', sourceUrl: pendingUrl };
    const custom = { id: 'custom', sourceUrl: 'https://example.com/api.php/provide/vod' };
    const later = { id: 'later', sourceUrl: verifiedUrl };
    const original = [early, custom, later];
    expect(orderPlaybackSources(original)).toEqual([later, early, custom]);
    expect(original).toEqual([early, custom, later]);
    expect(orderPlaybackSources([early])).toEqual([early]);
  });

  it('新增来源返回时同名同年份卡片的标识保持稳定', () => {
    const early = { sourceKey: 'early', sourceName: '待验证源', vodId: '1', name: '测试影片', year: '2024', sourceUrl: pendingUrl };
    const later = { ...early, sourceKey: 'later', sourceName: '已验证源', vodId: '2', sourceUrl: verifiedUrl };
    expect(aggregateResults([early])[0].key).toBe(aggregateResults([early, later])[0].key);
    expect(aggregateResults([early, later])[0].items).toHaveLength(2);
  });

  it('实际渲染两种标注，自定义未知源不显示未经证实的标注', () => {
    expect(renderToStaticMarkup(createElement(PlaybackStatusBadge, { url: verifiedUrl }))).toContain('播放已验证');
    expect(renderToStaticMarkup(createElement(PlaybackStatusBadge, { url: pendingUrl }))).toContain('播放待验证');
    expect(renderToStaticMarkup(createElement(PlaybackStatusBadge, { url: 'https://example.com' }))).toBe('');
  });
});
