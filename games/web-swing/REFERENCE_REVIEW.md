# Spider-Man 2 (2004) footage comparison

The owner explicitly confirmed **Spider-Man 2 (2004), PS2**, rejected the previous direct-control build, and asked to watch footage and replicate its traversal. This pass is still a prototype; it is not an exact reproduction or evidence of player acceptance.

## Footage actually inspected

[A.I Play's PS2 longplay](https://www.youtube.com/watch?v=UMBQwCJOegE&t=600s) was played in the browser. Timestamped frames were inspected through traversal from 10:00 to 11:13, with the 10:25–10:35 passage replayed more closely. This upload advertises enhanced shaders/textures and 60 fps; its appearance is not a pixel-accurate native PS2 capture. Input buttons, upgrades, and swing-control mode are not shown.

Observed in playback:

- Around 10:15, the character rises above the rooftops with the upper body open. The camera remains below and behind, allowing vertical movement within the frame.
- At 10:25–10:30, the descent moves from rooftop height into a street canyon. The camera shows the street ahead and the surrounding block, rather than only the character's back.
- Around 10:34–10:35, a visible web supports the rising arc. The legs fold forward before the next flight phase; the silhouette changes markedly across the arc.
- Around 11:01–11:02, a close facade pass leads into an attached rising swing. At 11:08–11:10, roof contact becomes running and a jump from the edge. At 11:13, the character descends alongside the next facade.

The [PS2 booklet](https://www.scribd.com/document/786519166/Spider-Man-2) remains the separate source for Normal/Easy controls and charged jumping. Footage does not establish exact acceleration, gravity, camera distances, or which buttons produced a particular move. All constants and procedural poses here are our implementation choices.

## Changes prompted by the comparison

**Direction selection replaces continuous rotation.** A stick gesture selects travel direction in the camera frame at the beginning of that gesture. The frame remains fixed until neutral, so a held right input completes a right turn and continues along that heading instead of circling endlessly while the camera rotates. Air turns preserve horizontal speed; taut-line turns project onto the rope tangent plane and preserve tangential speed. Neutral retains momentum. The camera's later recentering cannot keep rotating the chosen direction. This is an adaptation for the available mobile controls, not a verified copy of the original input implementation.

**The camera shows the traversal.** It trails more widely and follows heading more slowly than the rejected close-camera build. Vertical framing responds to rising/falling motion, and the character can move within the frame. The final camera arm still receives a swept obstruction check. Routine movement messages are smaller and moved out of the central action.

**Poses follow the swing.** Descent extends the legs behind the body; rope loading and progress through the bottom drive both knees forward. Charged jumps add compression. Release briefly opens the upper body while the legs finish their swing, before transitioning to flight. Banking follows lateral acceleration instead of remaining tilted merely because a direction is held. IK lengths and simulation-clock animation are retained.

**Roof contact becomes supported movement.** A swept top-surface collision records support, restores jump availability, and uses running/standing poses. A charged roof jump releases that support. This fixes the previous airborne pose and exhausted-jump state after landing on a roof.

**Optional city practice supplies the missing landing loop.** Open `games/web-swing/?practice` to start on the street, run, charge a takeoff, catch a web, and land without ending the session. A full ground charge supplies 36 m/s of upward takeoff velocity, versus the aerial jump's 24 m/s increment. A ground takeoff leaves one air jump available; subsequent air jumps cannot repeat indefinitely. The welcome panel and HUD explicitly label practice. This is an isolated landing experiment permitted by the handoff, not a silent replacement of the existing ground-failure run. The URL without `practice` keeps that original rule.

**Early catch inputs receive a bounded buffer.** A Normal WEB tap with no current reachable attachment stays pending for at most 0.4 seconds. It can connect as takeoff brings a real facade into reach. Expiry, pause and pointer cancellation clear the request. A successful catch consumes it; it does not enable automatic chaining. The initial 24 m/s ground-jump experiment failed both planned catches in the rendered practice sequence. The stronger ground takeoff and tested early-input transition replace that failed experiment.

## Validation and limits

The local Chromium/WebKit runner passed **196/196 checks** against runtime blob `850e503528200b8cdc1df66727fc22e6a3d31568`. New checks cover held-direction stability while the camera recenters, roof support/takeoff, catch-buffer expiry/cancellation, and the isolated street run/jump/catch/land loop. Existing real touch/keyboard, cancellation, no-teleport, rope energy, swept collision, screen ray, layout, rebase, and resource checks remain.

Two long-tap physics fixtures previously identified an attachment using a fixed screen coordinate. The wider camera makes that coordinate hit a different, lower facade. Those fixtures now use the exact same world-space point as the previous passing build: approximately `(30.5553, 66.8265, 168.9641)` on the same building. Their duration, energy, speed, and resumption requirements remain. Independent browser checks continue to validate actual screen taps and camera-ray alignment. A low but geometrically reachable tap can still be a poor swing choice; it is not claimed safe merely because the surface is reachable.

A faster-turn experiment hit the facade before a safe catch was available in the intersection fixture. The final turn rate retains the wider original quarter-turn arc, with the new behavior of settling onto the selected heading. This preserves the useful collision/catch test rather than changing its route to hide the failure.

`tests/web_swing_motion.py` captures nine rendered scenarios, including a 16-second city-practice run/takeoff/catch/landing sequence. Captures use fixed simulation steps at 12 fps and are **offline movement evidence**, not real-time frame-rate measurements. The final practice sequence makes two catches, one wall pass, and returns to a stationary street landing. Normal jumps, chaining, a quarter turn, precise tap, low catch and held-direction scenarios remain active at the end of their clips. The power clip stalls against a facade late in the sequence; the wall script still ends in ground failure at 7.35 seconds. These outcomes are included, not edited out.

A separate six-second live SwiftShader measurement recorded 150/349.9 ms median/p95, with 5.292 simulation seconds over 6.088 wall seconds at 390×844. A dedicated hardware-backed headless Chromium 140 run used the RTX 5090 through D3D11: 338 samples, 16.7/16.7 ms median/p95, 5.967 simulation seconds over 6.016 wall seconds, 390×844 drawing buffer, four catches and no GL error. This is desktop automated rendering, not a physical-phone measurement. The in-app preview was background-throttled during this review and supplies no separate foreground-performance claim.

Remaining differences include two-web braking, controller/right-stick camera mapping, wall crawling, exact swing tuning, authored character animation, original map/art, and the complete ground-traversal system. Up-stick power and reeling remain an adaptation of the earlier build. Existing adverse-input routes and head-on facade stalls must remain visible in the review. Do not call this 1:1 or infer acceptance from automated checks.

Work is restricted to PR #10's development branch. No merge, deployment, external runtime dependency, or proprietary asset extraction is part of this update.
