# Space Invasion: Void Runner

A complete 3D space combat campaign built from the unfinished `alien_invasion` project. Fly a swept-wing interceptor through **20 increasingly fast sectors**, upgrade between missions, and defeat four titans. Runs entirely in your browser with native WebGL. No runtime dependencies, asset downloads, accounts, or build step.

## Play

```sh
python3 play.py
```

The launcher opens `http://127.0.0.1:8000`. Python 3 and a browser with WebGL are all you need. Use `python3 play.py --port 8001` if the default port is busy, or `--no-browser` to open the URL yourself.

Alternatively, serve this directory with any static web server. Open `index.html` through HTTP; browser modules do not reliably run from a `file://` URL. The original Pygame prototype remains in `alien_invasion.py` for reference.

## Flight controls

| Action | Control |
| --- | --- |
| Fly in two directions across the 3D arena | WASD or arrow keys |
| Steer directly | Click and drag, or drag on a touch screen |
| Fire | Space; auto fire is on by default and can be toggled |
| Dash | Shift or the touch Dash button |
| Pause / resume | P or the pause button |
| Pause / dismiss a pause or map dialog | Escape |
| Choose a starting checkpoint | Sector Map, unlocked sectors only |
| Audio and fullscreen | Header / footer buttons |

Dash grants **0.65 seconds of protection**, clears hostile shots within three world units, and recharges in **five seconds**. Losing browser focus or switching tabs pauses the mission. All dialogs work with keyboard controls and keep focus inside while open.

## Campaign

| Sectors | Region | Boss | Signature attack |
| --- | --- | --- | --- |
| 01–05 | The Outer Rim | The Warden | Aimed fan barrages |
| 06–10 | Ember Nebula | The Harvester | Offset turrets and crossfire |
| 11–15 | The Glass Expanse | The Seraph | Rotating projectile halos |
| 16–20 | Event Horizon | The World Eater | Alternating flank sweeps |

Every stage increases enemy and projectile speed and reduces firing intervals. Later sectors add more waves and bigger squadrons. Scouts, fast weaving darts, and armored tanks have different movement and durability. Bosses appear after the waves in sectors 5, 10, 15, and 20, and enter an intensified second phase at half health. Enemy escapes damage your ship, so skipping combat has a cost.

Each cleared sector gives a choice: **upgrade weapons**, **fully repair hull**, or **recharge shields**. Weapon upgrades reach MK V with a spread of double-damage shots. Entering the next sector restores 20 hull and 15 shield. Pickups also repair and recharge during battle. Chains of kills raise the score multiplier up to ×5; taking damage or waiting too long breaks the combo. A flawless sector earns an extra 500 points.

Personal best, unlocked checkpoints and sound preference are stored locally. Checkpoint launches and retries start a fresh score with standard equipment; an active run's exact position is not saved. If browser storage is unavailable, the game still runs. The game automatically reduces pixel density for performance and suppresses camera shake and nebula motion when reduced motion is requested.

## Source and checks

- `web/campaign.mjs`: authored stages, regions and deterministic random generator.
- `web/game.mjs`: rendering-independent combat, progression and event model.
- `web/renderer.mjs`: lit triangle meshes, perspective camera, depth testing, procedural nebula, orbital scenery and touch unprojection.
- `web/audio.mjs`: synthesized effects, activated after a user gesture.
- `web/app.mjs`: inputs, interface, persistence and game loop.
- `tests/game.test.mjs`: campaign, combat and progression regression tests, including a protected test pilot that defeats all four bosses.
- `tests/browser.mjs`: WebGL and interface smoke checks at desktop, tablet and phone widths.

Run gameplay tests with Node.js 24 or later:

```sh
node --test tests/game.test.mjs
```

Optional browser checks require development tooling only:

```sh
npm install --no-save playwright@1.62.1
npx playwright install chromium
node --test tests/browser.mjs
```

The GitHub Actions workflow runs both suites, syntax checks and Python compilation. No CI result is claimed until the branch is published and the workflow completes.
