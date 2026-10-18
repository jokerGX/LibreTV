/**
 * 下载文件的保存目标：
 * - 电脑：生成文件后交给浏览器下载，遵循浏览器默认目录及询问设置。
 * - 手机/平板：等待用户点击保存；iOS 使用系统文件分享，不自动导航到 blob URL。
 */

export interface SaveTarget {
  /** 'fs' = 磁盘直写；'memory' = 内存聚合 */
  kind: 'fs' | 'memory';
  /** 生成后仍需用户点击保存的文件；不能把生成成功当成已保存。 */
  readonly file?: File;
  /** 必须在用户点击的同步调用栈中调用，保留系统分享所需的用户手势。 */
  save?(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export type SavingCapability = 'automatic' | 'manual';

export function detectSavingCapability(): SavingCapability {
  if (typeof navigator === 'undefined') return 'manual';
  const mobileHint = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;
  const mobile = mobileHint === true || /Android|iPad|iPhone|iPod/i.test(navigator.userAgent) || isIOS();
  return mobile ? 'manual' : 'automatic';
}

export class UserCancelledError extends Error {
  constructor() {
    super('用户取消了保存');
  }
}

function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function memoryTarget(filename: string, confirmOverBytes = 500 * 1024 * 1024, automatic = false): SaveTarget {
  // Snapshot each chunk into a Blob as it arrives, then release the typed array.
  // This also respects byteOffset/byteLength rather than exporting an entire backing buffer.
  const chunks: Blob[] = [];
  let bytes = 0;
  let done = false;
  let file: File | undefined;
  let saving = false;
  const target: SaveTarget = {
    kind: 'memory',
    get file() { return file; },
    async write(data) {
      if (done) return;
      bytes += data.byteLength;
      if (bytes > confirmOverBytes && bytes - data.byteLength <= confirmOverBytes) {
        if (!window.confirm(`下载体积已超过 ${Math.round(confirmOverBytes / 1024 / 1024)}MB，继续将暂存在内存中，可能导致页面卡顿。是否继续？`)) {
          throw new Error('用户取消了下载（内存超限）');
        }
      }
      chunks.push(new Blob([data as Uint8Array<ArrayBuffer>]));
    },
    async close() {
      if (done) return;
      done = true;
      file = new File(chunks, filename, { type: /\.mp4$/i.test(filename) ? 'video/mp4' : 'video/mp2t' });
      chunks.length = 0;
      if (automatic) await target.save!();
    },
    async save() {
      if (!file) throw new Error('文件尚未生成或已释放，请重新生成');
      if (saving) throw new Error('正在保存，请稍候');
      saving = true;
      try {
        // No await before share(): iOS requires a fresh user gesture.
        if (!automatic && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
        } else {
          if (isIOS()) {
            throw new Error('当前浏览器无法分享这个文件，请使用 Safari 普通标签页重试，或在电脑上下载');
          }
          const url = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          // If the browser ignores download, never replace the working app with a blob page.
          a.target = '_blank';
          a.rel = 'noopener';
          document.body.appendChild(a);
          try {
            a.click();
          } finally {
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
          }
        }
        file = undefined;
      } finally {
        // Cancelled/failed sharing retains the file so the button can be tried again.
        saving = false;
      }
    },
    async abort() {
      done = true;
      chunks.length = 0;
      file = undefined;
    },
  };
  return target;
}

/**
 * 电脑不调用文件选择器；完成后由浏览器按其下载设置保存。
 * 手机保留用户手势内的显式分享/保存操作。
 */
export async function pickSaveTarget(filename: string, estimatedBytes?: number): Promise<SaveTarget> {
  if (estimatedBytes && estimatedBytes > 500 * 1024 * 1024) {
    if (!window.confirm('该视频体积较大，生成文件需要暂存，可能占用较多内存。是否继续？')) {
      throw new UserCancelledError();
    }
  }
  return memoryTarget(filename, undefined, detectSavingCapability() === 'automatic');
}
