#!/bin/sh
# Rebuild "PREVENT: Before the Change" from scratch: sh films/prevent/build.sh   (needs ffmpeg 7+ on PATH for the last step)
# To change any word or number, edit content.json (on-screen text, captions, colours) or lines.json (spoken text), then run this again.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
LIB=${LIB:-$(cd "$HERE/../.." && pwd)}
export LIB
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the library folder"; exit 1; }
PY="$LIB/.venv/bin/python"
sh "$HERE/tools/fonts.sh"                                             # fonts (OFL) -> fonts/
cd "$LIB"
"$PY" core/tts/tts.py "$HERE/lines.json" "$HERE/voices"                # narration (replace voices/*.wav and dur.json with your own recording to use your voice)
"$PY" core/tts/asr_check.py "$HERE/lines.json" "$HERE/voices"          # speech-to-text check of every line
node core/render/readcheck.mjs "$HERE" --step 0.125                    # every on-screen text stays long enough to read
node core/render/events.mjs "$HERE"                                    # picture events -> events.json
"$PY" "$HERE/mix.py"                                                   # score, foley, ambience, voice -> out/mix.wav
"$PY" "$HERE/tools/cues.py" && "$PY" core/render/srt.py "$HERE/out/cues.json" "$HERE/prevent.srt"
node core/render/video.mjs "$HERE" --fps 24 --workers 4 --out "$HERE/out/video.mp4"
sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/out/mix.wav" "$HERE/prevent.mp4" 24 0
node core/render/still.mjs "$HERE" 68 --q nosub=1 --out "$HERE/out" --prefix po_ && cp "$HERE/out/po_68.jpg" "$HERE/poster.jpg"
