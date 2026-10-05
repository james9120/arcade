# Web Swing — Codex takeover

## Read this first

**Latest implementation, 5 September 2026:** see [REFERENCE_REVIEW.md](REFERENCE_REVIEW.md) for the confirmed Spider-Man 2 (2004) footage comparison, direction selection, wider camera, arc-driven poses, rooftop support and isolated `?practice` landing experiment. [MOVEMENT_REVIEW.md](MOVEMENT_REVIEW.md) preserves the rejected earlier passes. The owner requests a 1:1 PS2 match; this has not been achieved or claimed. The baseline/history below is preserved as handoff context.

The owner has asked to move this project from ChatGPT development to Codex. This document is the self-contained handoff; do not assume the original ChatGPT conversation is available to your task.

**The current game is not accepted.** The latest player feedback was: "this is pretty awful lol do some research on the PS2 spiderman game. That's exactly what I'm looking for". Earlier changes passed automated tests, but the player continued to reject the movement, aiming, animation and overall feel. Do not use a large passing-test count or a long automatic survival run as evidence that those problems are solved.

The immediate job is a movement-first redesign informed by the PS2 reference, not another round of traffic features and auto-catch heuristics. Work on a development branch, produce a playable result and honest evidence, and leave merging/deployment to the owner.

## Repository and exact starting point

- Repository: `james9120/arcade`.
- Main at handoff: `89601f0ba454b7d19cc514e90cf6564801868e16`, the merge of PR #9.
- Runtime: `games/web-swing/index.html`, title `Web / Swing — Natural Flow`.
- Runtime blob at handoff: `3862c98bcab5f1c868f87d3ace06a645893b18a5`.
- Handoff branch: `codex/web-swing-ps2-handoff`, created from that exact main commit.
- Existing browser runner: `tests/web_swing_browser.py`.
- Existing browser-evaluated suites: `tests/web_swing_flow_checks.js` and `tests/web_swing_natural_checks.js`.
- Regression workflow: `.github/workflows/web-swing-test.yml`.
- Deployment: `.github/workflows/pages.yml`; main pushes deploy the static Arcade site.
- Other games and the root Arcade homepage are unrelated. Do not change them for this task.

These files describe the initial handoff only. Fetch current branch status before working; preserve later owner changes. The handoff itself does not alter the runtime or redeploy the live game.

## What the owner wants

A phone-first, third-person Spider-Man-style swinging game through an endless NYC-inspired city, with convincing speed, weight, control, animation and a lively environment. The owner initially asked for traffic, pedestrians, ten-minute day/night cycles, moves between swings, and ground contact ending the run. They use GitHub Pages and have been merging our PRs themselves.

Latest control intent supersedes the earlier thumb-aim design:

- The left analog stick steers the character's movement and flow, not a separate attachment cursor.
- Pushing up should provide useful acceleration/power/climb. The owner specifically missed this when stick Y was reassigned exclusively to aim height.
- Automatic attachment should support momentum and intended travel naturally, without dragging the player sideways unpredictably or causing constant fussy recatches.
- Tapping a reachable visible point on the screen should optionally choose a specific web attachment. Ordinary swinging must not require precise taps.
- Close, fast passes alongside buildings should support wall running and a controllable return to swinging.
- The character needs recognizable proportions and hands, smooth transitions and strong whole-body poses, not visible disconnected joint balls or a stiff elbows-out puppet.
- The city should feel populated and active, but traversal is the highest priority.

### Unresolved decisions — do not misrepresent them as approved

1. **Confirmed reference: Spider-Man 2 (2004), PS2.** The owner explicitly named it in the latest feedback and asked to watch footage and replicate it. Earlier ambiguity with Spider-Man (2002) is resolved.
2. The previous assistant proposed normal street/roof landings with ground-death moved into a challenge mode. **The owner has not approved changing the ground-death rule.** Preserve the existing default until clarified; any landing experiment should be isolated and clearly labeled.
3. A distinct charged swing-jump/launch is a proposed design direction from the previous assistant, not an already approved control mapping. Prototype and explain the interaction, keeping mobile controls uncluttered.
4. "AAA" is the owner's ambition, not a status the current assets or tests establish. Do not promise a production-quality clone, bug-free completion, or physical-phone frame rates that were never measured.

