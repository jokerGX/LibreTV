import { describe, expect, it } from 'vitest';
import { downloadProgressStatus, recoverDownloadStatus } from './download-state';

describe('download recovery after page reload', () => {
  it.each(['waiting', 'downloading', 'processing', 'ready'] as const)(
    'makes interrupted %s tasks resumable instead of claiming a live worker or saved file', (status) => {
      expect(recoverDownloadStatus(status)).toBe('paused');
    }
  );
  it.each(['paused', 'completed', 'error'] as const)('preserves %s records', (status) => {
    expect(recoverDownloadStatus(status)).toBe(status);
  });
  it('does not claim completion merely because the last segment or file generation finished', () => {
    expect(downloadProgressStatus('downloading')).toBe('downloading');
    expect(downloadProgressStatus('processing')).toBe('processing');
    expect(downloadProgressStatus('done')).toBe('processing');
    expect(downloadProgressStatus('error')).toBe('error');
  });
});
