/* eslint-disable @typescript-eslint/no-explicit-any -- mux.js 无完整类型定义 */
// @ts-expect-error - mux.js 没有完整的 TypeScript 类型定义
import muxjs from 'mux.js';
import { Mp4FileAssembler } from './mp4-file';

/**
 * MP4 转封装（基于 mux.js）。
 *
 * HLS 的 TS 分片对浏览器不可直接播放，下载产物要做 TS→fMP4 转封装：
 * mux.js 每次 flush 产出 fMP4。下载时将它们写成带完整样本索引的常规 MP4，
 * 媒体数据逐片写出，最后补 moov；无需把整集聚合在内存里。
 */

/** mux.js 写 mvhd 时用的 movie timescale（90kHz） */
const MOVIE_TIMESCALE = 90_000;
/** ISO BMFF 的「时长未知」哨兵值 */
const UNKNOWN_DURATION = 0xffffffff;

function readU32(buf: Uint8Array, off: number): number {
  return ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}

function writeU32(buf: Uint8Array, off: number, value: number): void {
  buf[off] = (value >>> 24) & 0xff;
  buf[off + 1] = (value >>> 16) & 0xff;
  buf[off + 2] = (value >>> 8) & 0xff;
  buf[off + 3] = value & 0xff;
}

function boxType(buf: Uint8Array, off: number): string {
  return String.fromCharCode(buf[off], buf[off + 1], buf[off + 2], buf[off + 3]);
}

/** 遍历 [start, end) 内的同级 box；遇到 size===1（64 位 largesize）或越界即放弃，避免误改 */
function walkBoxes(
  buf: Uint8Array,
  start: number,
  end: number,
  visit: (type: string, payload: number, boxEnd: number) => void
): void {
  let off = start;
  while (off + 8 <= end) {
    const size = readU32(buf, off);
    if (size < 8 || off + size > end) return;
    visit(boxType(buf, off + 4), off + 8, off + size);
    off += size;
  }
}

/**
 * 把 mux.js 初始化段里的「未知时长」哨兵值替换成真实时长。
 *
 * mux.js 在 mvhd、tkhd 和每条轨道的 mdhd 中写入 0xffffffff。
 * 仅回填 mvhd/tkhd 不够：44100Hz 音频的 mdhd 仍被读成约 27:03:12，
 * 即使分片时间戳已经从零开始。mvhd/tkhd 用电影时基，mdhd 用各轨道自己的
 * 时基（视频常为 90000，音频为采样率），必须全部换算后写入。
 *
 * 只处理 version 0（mux.js 实际产物）；version 1 的 8 字节 duration 不改写。
 */
export function patchInitSegmentDuration(init: Uint8Array, seconds: number): Uint8Array {
  if (!Number.isFinite(seconds) || seconds <= 0) return init;
  const ticksFor = (timescale: number) =>
    Math.min(Math.round(seconds * timescale), UNKNOWN_DURATION - 1);
  // 复制一份：initSegment 由 mux.js 内部生成，直接改可能污染其复用缓冲
  const out = init.slice();
  walkBoxes(out, 0, out.length, (type, payload, boxEnd) => {
    if (type !== 'moov') return;
    let movieTimescale = MOVIE_TIMESCALE;
    // Read the movie clock before patching tkhd, independent of box order.
    walkBoxes(out, payload, boxEnd, (type, start, end) => {
      if (type === 'mvhd' && out[start] === 0 && start + 20 <= end) {
        movieTimescale = readU32(out, start + 12) || MOVIE_TIMESCALE;
      }
    });
    const patchMediaHeader = (start: number, end: number) => {
      if (out[start] !== 0 || start + 20 > end) return;
      const timescale = readU32(out, start + 12);
      if (timescale > 0) writeU32(out, start + 16, ticksFor(timescale));
    };
    walkBoxes(out, payload, boxEnd, (childType, childPayload, childEnd) => {
      if (childType === 'mvhd') {
        patchMediaHeader(childPayload, childEnd);
        return;
      }
      if (childType !== 'trak') return;
      walkBoxes(out, childPayload, childEnd, (leafType, leafPayload, leafEnd) => {
        if (leafType === 'mdia') {
          walkBoxes(out, leafPayload, leafEnd, (type, start, end) => {
            if (type === 'mdhd') patchMediaHeader(start, end);
          });
          return;
        }
        if (leafType !== 'tkhd') return;
        // payload: version(1) flags(3) creation(4) modification(4) track_ID(4) reserved(4) duration(4)
        if (out[leafPayload] === 0 && leafPayload + 24 <= leafEnd) {
          writeU32(out, leafPayload + 20, ticksFor(movieTimescale));
        }
      });
    });
  });
  return out;
}

