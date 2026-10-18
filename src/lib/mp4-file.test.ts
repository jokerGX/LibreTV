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
