# Download timestamp regression fixtures

`download-offset-{0,1,2}.ts.bin` are three consecutive one-second H.264/AAC
segments generated from FFmpeg's synthetic test pattern and sine wave. Their
source timestamps begin near 95,000 seconds (26 hours), reproducing standalone
MP4 exports with a huge leading timeline gap. The `.bin` suffix keeps TypeScript
from treating these transport streams as source files.

To regenerate with FFmpeg (run in a temporary directory):

```sh
ffmpeg -f lavfi -i testsrc2=size=64x48:rate=10 \
  -f lavfi -i sine=frequency=440:sample_rate=48000 \
  -t 3 -c:v libx264 -preset ultrafast -g 10 -bf 0 \
  -c:a aac -b:a 32k -output_ts_offset 95000 \
  -f hls -hls_time 1 -hls_list_size 0 \
  -hls_segment_filename 'segment-%d.ts' index.m3u8
```

Copy each `segment-N.ts` to `download-offset-N.ts.bin`. The tests use the
checked-in bytes and do not require FFmpeg, a browser, or network access.

`download-44100.ts.bin` uses the same synthetic sources and encoding settings,
with `sample_rate=44100` and `-f mpegts download-44100.ts.bin` instead of the HLS
output options. Its unpatched AAC `mdhd` duration is `0xffffffff / 44100`, or
27 hours, 3 minutes, 11.55 seconds. It reproduces the metadata duration that the
previous timestamp-only regression tests missed.

`download-bframes.ts.bin` exercises frame reordering and the static MP4 `ctts`
and `stss` indexes. It is generated from testsrc2 (96x64 at 24 fps) and a 44100 Hz
sine wave, for 3 seconds, with libx264 `-preset medium -g 24 -bf 2`, AAC 32k,
`-output_ts_offset 95000 -f mpegts`. No third-party video is included.