interface Mp4Writer {
  write(data: Uint8Array): Promise<void>;
  close?(): Promise<void>;
  abort?(): Promise<void>;
}

export class StreamingTransmuxer {
  private transmuxer: any;
  private writer?: Mp4Writer;
  private file = new Mp4FileAssembler();
  private segmentCount = 0;
  private writeChain: Promise<void> = Promise.resolve();
  private writeError: Error | undefined;

  constructor(
    writer?: Mp4Writer
  ) {
    this.writer = writer;
    // Downloads are standalone files: start at zero instead of keeping a source
    // clock that may begin many hours in. Reuse this instance across flushes
    // so later fragments keep their relative timing and audio/video alignment.
    this.transmuxer = new muxjs.mp4.Transmuxer({ keepOriginalTimestamps: false });
    this.transmuxer.on('data', (segment: any) => {
      this.segmentCount += 1;
      // 写入串行化：写失败暂存，下一次 pushAndTransmux 时抛出
      this.writeChain = this.writeChain.then(async () => {
        for (const data of this.file.append(new Uint8Array(segment.initSegment), new Uint8Array(segment.data))) {
          await this.writer?.write(data);
        }
      });
      this.writeChain.catch((err) => {
        this.writeError = err instanceof Error ? err : new Error(String(err));
      });
    });
  }

  setWriter(writer: Mp4Writer): void {
    this.writer = writer;
  }

  getSegmentCount(): number {
    return this.segmentCount;
  }

  /** push 一个 TS 分片并立刻 flush 出 fMP4 片段 */
  async pushAndTransmux(tsData: Uint8Array): Promise<void> {
    this.transmuxer.push(tsData);
    this.transmuxer.flush();
    await this.writeChain;
    if (this.writeError) {
      const err = this.writeError;
      this.writeError = undefined;
      throw err;
    }
  }

  /** 收尾：最后一次 flush 并关闭写入流 */
  async finish(): Promise<void> {
    this.transmuxer.flush();
    await this.writeChain;
    await this.writer?.write(this.file.finish());
    await this.writer?.close?.();
  }

  async abort(): Promise<void> {
    try {
      await this.writer?.abort?.();
    } catch { /* 忽略 */ }
  }
}

/** 批量转封装：push 全部分片后一次 flush，聚合为 MP4 Blob（内存型，适合小体量） */
export function transmuxTSToMP4(tsSegments: Uint8Array[]): Blob {
  const transmuxer = new muxjs.mp4.Transmuxer({ keepOriginalTimestamps: false });
  const file = new Mp4FileAssembler();
  const chunks: Uint8Array[] = [];
  transmuxer.on('data', (segment: any) => {
    for (const data of file.append(new Uint8Array(segment.initSegment), new Uint8Array(segment.data))) chunks.push(data);
  });
  for (const ts of tsSegments) transmuxer.push(ts);
  transmuxer.flush();
  chunks.push(file.finish());
  return new Blob(chunks as Uint8Array<ArrayBuffer>[], { type: 'video/mp4' });
}
