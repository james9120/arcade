# Pallet Town walk

A small browser prototype: walk a low-poly Pallet Town in 3D, step into the tall grass, and fight one wild encounter. It is a personal experiment. The site does not ship Nintendo or Game Freak artwork, music, names, or data.

The arcade Pages workflow builds this folder and publishes `dist/` at [/pallet-3d/](https://james9120.github.io/arcade/pallet-3d/). `vite.config.ts` sets `base` to `/arcade/pallet-3d/` so asset URLs match that subpath.

## Two ways to play

**Demo.** No ROM. The town is an original block layout (houses, a lab, fences, trees, south water, north grass) drawn with simple colors and primitives. The battle is between two made-up creatures, Bramblo and Pebblit.

**Your ROM.** On the title screen, choose a Pokémon FireRed **US v1.0** file (`.gba`, header game code `BPRE`, revision byte 0). The page reads it in the browser and never uploads it. From that file it builds Pallet Town (layout, metatiles, tileset graphics, palettes, collision) and the stats and names for one partner species and one tall-grass encounter. A few rows of the north-connected map are stitched on so the grass at the north edge is walkable.

If the header is not FireRed US v1.0, the page explains why and leaves you on the title screen.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (the dev server uses port **47321**, and the page is served under `/arcade/pallet-3d/`).

```bash
npm test
npm run build
```

`npm run build` typechecks and writes a static site to `dist/`. Serve that folder with any static host; the ROM never needs a backend.

## Controls

- **W A S D** or arrow keys to walk one tile at a time
- On-screen **N E S W** pad for touchscreens and a Steam Deck browser
- In battle: **Fight** and **Run** (or **F** and **R**)

Tall grass can start a battle. After a few steps in the grass, one is guaranteed so you can finish the loop. Run works most of the time. Winning, losing, or running returns you to the map.

## What the ROM parser uses

Formats and addresses come from the public [pret/pokefirered](https://github.com/pret/pokefirered) decompilation (US v1.0 symbol addresses and the C struct layouts). This repo does not vendor that project's graphics or data. Offsets live in `src/rom/constants.ts`.

The parser checks the GBA header, follows the map-group table to Pallet Town, decompresses LZ77 tilesets when the tileset says they are compressed, and reads species names plus base stats from the species tables. Tests build a tiny synthetic ROM in memory. They do not contain real ROM bytes.

## Untested without a real ROM

Unit tests cover the header checks, LZ77, text decoding, metatile blitting, and a handmade mini-ROM. They do not prove the graphics, collision, or encounter rows of an actual FireRed cart image. In particular, these still need a real US v1.0 file:

- Whether Pallet Town's tileset decompresses and lines up (metatile layer order, palette slots, primary/secondary split)
- Whether buildings, trees, and fences classify into sensible box heights
- Whether the north-connection offset lines Route 1's grass up with the town
- Whether the species-name bytes for the partner and the grass encounter decode the way you expect

If a real ROM fails, the page should show a short error instead of drawing garbage dimensions. Demo mode does not depend on any of that.