## Why previous iterations missed the target

The owner repeatedly described the game as slow, unrealistic, clunky, difficult or awful even after features and tests were added. The visible character was initially assembled from spheres/capsules; subsequent surfaces and finger geometry improved it but did not establish good animation. Thumb-controlled attachment previews were liked briefly, then rejected as terrible. Flow assistance made automatic survival easy, yet that is not the same as making the player feel in control.

Treat the following as design hypotheses to investigate in motion, not established diagnoses: excessive rule layering, over-frequent reattachment, automatic centering fighting deliberate turns, physical/animation/camera timing not conveying a readable arc, and heavy per-frame geometry work hurting real-time response. Measure and demonstrate rather than adding more overlapping compensations.

The desired loop is: **choose a direction → catch → descend and gain speed → power through the bottom → launch or release → carry momentum → turn or wall-run → catch again**. It should be satisfying in a small district before adding more spectacle.

## Current implementation to inspect

The baseline is one self-contained HTML/CSS/JavaScript runtime with no downloaded models, textures, libraries or audio. It uses a custom WebGL2 instanced renderer, generated city and suit textures, swept procedural character surfaces, two-bone limb calculations and articulated hands.

Prior implementation notes, to verify against code:

- Fixed 120 Hz player simulation with interpolated rendering; a separate lower-rate city simulation.
- Gameplay-tuned constant gravity, unilateral rope constraints, progressive reeling, ZIP, and no intentional catch/release teleport.
- `FLOW` and `MANUAL` swinging preferences; buffered tricks and energy-limited assistance.
- Auto anchor ranking with bounded trajectory prediction, line-of-sight validation and target retention.
- Scene tap raycasts using the last rendered camera and CSS coordinates; taps are separate from HUD, drag and joystick gestures.
- Near-wall running with entry gating, surface constraints, stamina, exits and a re-entry cooldown.
- Bounded near/distant city streaming with floating-origin rebasing; traffic, pedestrian/cyclist behavior, environmental animation and synthesized audio.
- Test-only diagnostics under `?test` through `window.__webswing`.

Read the actual functions and tests instead of treating this overview as a specification for preserving every implementation detail. Refactoring is appropriate. Preserve static-host compatibility; ask before introducing a required build/deployment change, external assets or new runtime dependencies.

## Development history

All of PRs #1–#9 were merged before this handoff. They are history, not the next work queue:

- #1: original Web Swing game.
- #2–#4: early polish, world/animation and heavier-physics passes.
- #5: momentum/rope and closer-camera rebuild.
- #6: pace correction and continuous-surface character.
- #7: explicit left-stick next-web targeting and individual fingers.
- #8: combined aim/power, Flow assistance, blended animation and expanded city activity.
- #9: automatic selection, movement-only stick, tap override and wall running.

Discussion history: https://github.com/james9120/arcade/pulls?q=is%3Apr+is%3Aclosed
Latest baseline PR: https://github.com/james9120/arcade/pull/9

The last reported run for #9 had 148/148 Chromium/WebKit checks. Those are historical results, not a new validation of this handoff, and not player acceptance. CI artifacts can expire; rely on committed tests and reproduce evidence.

## Reference research

Start with primary material and actual gameplay. Record which PS2 game and control mode each claim refers to. Do not assume the Windows version, another console, or a modern remake has the same system. Do not copy copyrighted models, textures, music or proprietary code.

- Jamie Fristrom, *Swinging Physics for Player Movement (As Seen in Spider-Man 2 and Energy Hook)*: https://code.tutsplus.com/swinging-physics-for-player-movement-as-seen-in-spider-man-2-and-energy-hook--gamedev-8782t
- GDC Vault, *Classic Game Design Postmortem: Swinging with Spider-Man*: https://www.gdcvault.com/play/1025725/Classic-Game-Design-Postmortem-Swinging

