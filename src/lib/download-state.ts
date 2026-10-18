import type { DownloadStatus } from './db';

/** File handles, prepared files and workers do not survive a page reload. */
export function recoverDownloadStatus(status: DownloadStatus): DownloadStatus {
  return ['waiting', 'downloading', 'processing', 'ready'].includes(status) ? 'paused' : status;
}

/** A job reaching done still needs its save target checked before claiming completion. */
export function downloadProgressStatus(status: 'downloading' | 'processing' | 'done' | 'error'): DownloadStatus {
  return status === 'error' ? 'error' : status === 'downloading' ? 'downloading' : 'processing';
}
