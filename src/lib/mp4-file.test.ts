import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error mux.js does not provide TypeScript declarations.
import muxjs from 'mux.js';
import { Mp4FileAssembler } from './mp4-file';

function fragment() {
  const mux = new muxjs.mp4.Transmuxer({ keepOriginalTimestamps: false });
  let result!: { initSegment: Uint8Array; data: Uint8Array };
  mux.on('data', (segment: typeof result) => { result = segment; });
  mux.push(new Uint8Array(readFileSync(new URL('./fixtures/download-bframes.ts.bin', import.meta.url))));
  mux.flush();
  return { init: result.initSegment.slice(), media: result.data.slice() };
}

describe('standalone MP4 sample index validation', () => {
  it('rejects truncated boxes and an empty export', () => {
    const file = new Mp4FileAssembler();
    expect(() => file.finish()).toThrow('无法生成完整 MP4');
    const { init, media } = fragment();
    expect(() => file.append(init.subarray(0, init.length - 1), media)).toThrow();
  });

  it('rejects a changed codec description rather than silently using obsolete headers', () => {
    const { init, media } = fragment();
    const file = new Mp4FileAssembler();
    file.append(init, media);
    const changed = init.slice();
    const avcC = Buffer.from(changed).indexOf('avcC');
    changed[avcC + 5] ^= 1;
    expect(() => file.append(changed, media)).toThrow('无法生成完整 MP4');
  });

  it('rejects a fragment whose sample data points outside its mdat', () => {
    const { init, media } = fragment();
    const changed = media.slice();
    const trun = Buffer.from(changed).indexOf('trun') + 4;
    new DataView(changed.buffer).setInt32(trun + 8, 0x7fffffff);
    expect(() => new Mp4FileAssembler().append(init, changed)).toThrow('无法生成完整 MP4');
  });

  it('preserves signed composition offsets in a version 1 ctts table', () => {
    const { init, media } = fragment();
    const changed = media.slice();
    const view = new DataView(changed.buffer);
    let pos = 0;
    let found = false;
    while ((pos = Buffer.from(changed).indexOf('trun', pos)) !== -1) {
      const start = pos + 4;
      const flags = view.getUint32(start) & 0xffffff;
      if (flags & 0x800) {
        changed[start] = 1;
        let sample = start + 8 + (flags & 1 ? 4 : 0) + (flags & 4 ? 4 : 0);
        for (const flag of [0x100, 0x200, 0x400]) if (flags & flag) sample += 4;
        view.setInt32(sample, -1);
        found = true;
        break;
      }
      pos += 4;
    }
    expect(found).toBe(true);
    const file = new Mp4FileAssembler();
    file.append(init, changed);
    const movie = file.finish();
    const ctts = Buffer.from(movie).indexOf('ctts') + 4;
    expect(movie[ctts]).toBe(1);
    expect(new DataView(movie.buffer).getInt32(ctts + 12)).toBe(-1);
  });
});

function continuousFragments() {
  const mux = new muxjs.mp4.Transmuxer({ keepOriginalTimestamps: false });
  const fragments: { init: Uint8Array; media: Uint8Array }[] = [];
  mux.on('data', (segment: { initSegment: Uint8Array; data: Uint8Array }) => {
    fragments.push({ init: segment.initSegment.slice(), media: segment.data.slice() });
  });
  for (let i = 0; i < 3; i++) {
    mux.push(new Uint8Array(readFileSync(new URL(`./fixtures/download-offset-${i}.ts.bin`, import.meta.url))));
    mux.flush();
  }
  return fragments;
}

// mux.js writes the audio moof first. Move just its decode timestamp, not its samples.
function audioJitter(media: Uint8Array, ticks: number): Uint8Array {
  const result = media.slice();
  const offset = Buffer.from(result).indexOf('tfdt') + 8;
  const view = new DataView(result.buffer);
  view.setBigUint64(offset, view.getBigUint64(offset) + BigInt(ticks));
  return result;
}

function audioSampleDuration(movie: Uint8Array): number {
  const data = Buffer.from(movie);
  function children(start: number, end: number) {
    const boxes: { type: string; payload: number; end: number }[] = [];
    for (let i = start; i < end;) {
      const size = data.readUInt32BE(i);
      boxes.push({ type: data.toString('ascii', i + 4, i + 8), payload: i + 8, end: i + size });
      i += size;
    }
    return boxes;
  }
  const root = children(0, data.length).find((b) => b.type === 'moov')!;
  for (const trak of children(root.payload, root.end).filter((b) => b.type === 'trak')) {
    const mdia = children(trak.payload, trak.end).find((b) => b.type === 'mdia')!;
    const fields = children(mdia.payload, mdia.end);
    const mdhd = fields.find((b) => b.type === 'mdhd')!;
    if (data.readUInt32BE(mdhd.payload + 12) !== 48000) continue;
    const minf = fields.find((b) => b.type === 'minf')!;
    const stbl = children(minf.payload, minf.end).find((b) => b.type === 'stbl')!;
    const stts = children(stbl.payload, stbl.end).find((b) => b.type === 'stts')!;
    let ticks = 0;
    for (let i = stts.payload + 8; i < stts.end; i += 8) {
      ticks += data.readUInt32BE(i) * data.readUInt32BE(i + 4);
    }
    expect(data.readUInt32BE(mdhd.payload + 16)).toBe(ticks);
    return ticks;
  }
  throw new Error('Missing audio track');
}

describe('small audio clock differences at segment boundaries', () => {
  it.each([2, -2, 48])('preserves a %i-tick offset in the preceding sample duration', (delta) => {
    const fragments = continuousFragments();
    const original = new Mp4FileAssembler();
    const adjusted = new Mp4FileAssembler();
    for (let i = 0; i < 2; i++) {
      original.append(fragments[i].init, fragments[i].media);
      adjusted.append(fragments[i].init, i === 1 ? audioJitter(fragments[i].media, delta) : fragments[i].media);
    }
    expect(audioSampleDuration(adjusted.finish()) - audioSampleDuration(original.finish())).toBe(delta);
  });

  it('does not accumulate drift when the next boundary returns to the original clock', () => {
    const original = new Mp4FileAssembler();
    const adjusted = new Mp4FileAssembler();
    continuousFragments().forEach((fragment, i) => {
      original.append(fragment.init, fragment.media);
      adjusted.append(fragment.init, i === 1 ? audioJitter(fragment.media, 2) : fragment.media);
    });
    expect(audioSampleDuration(adjusted.finish())).toBe(audioSampleDuration(original.finish()));
  });

  it.each([49, -49, 4800, -4800])('continues to reject a %i-tick gap or overlap', (delta) => {
    const [first, second] = continuousFragments();
    const file = new Mp4FileAssembler();
    file.append(first.init, first.media);
    expect(() => file.append(second.init, audioJitter(second.media, delta))).toThrow('时间轴');
  });
});
