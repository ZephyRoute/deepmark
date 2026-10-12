# Accessibility

What Deepmark does for keyboard, screen reader, low vision, reduced motion and touch players, how it is checked, and what it does not cover yet.

## How it is checked

```bash
cd client
bun run build
bun run preview --port 4173 &
bun run contrast     # contrast ratios from the stylesheet tokens
bun run a11y         # axe, target sizes, reduced motion and a keyboard only run
```

`.github/workflows/a11y.yml` runs both on every change to `client/` and uploads the JSON report. The job fails on any serious or critical axe violation, any control under 44 by 44 CSS pixels, any animation still looping with reduced motion on, any contrast pair under its threshold, or a broken keyboard flow.

`bun run a11y` drives a real headless Chrome through eleven screens in three passes (desktop, a 390 by 844 touch phone, and desktop with `prefers-reduced-motion: reduce`), then a keyboard only pass:

| Screen | Source |
|---|---|
| Title, creator, vault (offline), leaderboard (offline), record, board in play | The real game with Stellar blocked, so it runs offline in practice mode |
| Vault with two delvers, leaderboard with ranked rows | `?preview=vault` and `?preview=leaderboard`, local only, sample data |
| Descent scene, cleared result, lost result | `?preview=descent` and `?preview=result`, local only |

axe-core 4.14.0 runs the WCAG 2.0, 2.1 and 2.2 A and AA rules plus the best practice rules. Serious and critical findings fail the run. Moderate and minor ones are printed and do not.

Two things the automation cannot judge: axe cannot compute contrast for text over painted art, which is why the contrast table below is computed from the stylesheet tokens instead, and nothing here replaces a pass with a real screen reader. See the limits at the end.

## Keyboard walkthrough of a full run

Every step below is also what the keyboard only pass in `bun run a11y` exercises up to the first move.

| Step | Keys | What happens |
|---|---|---|
| Start | Tab | First stop is Sound on or off, then the menu: Forge a delver, Vault, Leaderboard, Your record, then the All players link |
| Shortcuts | L, V, M, N | Leaderboard, vault, your record, sound. Work from the title and from any screen that is not a text field |
| Open a screen | Enter on a focused menu item | Does what the label says. Focus moves to the screen's heading, so Tab reaches its first control |
| Leave a screen | Escape or the Back button | Returns to the title with focus on Forge a delver |
| Forge | Enter on Forge a delver | The creator opens with focus in the name field |
| Create | Tab, Space or Enter | Another name, six emblems, the cloak colours, two delvers, weapons, charms, then Begin descent and Back. Each choice reports pressed or not pressed |
| Descend | Enter in the name field, or Enter on Begin descent | The descent scene plays and announces its steps. Escape in the creator goes back instead |
| Move | Arrow keys or W, A, S, D | One tile per press. Walking onto a relic takes it. Walking into a guard opens the fight prompt |
| Fight | Enter attacks, Escape retreats | Space also attacks. Each exchange is written to the run log and announced |
| Clear a floor | Enter descends, Escape extracts | The prompt shows hit points, relics held and the guardians ahead |
| Sound | N | Mutes and unmutes at any time |
| Result | Tab | Focus starts on the outcome heading, which is read aloud. Next: View the transaction, Open the vault when a delver was earned, Save image, Copy image and Copy challenge link after a verified win, Try again if verification failed, Title screen |
| Finish | Enter on Title screen, or Enter with nothing focused | Back to the title |

Enter and Space on a control that was reached with Tab activate that control. A control that was only clicked does not keep them, so a player who clicked Sound and went on playing still gets Enter as attack.

## Structure and announcements

| Part | Semantics |
|---|---|
| Page | One `h1`, Deepmark. Each screen is an `h2`. Landmarks: header, main, a Run status region, a Touch controls navigation, a Main menu navigation |
| Board | The canvas has an accessible name that says how to move and where events are announced |
| Floor label | `role="status"`, so a change of floor or screen is read |
| Run log | `role="log"`. Every fight start, hit, relic taken, floor cleared, retreat and defeat is written there as a sentence |
| Health | The bar is an image with a spoken value, for example `Health 3 of 5, low`. The low state is spoken, not only coloured |
| Relics held | Each chip carries the relic kind as text for screen readers and as a distinct icon |
| Hints | The first run hint card is `role="status"` |
| Verification | The result ribbon's story line is `role="status"`, so pending, sealed and failed states are announced |
| Dialog focus | Vault, leaderboard, record and result move focus to their heading on open. The creator focuses the name field |

## Contrast

Ratios are computed by `client/scripts/contrast.ts` from the tokens in `client/src/styles.css`, so this table cannot drift from the design. Translucent panels are composited over what they really sit on: the opaque overlay for panels, and the board under the dimming gradient for the combat and floor prompts, assuming the lightest possible board pixel. Text needs 4.5, and the edges of controls and the focus ring need 3 (WCAG 1.4.3 and 1.4.11).

