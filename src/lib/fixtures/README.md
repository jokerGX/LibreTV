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
