# Movement takeover — 5 September 2026

This is a playable movement milestone on `codex/web-swing-ps2-handoff`, not player acceptance or a deployment. Spider-Man 2 (2004) remains the working reference; the owner has not confirmed the exact PS2 title. Ground contact still ends the run.

## Reference and design decisions

Jamie Fristrom's [constraint-based swinging article](https://code.tutsplus.com/swinging-physics-for-player-movement-as-seen-in-spider-man-2-and-energy-hook--gamedev-8782t) documents a physics-based approach that preserves momentum through transitions. It describes implementation principles, not the precise PS2 tuning. The [GDC postmortem page](https://www.gdcvault.com/play/1025725/Classic-Game-Design-Postmortem-Swinging) was opened; the talk was not watched.

The browser review also inspected [Gamerizz's PS2-labelled gameplay recording](https://www.youtube.com/watch?v=zYdQQQVbuJY), including the facade catch at approximately 12:39 and the following descent/ground transition. The recording does not establish the selected swing mode or physical controller input. These are limited observations, not a claim to have inspected the complete game or verified an exact button mapping.

| Aspect | Evidence and application |
| --- | --- |
| Catch selection | Recording shows a strand leading toward building geometry. Retain real visible facade selection, exact optional tap hits, and no catch teleport. |
| Swing duration | Physics article supports a continuous constraint rather than canned motion. Our timing is an original tuning choice: sustain an arc before a rising release, with a longer window while powering. |
| Bottom-of-arc power | Inference/design: concentrating player work near the low point makes the descent/rise rhythm legible. Power is tangential, speed tapered, and distinct from neutral assistance. |
| Release versus launch | Momentum continuity follows the article. Our up + WEB-release charge interaction is an original mobile adaptation, not a claimed PS2 mapping. Passive, automatic, and cancelled releases preserve velocity. |
| Steering | Design: direction follows velocity at arbitrary headings. Removed street-axis locking and the street-centering acceleration. |
| Wall transitions | Existing glancing-contact run, stamina and push-off are retained. Gait phase now follows distance travelled. No claim that the inspected recording demonstrated this wall-run implementation. |
| Silhouette | Recording distinguishes hanging reach from compact ground recovery. Our swing feet and torso respond to load/rise while the fixed-clock IK blend preserves bone lengths. Ground recovery was not copied because ground failure remains required. |
| Camera | Recording uses a following third-person view with changing pitch. Existing following camera and facade sweep are retained; camera behavior is not presented as a PS2 reproduction. |

## What changed

- Neutral stick no longer reels toward a target altitude or pulls the player toward a street center. FLOW still provides bounded tangential assistance and automatic chaining; it does not promise hands-off survival.
- Stronger lateral authority on-web and in the air. Power pumps through the bottom, progressively reels at 6 m/s, and tapers its added acceleration at high speed.
- Up while swinging earns charge; releasing WEB while still pushing up and rising spends charge for a bounded launch. A visible hint identifies the launch window. Pointer cancellation and lost capture never launch.
- Automatic facade ranking prefers higher catches and predicts 1.5 seconds rather than 0.9 seconds, covering the bottom of the first arc. Bad taps leave the current rope intact.
- More asymmetric loaded/rising leg poses, velocity-dependent swing pitch, and distance-driven wall gait.

No new runtime assets, libraries, build step, deployment changes, or changes to other games.

## Validation contracts

The original baseline passed 148/148 checks. This did not establish satisfactory movement.

Three obsolete tests required 45–180 seconds of automatic survival, including powered and varied inputs. Those depended on the removed centering/altitude controller. They are explicitly replaced with sustained-arc timing, a quarter turn with no neutral heading correction, progressive power, charged versus passive release, and rendered launch/recatch checks. The city activity test now advances three minutes independently of player survival. The tap-to-FLOW test checks the actual resumption transition rather than demanding fifteen seconds of subsequent survival.

Swept collision, unilateral rope/energy behavior, no catch teleport, precise taps, multitouch ownership, pause/cancel/reset, bone lengths, bounded city/mesh resources, day/night, floating origin, portrait/landscape and 320px layout checks remain.

Final result: **156/156 checks passed** in Chromium 140 and desktop WebKit 26.0 on Windows with Playwright 1.55.0. The tested raw HTML SHA-1 blob is `7f17a2f2a0fb21af71a90f69190ef169429a0724` (raw Windows working-file bytes, not a commit SHA). Rendered scenarios reported no WebGL errors.

Measured performance is environment-specific:

| Environment | Sample | Median / p95 frame interval | Simulation / wall time |
| --- | --- | --- | --- |
| In-app Chromium, RTX 5090 / D3D11, portrait iframe 390×844, drawing buffer 519×1123 | 1,717 parent RAF intervals during actual gameplay | 4.2 / 8.3 ms | 7.983 / 8.01 seconds (~1.00) |
| Headless Chromium 140, ANGLE SwiftShader, 390×844, separate live run with no captures | 41 RAF intervals | 133.3 / 416.7 ms | 5.333 / 6.22 seconds (~0.86) |

The first measures browser frame cadence alongside live simulation, not GPU render duration. The second is slow software rendering and exposes the existing 250 ms frame cap dropping simulation time under long stalls. Neither is evidence of physical-iPhone performance. Offline WebM clips are not used as FPS evidence.

Run the pinned dependency workflow in CODEX_HANDOFF.md, then:

```sh
python tests/web_swing_browser.py
# In another terminal, serve the repository:
python -m http.server 8000 --bind 127.0.0.1
python tests/web_swing_motion.py
```

The motion runner produces JPEG sequences and trajectories under `test-results/movement/`. Optionally set `FFMPEG_EXECUTABLE` to a local ffmpeg with MJPEG input and VP8/WebM output to encode clips. `MOTION_SCENARIOS=turn,power` reruns specific clips. Frames are offline 12 fps; the separate live sample in `performance.json` measures actual wall time. Captures are deliberately excluded from commits.

Set `PERFORMANCE_ONLY=1` to rerun the live software-browser measurement without captures.

## Visible limitations and next work

The eight-second neutral, powered-launch, wall-push-off and tap routes remain airborne. A deliberate intersection turn is demonstrated over four seconds with a real catch afterward. A poorly timed held turn collides with facades and ends at roughly 6.28 seconds. A low catch recovers but later loses nearly all speed at a facade. These outcomes are included in the capture set, not hidden by an invulnerability mode.

The character remains procedural and small in portrait view. Wall gait can look skittery at high speed, and close-wall camera framing can fill much of the view with a facade. Long neutral or all-up routes are not guaranteed; automatic selection still needs work after sustained wall contact. Next: player review of the swing/launch feel, improve wall-exit catch options without reintroducing automatic street steering, and test on a physical phone before making mobile-performance claims.
