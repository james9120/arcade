# Web Swing — agent instructions

Scope: this directory. For Web Swing tasks, also read `games/web-swing/CODEX_HANDOFF.md` from the repository root before changing code or related tests.

## Product direction

The current game is an unaccepted prototype. The owner wants the feeling of the PS2 Spider-Man game, provisionally Spider-Man 2 (2004), not merely an automated controller that stays airborne. The exact title was not confirmed. Prioritize a controllable, satisfying swing/launch rhythm, clear movement, camera framing and strong animated poses before adding spectacle.

The latest approved interaction direction is movement-only left stick with useful up-stick power, natural automatic web selection, optional tap-to-swing, and close-pass wall running. Do not reintroduce a separate thumb-controlled anchor cursor. The original ground-contact failure rule remains in force until the owner approves changing it; landing/free-roam alternatives are proposals, not approved replacements.

## Engineering boundaries

- Work on the task/development branch and preserve owner changes. Do not merge or deploy without an explicit request.
- Do not alter other Arcade games, the homepage, account permissions or deployment workflows for this task.
- The existing runtime is self-contained HTML/CSS/JS with generated assets and no runtime downloads. Keep static-host compatibility. Discuss required build/dependency/external-asset changes before introducing them.
- Keep safety properties: valid visible anchors; no unintended attachment teleport; swept collision protection; separate scene/HUD/multi-touch ownership; finite state; bounded city/GPU resources; pause/cancel/restart cleanup; stable floating-origin behavior.
- Refactor rather than continually layering competing assistance rules. Document deliberate changes to gameplay contracts and corresponding tests.
- Use original or appropriately licensed assets. Do not extract proprietary PS2 game assets or code.

## Validation

From the repo root, use `python tests/web_swing_browser.py` after installing the repository-pinned Playwright dependency and browsers as documented in the handoff. The JS suites run inside browsers. Runtime currently exposes diagnostics only under `?test`.

Review real rendered movement, not only assertions or still screenshots. Test low/high swings, release/launch, turns, wall entry/exit and imperfect inputs. Measure frame times on the environment actually used. Never describe offline rendering or desktop software WebKit as physical-iPhone performance. Keep generated captures out of commits unless deliberately needed and reviewed.

Do not weaken tests merely to make CI green. Replace obsolete design expectations explicitly, while retaining correctness and input-safety checks. Report automated results, visible defects, measured performance and subjective/player acceptance separately. Never claim AAA/completely polished/defect-free status from test counts.

## Continuity

Record decisions and remaining work in the handoff or a neighboring progress note so later Codex tasks can continue without the ChatGPT conversation. Return a short account of the playable result, validation performed and remaining issues; distinguish branch/PR state from live deployment.