| Use | Foreground | Surface | Ratio | Needs | Result |
|---|---|---|---|---|---|
| Body text on the page | `--text` | `--bg` | 17.46 | 4.5 | pass |
| Body text on a panel | `--text` | `--bg-raise` | 16.77 | 4.5 | pass |
| Muted text on the page | `--muted` | `--bg` | 7.07 | 4.5 | pass |
| Muted text on a panel | `--muted` | `--bg-raise` | 6.79 | 4.5 | pass |
| Cyan accent on the page | `--cyan` | `--bg` | 14.69 | 4.5 | pass |
| Cyan accent on a panel | `--cyan` | `--bg-raise` | 14.11 | 4.5 | pass |
| Primary button label | `--cyan` | `--cyan-deep` | 8.54 | 4.5 | pass |
| Gold accent on the page | `--gold` | `--bg` | 11.82 | 4.5 | pass |
| Gold accent on a panel | `--gold` | `--bg-raise` | 11.35 | 4.5 | pass |
| Danger text on the page | `--danger` | `--bg` | 7.14 | 4.5 | pass |
| Danger text on a panel | `--danger` | `--bg-raise` | 6.86 | 4.5 | pass |
| Body text on a prompt over the board | `--text` | `--bg-raise` | 12.66 | 4.5 | pass |
| Muted text on a prompt over the board | `--muted` | `--bg-raise` | 5.13 | 4.5 | pass |
| Cyan accent on a prompt over the board | `--cyan` | `--bg-raise` | 10.65 | 4.5 | pass |
| Danger text on a prompt over the board | `--danger` | `--bg-raise` | 5.18 | 4.5 | pass |
| Safe text on the page | `--safe` | `--bg` | 12.74 | 4.5 | pass |
| Boss name | `#d8c8ff` | `--bg` | 12.98 | 4.5 | pass |
| Cleared title | `#f7e9c0` | `--bg` | 16.54 | 4.5 | pass |
| Lost title | `#e9b9b3` | `--bg` | 11.48 | 4.5 | pass |
| Focus ring on the page | `--cyan` | `--bg` | 14.69 | 3 | pass |
| Focus ring on a panel | `--cyan` | `--bg-raise` | 14.11 | 3 | pass |
| Control edge (input and button border) | `--line-control` | `--bg-raise` | 5.00 | 3 | pass |

The control edge uses its own token, `--line-control`. The decorative `--line` is used for panel borders and dividers, which carry no meaning. The first accessibility pass raised input and chip borders from `--line` (about 1.4) to `--line-control`, and changed the not yet reached descent steps from a 55 percent tint of the muted colour (2.8) to the muted colour.

There are no exceptions to list. Text drawn on the canvas (damage popups) is short lived, duplicated in the run log, and not counted.

## Motion

With `prefers-reduced-motion: reduce`:

| Area | Behaviour |
|---|---|
| Title | No parallax, no embers. The lantern light still flickers in opacity only |
| Descent, boss intro, result | The scenes hold still. The seal appears in place and the counts show their final values |
| Screen shake on hits | Off |
| Low health | A steady red tint instead of a heartbeat |
| Looping CSS animations | None. The check fails if any keeps running |
| Hit flash on a struck actor | Kept. It is 120 ms, once, and is the only visual cue that a blow landed besides the log |

One shared `prefersReducedMotion()` in `client/src/render/preferences.ts` answers for every scene.

## Not colour alone

| Meaning | Colour | Second cue |
|---|---|---|
| Health | Red when low | The numbers, a spoken value, and the word low in the spoken label |
| Relic rarity | Tint of the relic | A different silhouette for each: a clawed amber egg, a cut crystal, a stone cradling a gold core, and the kind as text |
| Floor and wall | Light and dark stone | The Open and Blocked legend in the run status bar, and a seam between them |
| Selected item in the creator | Cyan edge | `aria-pressed`, and an outline offset from the edge |
| Your row on the leaderboard | Glow | The text (you) after the name |
| Veteran rank | Filled pips | The words Veteran rank and the number |
| Practice run | Gold label | The word Practice in the floor label and the run status |

## Touch targets

Every button, link and field is at least 44 by 44 CSS pixels on desktop and on a 390 by 844 phone, and the check fails otherwise. The sound toggle and the volume sliders were below that and were raised.

## Limits

- **The board is a canvas.** A screen reader hears the run log and the health value, not the layout. Where a guard or a relic stands is not exposed, so the game is not fully playable without sight today. A textual description of the nearest tiles is the next step.
- **No assistive technology pass.** The checks above are automated, plus a scripted keyboard run. Nobody has yet driven the game with VoiceOver, NVDA or TalkBack, and the announcements are untested in a real reader.
- **No text scaling or high contrast mode test.** The layout is responsive to the viewport but has not been checked at 200 percent text size or in forced colours.
- **Colour blindness** is covered by the second cues above. It has not been simulated.
