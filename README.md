# Meow music player + local timed lyric rain

A responsive, centered music player with falling lyric lines and the original Hello Kitty SVG. It plays MP3 files from this folder and reads all lyric timing from a local `lyrics.json` file. No lyric API or internet connection is used for lyrics.

## 1. Put these files together

```text
meow-player-project/
├── index.html
├── styles.css
├── app.js
├── lyrics.json
├── brand-hello-kitty-svgrepo-com.svg
├── sticker.webp
├── My witch.mp3
├── Cowboys_and_Angels.mp3
├── Nine Inch Nails - Closer.mp3
├── Adadido - He Asked Me to Quit Smoking.mp3
└── captions/                         (original VTT source files)
```

The ZIP includes the page files, the SVG, converted lyric cues, and the original VTT files in `captions/`. It does not include the four MP3s or `sticker.webp`; copy those into this same folder, keeping the filenames exact.

The local filename `My witch.mp3` is kept unchanged, but the player displays **She's My Witch — Kip Tyler**. The supplied Cowboys and Angels subtitle identifies the artist as **George Michael**, so the playlist uses that artist.

## 2. Run it locally

A local web server is required because the page reads `lyrics.json` with `fetch()`. The audio itself is loaded from the same folder.

From this folder, run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

You can also use VS Code's Live Server extension. Opening `index.html` directly with `file://` may prevent the browser from loading `lyrics.json`.

## 3. How lyric timing works

The four supplied WebVTT files were converted into the track arrays in `lyrics.json`. Every cue stores:

- `time`: line start time in seconds, preserving the VTT's millisecond precision.
- `end`: line end time in seconds, preserving the VTT cue end.
- `text`: the lyric line from the VTT.

The player checks the audio's current playback time. It releases each lyric line at its cue start, highlights the line while its cue is active, and reacts to seeking. Falling lyric lines and the falling SVG use collision separation so they are pushed apart instead of occupying the same space.

The supplied VTT files provide **line-level timing**, not word-level karaoke timing. Therefore, the currently sung line changes color, but individual words are not highlighted one by one.

## 4. Supplied lyric coverage

The JSON contains exactly the cues from your four files:

| Track | Cues | First cue | Last cue end |
|---|---:|---:|---:|
| Kip Tyler — She's My Witch | 16 | 00:12.570 | 01:54.790 |
| George Michael — Cowboys and Angels | 51 | 01:07.329 | 05:29.509 |
| Nine Inch Nails — Closer | 34 | 00:22.213 | 05:54.567 |
| Adadido — He Asked Me to Quit Smoking (cover) | 11 | 00:01.649 | 00:59.939 |

These ranges describe the captions you supplied, not necessarily the full duration of each recording. Any portion outside the supplied VTT cues will simply have no falling lyric lines.

## 5. Add or edit timed lyrics

Add cues to the corresponding array in `lyrics.json`. Times are seconds from the beginning of that exact MP3:

```json
"My witch.mp3": [
  { "time": 12.570, "end": 17.010, "text": "Your lyric line goes here" },
  { "time": 17.980, "end": 21.899, "text": "The next lyric line goes here" }
]
```

Keep cues ordered by their start times. The page does not download lyrics, guess timestamps, or contact an external service.

## 6. Notes

- The player starts paused; browsers require a click/tap before audio can play.
- The original Hello Kitty SVG rains independently of the lyrics.
- The sticker stays fixed at the bottom-right and scales with the viewport. Add your `sticker.webp` beside `index.html`.
- Lyrics are fully local and work offline once the page is served locally.
