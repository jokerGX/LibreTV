#!/usr/bin/env python3
"""Probe reviewed public CMS APIs; export only sources whose sample HLS works.

No credentials, third-party proxy, or disabled TLS verification are used.
Run: python3 scripts/check-sources.py [candidate-file] [output-directory]
"""
import concurrent.futures
import datetime
import ipaddress
import json
import pathlib
import socket
import sys
import time
import urllib.parse
import urllib.request

TIMEOUT = 8
MAX_BODY = 4 * 1024 * 1024
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36', 'Accept': 'application/json, */*'}


def public_url(url):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('invalid public HTTP URL')
    addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == 'https' else 80), type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
        raise ValueError('private/reserved address rejected')
    return url


class PublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def request(url, limit=MAX_BODY, ranged=False):
    public_url(url)
    headers = dict(HEADERS)
    if ranged:
        headers['Range'] = 'bytes=0-1023'
    opener = urllib.request.build_opener(PublicRedirect())
    start = time.monotonic()
    with opener.open(urllib.request.Request(url, headers=headers), timeout=TIMEOUT) as response:
        body = response.read(limit + (0 if ranged else 1))
        if not ranged and len(body) > limit:
            raise ValueError('response exceeds size limit')
        return body, response.geturl(), round((time.monotonic() - start) * 1000)


def cms(url, **params):
    query = urllib.parse.urlencode(params)
    body, final, ms = request(url + ('&' if '?' in url else '?') + query)
    data = json.loads(body.decode('utf-8-sig'))
    if not isinstance(data, dict) or 'list' not in data or (data['list'] is not None and not isinstance(data['list'], list)):
        raise ValueError('not an Apple CMS JSON list')
    if data.get('code') not in (None, 1, '1'):
        raise ValueError('CMS error response')
    if data['list'] is None:
        data['list'] = []
    return data, ms


def episode_urls(vod):
    groups = []
    for group in str(vod.get('vod_play_url', '')).split('$$$'):
        urls = [ep.split('$')[1] for ep in group.split('#') if '$' in ep and ep.split('$')[1].startswith(('https://', 'http://'))]
        if urls:
            groups.append(urls)
    return next((g for g in groups if any('.m3u8' in u for u in g)), groups[0] if groups else [])


def hls(url, depth=0):
    if depth > 3:
        raise ValueError('HLS nesting limit')
    body, final, _ = request(url)
    text = body.decode('utf-8-sig').strip()
    if not text.startswith('#EXTM3U'):
        raise ValueError('not an HLS playlist')
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if '#EXT-X-STREAM-INF:' in text:
        index = next(i for i, line in enumerate(lines) if line.startswith('#EXT-X-STREAM-INF:'))
        child = next(line for line in lines[index + 1:] if not line.startswith('#'))
        return hls(urllib.parse.urljoin(final, child), depth + 1)
    if not any(line.startswith('#EXTINF:') for line in lines):
        raise ValueError('no media segments')
    # A working encrypted playlist also needs an accessible key.
    for line in lines:
        if line.startswith('#EXT-X-KEY:') and 'METHOD=NONE' not in line:
            import re
            match = re.search(r'URI="([^"]+)"', line)
            if not match:
                raise ValueError('missing HLS key URI')
            key, _, _ = request(urllib.parse.urljoin(final, match.group(1)), limit=4096)
            if not key:
                raise ValueError('empty HLS key')
    media = next(line for line in lines if not line.startswith('#'))
    segment, segment_url, _ = request(urllib.parse.urljoin(final, media), limit=1024, ranged=True)
    if not segment or segment.lstrip().lower().startswith((b'<!doctype', b'<html', b'{"error')):
        raise ValueError('empty/non-media segment')
    return {'playlistUrl': final, 'segmentUrl': segment_url, 'segmentBytes': len(segment)}


def probe(source):
    row = dict(source, apiOk=False, searchOk=False, detailOk=False, playbackOk=False)
    started = time.monotonic()
    try:
        data, ms = cms(source['url'], ac='videolist', pg=1)
        row.update(apiOk=True, apiMs=ms, total=data.get('total'))
        # Common broad keywords cover drama, animation, films and short series.
        search_errors = []
        for keyword in ('龙', '爱', 'test'):
            try:
                result, ms = cms(source['url'], ac='videolist', wd=keyword, pg=1)
            except Exception as exc:
                search_errors.append(str(exc))
                continue
            matches = [v for v in result['list'] if isinstance(v, dict) and keyword.lower() in str(v.get('vod_name', '')).lower() and v.get('vod_id') is not None]
            if matches:
                row.update(searchOk=True, keyword=keyword, searchMs=ms, searchCount=len(matches))
                break
        if not row['searchOk']:
            raise ValueError('no relevant search results: ' + '; '.join(search_errors))
        sample_errors = []
        # Include recent entries so stale episodes in a search result do not
        # incorrectly disqualify an otherwise usable catalogue.
        samples = matches[:2] + [v for v in data['list'][:2] if isinstance(v, dict) and v.get('vod_id') is not None]
        samples = list({str(s['vod_id']): s for s in samples}.values())
        passed_samples = []
        for sample in samples:
            try:
                detail, _ = cms(source['url'], ac='videolist', ids=sample['vod_id'])
                items = [v for v in detail['list'] if isinstance(v, dict) and str(v.get('vod_id')) == str(sample['vod_id'])]
                if not items:
                    raise ValueError('detail ID mismatch')
                urls = episode_urls(items[0])
                if not urls or '.m3u8' not in urls[0]:
                    raise ValueError('no compatible HLS episode')
                row.update(detailOk=True, sampleId=str(sample['vod_id']), sampleTitle=str(sample.get('vod_name', '')))
                evidence = hls(urls[0])
                passed_samples.append(dict(evidence, sampleId=str(sample['vod_id']), sampleTitle=str(sample.get('vod_name', ''))))
                row.update(evidence)
                if len(passed_samples) >= 2:
                    break
            except Exception as exc:
                sample_errors.append(str(exc))
        row['playbackSamples'] = passed_samples
        row['playbackOk'] = len(passed_samples) >= 2
        if not row['playbackOk']:
            raise ValueError('fewer than two playable titles: ' + '; '.join(sample_errors))
    except Exception as exc:
        row['error'] = str(exc)
    row['elapsedMs'] = round((time.monotonic() - started) * 1000)
    print('PROBE ' + json.dumps(row, ensure_ascii=False), flush=True)
    return row


def main():
    input_path = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'data/source-candidates.json')
    output = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else 'source-check-output')
    candidates = json.loads(input_path.read_text())['sources']
    unique = {item['url'].rstrip('/'): dict(item, url=item['url'].rstrip('/')) for item in candidates}
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        rows = list(pool.map(probe, unique.values()))
    working = sorted((r for r in rows if r['playbackOk']), key=lambda r: r.get('searchMs', 999999))
    sources = [{k: r[k] for k in ('name', 'url', 'detail') if k in r} for r in working]
    report = {'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'location': 'GitHub Actions ubuntu-latest; deployment-network results may differ', 'tested': len(rows), 'apiPassed': sum(r['apiOk'] for r in rows), 'searchPassed': sum(r['searchOk'] for r in rows), 'playbackPassed': len(sources), 'results': rows}
    subscription = {'name': 'LibreTV 实测点播源', 'version': 2, 'sources': sources}
    api_sources = [{k: r[k] for k in ('name', 'url', 'detail') if k in r} for r in rows if r['searchOk'] and r['detailOk']]
    api_subscription = {'name': 'LibreTV 搜索详情通过（播放需部署端复测）', 'version': 2, 'sources': api_sources}
    output.mkdir(parents=True, exist_ok=True)
    (output / 'source-health.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    (output / 'verified-sources.json').write_text(json.dumps(subscription, ensure_ascii=False, indent=2) + '\n')
    (output / 'api-sources.json').write_text(json.dumps(api_subscription, ensure_ascii=False, indent=2) + '\n')
    print('SOURCE_REPORT ' + json.dumps(report, ensure_ascii=False), flush=True)
    print('VERIFIED_SOURCES ' + json.dumps(subscription, ensure_ascii=False), flush=True)
    print('API_SOURCES ' + json.dumps(api_subscription, ensure_ascii=False), flush=True)
    if not sources:
        raise SystemExit('No source passed playback checks; existing defaults must be preserved.')


if __name__ == '__main__':
    main()
