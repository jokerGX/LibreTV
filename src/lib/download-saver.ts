/**
 * 下载文件的保存目标：
 * - Chromium（Edge/Chrome）：showSaveFilePicker 边下边写盘（FS Access API），
 *   必须在**用户手势内**调用（点击处理器的同步栈中）；
 * - 其余环境：生成文件后等待用户点击保存；iOS 使用系统文件分享，不自动导航到 blob URL。
 *
 * 有意不做 StreamSaver（mitm.html + SW 中转）：云平台域名下 SW 注册受限，
 * 复杂度高、收益边际——大文件场景建议直接使用 FS Access 浏览器。
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

export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

export function detectSavingCapability(): 'fs-access' | 'memory' {
  return supportsFileSystemAccess() ? 'fs-access' : 'memory';
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

export function memoryTarget(filename: string, confirmOverBytes = 500 * 1024 * 1024): SaveTarget {
  // Snapshot each chunk into a Blob as it arrives, then release the typed array.
  // This also respects byteOffset/byteLength rather than exporting an entire backing buffer.
  const chunks: Blob[] = [];
  let bytes = 0;
  let done = false;
  let file: File | undefined;
  let saving = false;
  return {
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
    },
    async save() {
      if (!file) throw new Error('文件尚未生成或已释放，请重新生成');
      if (saving) throw new Error('正在保存，请稍候');
      saving = true;
      try {
        // No await before share(): iOS requires a fresh user gesture.
        if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
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
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
}

/**
 * 选择保存目标并打开写入流。showSaveFilePicker 必须在用户手势内调用，
 * 因此本函数应在点击处理器里被 await（调用方负责）。
 * 用户取消文件选择器时抛出 UserCancelledError。
 */
export async function pickSaveTarget(filename: string, estimatedBytes?: number): Promise<SaveTarget> {
  if (supportsFileSystemAccess()) {
    try {
      // Safari 会暴露 showSaveFilePicker 之外的旧实现；直接 try/catch 兜底
      const picker = (
        window as unknown as {
          showSaveFilePicker: (opts: {
            suggestedName: string;
          }) => Promise<{ createWritable: () => Promise<WritableStream> }>;
        }
      ).showSaveFilePicker;
      const handle = await picker({ suggestedName: filename });
      const writable = await handle.createWritable();
      const writer = writable.getWriter();
      return {
        kind: 'fs',
        async write(data) {
          await writer.write(data);
        },
        async close() {
          await writer.close();
        },
        async abort() {
          try {
            await writer.abort();
          } catch { /* 已关闭则忽略 */ }
        },
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new UserCancelledError();
      }
      // 文件选择失败（权限/环境）→ 落到内存聚合
    }
  }
  if (estimatedBytes && estimatedBytes > 500 * 1024 * 1024) {
    if (!window.confirm('该视频体积较大（未提供磁盘直写能力的环境），将暂存在内存中，可能导致页面卡顿。是否继续？')) {
      throw new UserCancelledError();
    }
  }
  return memoryTarget(filename);
}
