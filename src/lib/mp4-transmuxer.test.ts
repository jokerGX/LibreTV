import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { patchInitSegmentDuration, StreamingTransmuxer, transmuxTSToMP4 } from './mp4-transmuxer';

const u32 = (v: number) =>
  new Uint8Array([(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]);

const readU32 = (b: Uint8Array, o: number) =>
  ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function box(type: string, ...payloads: Uint8Array[]): Uint8Array {
  const payloadLen = payloads.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(8 + payloadLen);
  out.set(u32(out.length), 0);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  let off = 8;
  for (const p of payloads) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** version 0 full box：version(1)+flags(3)=0，其后是若干 u32 字段 */
function fullBox(fields: number[]): Uint8Array {
  const out = new Uint8Array(4 + fields.length * 4);
  fields.forEach((v, i) => out.set(u32(v), 4 + i * 4));
  return out;
}

/** 按 mux.js 的实际布局搭最小 initSegment：ftyp + moov(mvhd + trak(tkhd)) */
function initSegment(mvhdDuration: number, tkhdDuration: number): Uint8Array {
  const ftyp = box('ftyp', new Uint8Array([0x69, 0x73, 0x6f, 0x6d]));
  const mvhdBox = box('mvhd', fullBox([0, 0, 90_000, mvhdDuration])); // timescale 90000
  const tkhdBox = box('tkhd', fullBox([0, 0, 1, 0, tkhdDuration]));
  const moov = box('moov', mvhdBox, box('trak', tkhdBox));
  const out = new Uint8Array(ftyp.length + moov.length);
  out.set(ftyp, 0);
  out.set(moov, ftyp.length);
  return out;
}

// ftyp(12) + moov 头(8) → mvhd 头(8) → mvhd payload 起点 28
const MVHD_PAYLOAD = 12 + 8 + 8;
// + mvhd payload(20) + trak 头(8) + tkhd 头(8) → tkhd payload 起点 64
const TKHD_PAYLOAD = MVHD_PAYLOAD + 20 + 8 + 8;

describe('patchInitSegmentDuration', () => {
  it('把 mvhd/tkhd 的 0xFFFFFFFF 哨兵值替换为真实时长（90000 时基）', () => {
    const patched = patchInitSegmentDuration(initSegment(0xffffffff, 0xffffffff), 2730);
    expect(readU32(patched, MVHD_PAYLOAD + 16)).toBe(2730 * 90_000);
    expect(readU32(patched, TKHD_PAYLOAD + 20)).toBe(2730 * 90_000);
  });

  it('0xFFFFFFFF/90000 ≈ 47721.86s ≈ 13:15:21 —— 未修补时播放器看到的时长', () => {
    expect(0xffffffff / 90_000).toBeCloseTo(47721.86, 1);
  });

  it('时长非正数 / 非有限值时原样返回', () => {
    const init = initSegment(0xffffffff, 0xffffffff);
    expect(patchInitSegmentDuration(init, 0)).toEqual(init);
    expect(patchInitSegmentDuration(init, Number.NaN)).toEqual(init);
  });

  it('不修改入参缓冲', () => {
    const init = initSegment(0xffffffff, 0xffffffff);
    patchInitSegmentDuration(init, 60);
    expect(readU32(init, MVHD_PAYLOAD + 16)).toBe(0xffffffff);
  });
});

// Three one-second H.264/AAC TS segments with an original timestamp near 26 hours.
// Generated from testsrc2/sine; no external media or network requests are needed.
const offsetSegments = [0, 1, 2].map((i) =>
  new Uint8Array(readFileSync(new URL(`./fixtures/download-offset-${i}.ts.bin`, import.meta.url)))
);

/** Independently walk the finalized file and inspect its static sample tables. */
function inspect(data: Uint8Array) {
  const found = new Map<string, { payload: number; end: number }[]>();
  function walk(start: number, end: number) {
    for (let pos = start; pos + 8 <= end;) {
      const size = readU32(data, pos);
      if (size < 8 || pos + size > end) throw new Error('Invalid MP4 box');
      const type = String.fromCharCode(...data.subarray(pos + 4, pos + 8));
      const payload = pos + 8;
      found.set(type, [...(found.get(type) ?? []), { payload, end: pos + size }]);
      if (['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts'].includes(type)) walk(payload, pos + size);
      pos += size;
    }
  }
  walk(0, data.length);
  return found;
}

function expectStandaloneFile(data: Uint8Array) {
  const tables = inspect(data);
  expect(tables.has('moof')).toBe(false);
  expect(tables.has('mvex')).toBe(false);
  expect(tables.get('trak')).toHaveLength(2);
  const movie = tables.get('mvhd')![0];
  const duration = readU32(data, movie.payload + 16) / readU32(data, movie.payload + 12);
  expect(duration).toBeGreaterThanOrEqual(3);
  expect(duration).toBeLessThan(3.15);
  for (const header of tables.get('mdhd')!) {
    const duration = readU32(data, header.payload + 16) / readU32(data, header.payload + 12);
    expect(duration).toBeGreaterThan(2.9);
    expect(duration).toBeLessThan(3.15);
  }
  for (const sampleSizes of tables.get('stsz')!) {
    expect(readU32(data, sampleSizes.payload + 8)).toBeGreaterThan(20);
  }
  for (const index of tables.get('co64')!) {
    const count = readU32(data, index.payload + 4);
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const offset = readU32(data, index.payload + 8 + i * 8) * 2 ** 32 + readU32(data, index.payload + 12 + i * 8);
      expect(tables.get('mdat')!.some((b) => offset === b.payload)).toBe(true);
    }
  }
}

describe('standalone MP4 download', () => {
  it('writes media before finish, then a complete sample index with no playback fragments', async () => {
    const chunks: Uint8Array[] = [];
    let closed = false;
    const writer = {
      async write(data: Uint8Array) { chunks.push(data.slice()); },
      async close() { closed = true; },
    };
    const transmuxer = new StreamingTransmuxer(writer);
    for (const segment of offsetSegments) await transmuxer.pushAndTransmux(segment);
    const beforeFinish = new Uint8Array(await new Blob(chunks as Uint8Array<ArrayBuffer>[]).arrayBuffer());
    expect(inspect(beforeFinish).has('mdat')).toBe(true);
    expect(inspect(beforeFinish).has('moov')).toBe(false);
    expect(closed).toBe(false);
    await transmuxer.finish();
    expect(closed).toBe(true);
    const data = new Uint8Array(await new Blob(chunks as Uint8Array<ArrayBuffer>[]).arrayBuffer());
    expectStandaloneFile(data);
    expect(transmuxer.getSegmentCount()).toBe(3);
  });

  it('builds valid byte offsets in batch exports even when media chunks are subarray views', async () => {
    const blob = transmuxTSToMP4(offsetSegments);
    const data = new Uint8Array(await blob.arrayBuffer());
    expectStandaloneFile(data);
  });

  it('derives 44100 Hz audio duration from its sample table, without the 27-hour sentinel', async () => {
    const segment = new Uint8Array(readFileSync(new URL('./fixtures/download-44100.ts.bin', import.meta.url)));
    const data = new Uint8Array(await transmuxTSToMP4([segment]).arrayBuffer());
    expectStandaloneFile(data);
    expect(inspect(data).get('mdhd')!.some((b) => readU32(data, b.payload + 12) === 44100)).toBe(true);
  });

  it('preserves B-frame presentation offsets and indexes keyframes', async () => {
    const segment = new Uint8Array(readFileSync(new URL('./fixtures/download-bframes.ts.bin', import.meta.url)));
    const data = new Uint8Array(await transmuxTSToMP4([segment]).arrayBuffer());
    expectStandaloneFile(data);
    const tables = inspect(data);
    expect(tables.get('ctts')).toHaveLength(1);
    const ctts = tables.get('ctts')![0];
    expect(readU32(data, ctts.payload + 4)).toBeGreaterThan(1);
    expect(tables.get('stss')).toHaveLength(1);
    expect(readU32(data, tables.get('stss')![0].payload + 4)).toBe(3);
  });

  it('rejects a backwards source clock instead of exporting overlapping timestamps', async () => {
    const writer = { async write() {}, async close() {} };
    const transmuxer = new StreamingTransmuxer(writer);
    for (const segment of offsetSegments) await transmuxer.pushAndTransmux(segment);
    await expect(transmuxer.pushAndTransmux(offsetSegments[0])).rejects.toThrow('时间轴');
  });

  it('does not close a file as successful when media writing fails', async () => {
    let closed = false;
    const transmuxer = new StreamingTransmuxer({
      async write() { throw new Error('disk full'); },
      async close() { closed = true; },
    });
    await expect(transmuxer.pushAndTransmux(offsetSegments[0])).rejects.toThrow('disk full');
    await expect(transmuxer.finish()).rejects.toThrow('disk full');
    expect(closed).toBe(false);
  });
});
