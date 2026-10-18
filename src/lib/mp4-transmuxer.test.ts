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

/** Read actual fragment decode times, rather than trusting the moov duration. */
function fragmentTimes(data: Uint8Array): Map<number, number[]> {
  const tracks = new Map<number, number[]>();
  function boxes(start: number, end: number, visit: (type: string, payload: number, end: number) => void) {
    for (let pos = start; pos + 8 <= end;) {
      const size = readU32(data, pos);
      if (size < 8 || pos + size > end) throw new Error('Invalid MP4 box');
      const type = String.fromCharCode(...data.subarray(pos + 4, pos + 8));
      visit(type, pos + 8, pos + size);
      pos += size;
    }
  }
  boxes(0, data.length, (type, start, end) => {
    if (type !== 'moof') return;
    boxes(start, end, (type, start, end) => {
      if (type !== 'traf') return;
      let track = 0;
      let time: number | undefined;
      boxes(start, end, (type, payload) => {
        if (type === 'tfhd') track = readU32(data, payload + 4);
        if (type === 'tfdt') {
          time = data[payload] === 1
            ? readU32(data, payload + 4) * 2 ** 32 + readU32(data, payload + 8)
            : readU32(data, payload + 4);
        }
      });
      if (track && time !== undefined) tracks.set(track, [...(tracks.get(track) ?? []), time]);
    });
  });
  return tracks;
}

function expectZeroBasedTimeline(data: Uint8Array) {
  const tracks = fragmentTimes(data);
  expect(tracks.size).toBe(2); // Both video and audio survived transmuxing.
  for (const times of tracks.values()) {
    expect(times[0]).toBe(0);
    expect(times.every((time) => time >= 0 && time < 3 * 90_000)).toBe(true);
    // Every subsequent fragment must advance, not restart at zero after each flush.
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
  }
}

/** Inspect every init duration, including mdhd which Apple's player may use. */
function durationHeaders(data: Uint8Array) {
  const headers: { type: string; timescale: number; duration: number }[] = [];
  let movieScale = 90_000;
  function walk(start: number, end: number) {
    for (let pos = start; pos + 8 <= end;) {
      const size = readU32(data, pos);
      if (size < 8 || pos + size > end) throw new Error('Invalid MP4 box');
      const type = String.fromCharCode(...data.subarray(pos + 4, pos + 8));
      const payload = pos + 8;
      if (['moov', 'trak', 'mdia'].includes(type)) walk(payload, pos + size);
      if (type === 'mvhd' || type === 'mdhd') {
        const timescale = readU32(data, payload + 12);
        if (type === 'mvhd') movieScale = timescale;
        headers.push({ type, timescale, duration: readU32(data, payload + 16) });
      }
      if (type === 'tkhd') {
        headers.push({ type, timescale: movieScale, duration: readU32(data, payload + 20) });
      }
      pos += size;
    }
  }
  walk(0, data.length);
  return headers;
}

function expectCompleteDurations(data: Uint8Array, seconds: number, audioScale: number) {
  const headers = durationHeaders(data);
  expect(headers.map((h) => h.type).sort()).toEqual(['mdhd', 'mdhd', 'mvhd', 'tkhd', 'tkhd']);
  expect(headers.find((h) => h.type === 'mdhd' && h.timescale === audioScale)).toBeDefined();
  for (const header of headers) {
    expect(header.duration).not.toBe(0xffffffff);
    expect(header.duration / header.timescale).toBe(seconds);
  }
}

describe('MP4 download timeline', () => {
  it('normalizes long source timestamps and preserves continuity across streaming flushes', async () => {
    const chunks: Uint8Array[] = [];
    let closed = false;
    const writer = {
      async write(data: Uint8Array) { chunks.push(data); },
      async close() { closed = true; },
    };
    const transmuxer = new StreamingTransmuxer(writer, { durationSeconds: 3 });
    for (const segment of offsetSegments) await transmuxer.pushAndTransmux(segment);
    await transmuxer.finish();
    expect(closed).toBe(true);
    const data = new Uint8Array(await new Blob(chunks.map((c) => c.buffer as ArrayBuffer)).arrayBuffer());
    expectZeroBasedTimeline(data);
    expectCompleteDurations(data, 3, 48_000);
    for (const times of fragmentTimes(data).values()) expect(times.length).toBeGreaterThanOrEqual(3);
  });

  it('normalizes long source timestamps in the batch export too', async () => {
    const blob = transmuxTSToMP4(offsetSegments, 3);
    const data = new Uint8Array(await blob.arrayBuffer());
    expectZeroBasedTimeline(data);
    expectCompleteDurations(data, 3, 48_000);
  });

  it('reproduces the 27-hour audio header and patches it using its own 44100 Hz clock', async () => {
    const segment = new Uint8Array(readFileSync(new URL('./fixtures/download-44100.ts.bin', import.meta.url)));
    const raw = new Uint8Array(await transmuxTSToMP4([segment]).arrayBuffer());
    const audioHeader = durationHeaders(raw).find((h) => h.type === 'mdhd' && h.timescale === 44_100)!;
    expect(audioHeader.duration).toBe(0xffffffff);
    expect(audioHeader.duration / audioHeader.timescale).toBeCloseTo(27 * 3600 + 3 * 60 + 11.55, 1);
    const fixed = new Uint8Array(await transmuxTSToMP4([segment], 3).arrayBuffer());
    expectCompleteDurations(fixed, 3, 44_100);
    // AAC priming can leave a small relative audio offset; it must not become hours.
    const starts = [...fragmentTimes(fixed).values()].map((times) => times[0]);
    expect(Math.min(...starts)).toBe(0);
    expect(starts.every((time) => time >= 0 && time < 9000)).toBe(true);
  });

  it('uses the movie clock for tkhd and each media clock for mdhd', () => {
    const init = box('moov',
      box('mvhd', fullBox([0, 0, 1000, 0xffffffff])),
      box('trak', box('tkhd', fullBox([0, 0, 1, 0, 0xffffffff])),
        box('mdia', box('mdhd', fullBox([0, 0, 90000, 0xffffffff])))),
      box('trak', box('tkhd', fullBox([0, 0, 2, 0, 0xffffffff])),
        box('mdia', box('mdhd', fullBox([0, 0, 44100, 0xffffffff])))));
    expectCompleteDurations(patchInitSegmentDuration(init, 2730), 2730, 44100);
  });
});
