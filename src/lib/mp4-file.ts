/** Convert mux.js fragments into a standalone MP4 without buffering media bytes.
 * Write ftyp + small mdat chunks as they arrive; append the indexed moov at EOF.
 * Only sample sizes/timing/offsets and the codec headers stay in memory.
 */
interface Box { type: string; start: number; payload: number; end: number }
interface Sample { duration: number; size: number; flags: number; cts: number }
interface Track {
  id: number;
  scale: number;
  raw: Uint8Array;
  stsd: Uint8Array;
  samples: Sample[];
  chunks: { offset: number; samples: number }[];
  base?: number;
  end?: number;
}

const fail = () => new Error('无法生成完整 MP4：片源的分片结构或时间轴不受支持，请更换来源');
const u32 = (data: Uint8Array, offset: number) => new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(offset);
const i32 = (data: Uint8Array, offset: number) => new DataView(data.buffer, data.byteOffset, data.byteLength).getInt32(offset);
function put(data: Uint8Array, offset: number, value: number) {
  new DataView(data.buffer, data.byteOffset, data.byteLength).setUint32(offset, value);
}
function boxes(data: Uint8Array, start = 0, end = data.length): Box[] {
  const result: Box[] = [];
  for (let pos = start; pos < end;) {
    if (pos + 8 > end) throw fail();
    const size = u32(data, pos);
    if (size < 8 || pos + size > end) throw fail();
    result.push({ type: String.fromCharCode(...data.subarray(pos + 4, pos + 8)), start: pos, payload: pos + 8, end: pos + size });
    pos += size;
  }
  return result;
}
function child(data: Uint8Array, parent: Box, type: string): Box {
  const found = boxes(data, parent.payload, parent.end).find((box) => box.type === type);
  if (!found) throw fail();
  return found;
}
function join(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
function box(type: string, ...parts: Uint8Array[]): Uint8Array {
  const payload = join(parts);
  const result = new Uint8Array(8 + payload.length);
  put(result, 0, result.length);
  result.set([...type].map((c) => c.charCodeAt(0)), 4);
  result.set(payload, 8);
  return result;
}
function words(type: string, values: number[], version = 0): Uint8Array {
  const payload = new Uint8Array(4 + values.length * 4);
  payload[0] = version;
  values.forEach((value, i) => put(payload, 4 + i * 4, value));
  return box(type, payload);
}
function runs(values: number[]): number[] {
  const result: number[] = [];
  for (const value of values) {
    if (result.length && result[result.length - 1] === value) result[result.length - 2]++;
    else result.push(1, value);
  }
  return [result.length / 2, ...result];
}
function patchDuration(raw: Uint8Array, duration: number, offset: number): Uint8Array {
  if (raw[8] !== 0 || duration > 0xfffffffe || duration < 0) throw fail();
  const out = raw.slice();
  put(out, offset, Math.round(duration));
  return out;
}

export class Mp4FileAssembler {
  private tracks = new Map<number, Track>();
  private movie?: Uint8Array;
  private movieScale = 90_000;
  private offset = 0;

  /** Returned chunks can be written and released immediately. */
  append(init: Uint8Array, media: Uint8Array): Uint8Array[] {
    const output: Uint8Array[] = [];
    if (!this.movie) {
      const root = boxes(init);
      const moov = root.find((b) => b.type === 'moov');
      const ftyp = root.find((b) => b.type === 'ftyp');
      if (!moov || !ftyp) throw fail();
      this.movie = init.slice(moov.start, moov.end);
      const header = child(init, moov, 'mvhd');
      this.movieScale = u32(init, header.payload + 12);
      if (!this.movieScale) throw fail();
      for (const trak of boxes(init, moov.payload, moov.end).filter((b) => b.type === 'trak')) {
        const tkhd = child(init, trak, 'tkhd');
        const mdia = child(init, trak, 'mdia');
        const mdhd = child(init, mdia, 'mdhd');
        const stbl = child(init, child(init, mdia, 'minf'), 'stbl');
        const stsd = child(init, stbl, 'stsd');
        const id = u32(init, tkhd.payload + 12);
        const scale = u32(init, mdhd.payload + 12);
        if (!scale || this.tracks.has(id)) throw fail();
        this.tracks.set(id, { id, scale, raw: init.slice(trak.start, trak.end), stsd: init.slice(stsd.start, stsd.end), samples: [], chunks: [] });
      }
      const first = init.slice(ftyp.start, ftyp.end);
      output.push(first);
      this.offset += first.length;
    } else {
      // A standalone track has one codec description; don't silently discard a
      // replacement SPS/PPS or audio configuration from a later init segment.
      const moov = boxes(init).find((b) => b.type === 'moov');
      if (!moov) throw fail();
      const incoming = boxes(init, moov.payload, moov.end).filter((b) => b.type === 'trak');
      if (incoming.length !== this.tracks.size) throw fail();
      for (const trak of incoming) {
        const track = this.tracks.get(u32(init, child(init, trak, 'tkhd').payload + 12));
        const stsd = child(init, child(init, child(init, child(init, trak, 'mdia'), 'minf'), 'stbl'), 'stsd');
        const description = init.subarray(stsd.start, stsd.end);
        if (!track || description.length !== track.stsd.length || description.some((byte, i) => byte !== track.stsd[i])) throw fail();
      }
    }
    const root = boxes(media);
    for (const moof of root.filter((b) => b.type === 'moof')) {
      for (const traf of boxes(media, moof.payload, moof.end).filter((b) => b.type === 'traf')) {
        const tfhd = child(media, traf, 'tfhd');
        const flags = u32(media, tfhd.payload) & 0xffffff;
        const track = this.tracks.get(u32(media, tfhd.payload + 4));
        if (!track || flags & 1) throw fail(); // mux.js uses moof-relative offsets.
        let cursor = tfhd.payload + 8;
        if (flags & 2) { if (u32(media, cursor) !== 1) throw fail(); cursor += 4; }
        const defaults = { duration: 0, size: 0, flags: 0 };
        for (const [flag, name] of [[8, 'duration'], [16, 'size'], [32, 'flags']] as const) {
          if (flags & flag) { defaults[name] = u32(media, cursor); cursor += 4; }
        }
        const tfdt = child(media, traf, 'tfdt');
        let decodeTime = media[tfdt.payload] === 1
          ? u32(media, tfdt.payload + 4) * 2 ** 32 + u32(media, tfdt.payload + 8)
          : u32(media, tfdt.payload + 4);
        if (!Number.isSafeInteger(decodeTime)) throw fail();
        if (track.base === undefined) track.base = decodeTime;
        if (track.end !== undefined) {
          // TS timestamps use 90 kHz, while AAC uses its sample-rate clock.
          // Real sources can round each segment boundary by multiple audio ticks.
          // Preserve this small offset in the preceding sample's duration so
          // stts still matches the source clock without cumulative A/V drift.
          const delta = decodeTime - track.end;
          const tolerance = Math.max(1, Math.floor(track.scale / 1000)); // 1 ms in this track's clock.
          const previous = track.samples[track.samples.length - 1];
          if (Math.abs(delta) > tolerance || !previous || previous.duration + delta <= 0) throw fail();
          previous.duration += delta;
        }
        for (const trun of boxes(media, traf.payload, traf.end).filter((b) => b.type === 'trun')) {
          const trunFlags = u32(media, trun.payload) & 0xffffff;
          const count = u32(media, trun.payload + 4);
          if (!(trunFlags & 1) || count === 0 || count > (trun.end - trun.payload) / 4) throw fail();
          const sourceOffset = moof.start + i32(media, trun.payload + 8);
          let pos = trun.payload + 12;
          let firstFlags = defaults.flags;
          if (trunFlags & 4) { firstFlags = u32(media, pos); pos += 4; }
          const samples: Sample[] = [];
          let length = 0;
          for (let i = 0; i < count; i++) {
            const sample = { ...defaults, cts: 0 };
            if (i === 0) sample.flags = firstFlags;
            for (const [flag, name] of [[0x100, 'duration'], [0x200, 'size'], [0x400, 'flags'], [0x800, 'cts']] as const) {
              if (trunFlags & flag) {
                if (pos + 4 > trun.end) throw fail();
                sample[name] = name === 'cts' && media[trun.payload] === 1 ? i32(media, pos) : u32(media, pos);
                pos += 4;
              }
            }
            if (!sample.duration || !sample.size) throw fail();
            samples.push(sample);
            length += sample.size;
            decodeTime += sample.duration;
          }
          if (!root.some((b) => b.type === 'mdat' && sourceOffset >= b.payload && sourceOffset + length <= b.end)) throw fail();
          const header = new Uint8Array(8);
          put(header, 0, length + 8);
          header.set([109, 100, 97, 116], 4); // mdat
          track.chunks.push({ offset: this.offset + 8, samples: samples.length });
          for (const sample of samples) track.samples.push(sample);
          output.push(header, media.subarray(sourceOffset, sourceOffset + length));
          this.offset += length + 8;
        }
        track.end = decodeTime;
      }
    }
    return output;
  }

  finish(): Uint8Array {
    if (!this.movie || !this.tracks.size) throw fail();
    let movieDuration = 0;
    const tracks: Uint8Array[] = [];
    for (const track of this.tracks.values()) {
      if (!track.samples.length || track.base === undefined || track.end === undefined) throw fail();
      const duration = track.samples.reduce((sum, s) => sum + s.duration, 0);
      let dts = 0;
      let presentationEnd = duration;
      for (const sample of track.samples) {
        presentationEnd = Math.max(presentationEnd, dts + sample.cts + sample.duration);
        dts += sample.duration;
      }
      const delay = Math.round(track.base / track.scale * this.movieScale);
      const trackDuration = Math.round(presentationEnd / track.scale * this.movieScale);
      movieDuration = Math.max(movieDuration, delay + trackDuration);
      const stsc: number[] = [];
      track.chunks.forEach((chunk, index) => {
        if (index === 0 || chunk.samples !== track.chunks[index - 1].samples) stsc.push(index + 1, chunk.samples, 1);
      });
      const sizes = track.samples.map((s) => s.size);
      const sync = track.samples.flatMap((s, i) => s.flags & 0x10000 ? [] : [i + 1]);
      const offsets = track.chunks.flatMap((chunk) => [Math.floor(chunk.offset / 2 ** 32), chunk.offset >>> 0]);
      const tables = [track.stsd,
        words('stts', runs(track.samples.map((s) => s.duration))),
        words('stsc', [stsc.length / 3, ...stsc]),
        words('stsz', [0, sizes.length, ...sizes]),
        words('co64', [track.chunks.length, ...offsets])];
      if (sync.length !== track.samples.length) tables.push(words('stss', [sync.length, ...sync]));
      if (track.samples.some((s) => s.cts !== 0)) tables.push(words('ctts', runs(track.samples.map((s) => s.cts)), track.samples.some((s) => s.cts < 0) ? 1 : 0));
      const rebuild = (raw: Uint8Array, parent: Box): Uint8Array => box(parent.type,
        ...boxes(raw, parent.payload, parent.end).filter((b) => b.type !== 'edts').map((b) => {
          const bytes = raw.subarray(b.start, b.end);
          if (b.type === 'stbl') return box('stbl', ...tables);
          if (b.type === 'tkhd') return patchDuration(bytes, delay + trackDuration, 28);
          if (b.type === 'mdhd') return patchDuration(bytes, duration, 24);
          if (['mdia', 'minf'].includes(b.type)) return rebuild(raw, b);
          return bytes;
        }),
        ...(parent.type === 'trak' && delay > 0 ? [box('edts', words('elst', [2, delay, 0xffffffff, 0x10000, trackDuration, 0, 0x10000]))] : []));
      tracks.push(rebuild(track.raw, boxes(track.raw)[0]));
    }
    const root = boxes(this.movie)[0];
    return box('moov', ...boxes(this.movie, root.payload, root.end)
      .filter((b) => b.type !== 'trak' && b.type !== 'mvex')
      .map((b) => b.type === 'mvhd'
        ? patchDuration(this.movie!.subarray(b.start, b.end), movieDuration, 24)
        : this.movie!.subarray(b.start, b.end)), ...tracks);
  }
}
