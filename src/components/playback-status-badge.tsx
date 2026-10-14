import React from 'react';
import { getPlaybackStatus } from '@/lib/source-playback';

export function PlaybackStatusBadge({ url }: { url?: string }) {
  const status = getPlaybackStatus(url);
  if (!status) return null;
  const verified = status === 'verified';
  return (
    <span
      className={`ml-1.5 inline-block shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] align-middle ${verified ? 'bg-accent/10 text-accent' : 'bg-warning/10 text-warning'}`}
      title={verified ? '该接口已通过影片播放抽查' : '搜索和详情已通过，播放尚未确认可用'}
    >
      {verified ? '播放已验证' : '播放待验证'}
    </span>
  );
}
