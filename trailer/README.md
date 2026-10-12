# Deepmark trailer

The launch film, built with [Remotion](https://www.remotion.dev). This workspace is not part of the shipped client: nothing in `client/` or `contracts/` depends on it.

| Output | File | Notes |
|---|---|---|
| 30 second trailer | `out/deepmark-trailer-30s.mp4` | For posts. Under 15 MB. Published: https://youtu.be/X5GZSp7EFE8 |
| 90 second cut | `out/deepmark-trailer-90s.mp4` | Adds what the contract verifies and why a result cannot be forged. Published: https://youtu.be/F-gPDj1Yt5A |
| Animated share card | `out/deepmark-share-card.mp4` | 1200 by 630, the motion version of the card the game saves. |
| README media | `../docs/media/` | Screenshots of the real game and a boss fight GIF. Committed. |

## One command

```sh
bun install
bun run build:all
```

That syncs the painted art from the client, synthesises the score, builds and films the production game, renders both cuts and the card, and cuts the README media. Run it from this folder. It needs Bun, Google Chrome (set `CHROME_PATH` if it is not in the default macOS location) and `ffmpeg`.

Individual steps: `bun run sync`, `audio`, `capture`, `render:30`, `render:90`, `render:card`, `media`. `bun run studio` opens Remotion Studio.

## Where the footage comes from

Gameplay is the real game, not an animation of it. `capture/record.ts` builds the client, serves the production build, blocks the Stellar hosts so the run is a deterministic practice run, and plays a chosen seed through the real keyboard input while recording at 3840 by 2160.

The run on screen is not arbitrary. `capture/plan.ts` searches seeds with the game's own simulation for a winning extraction that ends on exactly what the game's sealed result card shows in preview (floor 3, 2 relics, score 4, 1 HP left). The played footage and the card tell one story. The same action log is what the explainer graphics draw: the 51 bytes on screen are the bytes the run was played with.

While recording, the script writes a cue log (`src/generated/run-cues.json`) with what each input did and where the delver and guard stood. The edit reads it, so cuts land on real events and the camera follows the delver. Re-recording moves the edit with it.

What is real and what is a design preview:

- **Real**: the title, the delver forge, all three floors, the fights, the boss, the extraction. They are the production build.
- **Game preview screens**: the sealed result card and the vault come from the game's own `?preview=` screens, which run without a chain. Their numbers match the filmed run, but the rank and the seal are not a live transaction. Do not describe these shots as a recorded transaction.

## Structure

```
capture/    plays and records the game, searches for the filmed run
audio/      the score, synthesised from numbers (no samples, nothing to license)
scripts/    asset sync and README media
src/
  timeline.ts      scene boundaries and where each shot starts in the recording
  score-spec.ts    what the score does, derived from the same timeline
  camera.ts        the follow camera, a pure function of recording time
  scenes/          hook, boss banner, choice, end card
  scenes/explain/  the five chapters of the 90 second cut
  compositions/    Trailer30, Trailer90, ShareCardAnimated
```

Timing lives in `src/timeline.ts` and the score reads the same numbers, so moving a scene and re-running `bun run audio` keeps picture and sound together.

## Rules the cuts follow

- The first five seconds are a hook with no logo and no text.
- The Stellar explanation comes after the game, never before it.
- Every animation is a function of the frame number. Nothing uses CSS transitions, so every frame renders the same on any machine.

Recordings, art copies and renders are git ignored. They are rebuilt by the command above.