The article discusses constraint-based swinging and the importance of avoiding canned transitions that kill momentum. Read it as an implementation/design explanation, not the game's exact source or a complete PS2 tuning specification. The GDC landing page alone is not evidence of having watched its talk. Verify manual control mappings and inspect gameplay sequences before claiming exact reference behavior.

Research deliverable: a short cited reference note comparing catch selection, swing duration, bottom-of-arc acceleration, passive release versus powered launch, steering, wall transitions, pose silhouettes and camera framing. Separate observation, documented behavior and inference.

## First Codex milestone

Take over implementation, not just planning. First run and inspect the existing game; reproduce why it fails the reference. Then build a compact movement-quality slice behind a development flag or on this isolated branch, using the existing city/resources where useful.

Priorities:

1. A readable, controllable swing arc with preserved momentum and deliberate launch/release timing.
2. Steering and up-stick power that support the player instead of fighting auto-target rules.
3. Natural automatic catch choice; optional exact tap overrides that do not destroy a good current swing on invalid input.
4. Camera and whole-body pose design that show direction, speed, weight and contact. Fix silhouettes and transitions, not just smoothing constants.
5. Intentional wall entry, planted running and a clean push-off/catch sequence.
6. Real-time responsiveness on mobile-sized viewports. Profile before increasing city detail.

Do not remove features merely to get green tests, but retire obsolete behavior tests with a documented design reason and replacement checks. Do not stack another opaque survival controller on top of the old one. Preserve source/history so the owner can compare the playable branches.

## Quality gates

Functional checks are necessary but not sufficient. Keep separate evidence for:

- **Correctness:** finite state, stable rope and collision response, no catch teleport, valid tap surfaces, independent multi-touch, pause/cancel cleanup, bounded resources, consistent clocks and rebasing.
- **Movement quality:** real rendered sequences of a low swing, higher launch, chained swings, a deliberate 90-degree turn, a wall run/push-off, a tap override and recovery after an imperfect input. Show the controls used. Note every visible hitch, pose pop, camera obstruction or unintended reversal you find.
- **Performance:** actual measured frame times and simulation-time ratio on the tested browser/hardware. Offline frame capture is not real-time FPS evidence. Software-rendered desktop WebKit is not a physical iPhone test.
- **Player acceptance:** the owner decides whether the reference feeling is achieved. Do not call the game polished solely because an autopilot remains airborne.

Retain portrait/landscape and compact 320px UI tests, readable safe-area controls, error checks and the ten-minute cycle. Document which experiments preserve the original ground-death rule.

## Run locally and test

From the repository root, serve the static game with:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
# Open http://127.0.0.1:8000/games/web-swing/
# Diagnostics: http://127.0.0.1:8000/games/web-swing/?test
```

Current test dependency is pinned by the repository:

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install playwright==1.55.0
python -m playwright install chromium webkit
# Linux CI may need: python -m playwright install --with-deps chromium webkit
python tests/web_swing_browser.py
# Optional offline visual capture:
CAPTURE_MOTION=1 python tests/web_swing_browser.py
```

Run from the repo root. The runner evaluates both JS suites in browsers and writes artifacts to `test-results/`, including tested HTML, JSON and screenshots. Read the runner for current capture options; do not execute the browser suites as plain Node programs or invent npm test commands. Keep temporary environments and large generated captures out of commits. Respect the runtime's no-build static deployment unless a change is explicitly approved.

## Reporting and handoff continuity

Update this file or an adjacent progress note with decisions, files changed, commands run, measured results, remaining problems and the next concrete step. Show an actual playable result and motion evidence. Keep the owner's update brief and direct. Distinguish a pushed branch, an opened PR, a Codex task and a live deployment. Do not merge automatically, edit other Arcade games, change account settings/permissions, or expose private data.
