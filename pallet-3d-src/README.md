# Pallet Town walk

A ROM-first walk from Pallet Town north into Route 1. The page does not ship Nintendo or Game Freak artwork, music, names, or data. You bring a Pokémon FireRed **US v1.0** file (`.gba`, header game code `BPRE`, revision byte 0). The page reads it in the browser and never uploads it.

From that file it builds:

- Pallet Town and the connected Route 1 map (layout, metatiles, tileset graphics, palettes, collision)
- The on-foot overworld sprite
- One of Bulbasaur, Charmander, or Squirtle, with base stats, types, a level-up move, and front/back sprites
- Route 1's tall-grass encounter table

The arcade Pages workflow builds this folder and publishes `dist/` at [/pallet-3d/](https://james9120.github.io/arcade/pallet-3d/). `vite.config.ts` sets `base` to `/arcade/pallet-3d/` so asset URLs match that subpath.

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

`npm run build` typechecks and writes a static site to `dist/`. Unit tests use a synthetic ROM only. To check a real US v1.0 file locally, without writing anything extracted from it into the repo:

```bash
FIRERED_ROM=/path/to/your.gba npm test
```

## Controls

- **W A S D** or arrow keys to walk one tile at a time
- On-screen **N E S W** pad
- Weather changes on its own: clear, clouds, light rain, heavy rain, then clear again. Route 1 is on a different part of that cycle than Pallet Town. Wet ground darkens, puddles grow, and both dry out after the rain. Add `?weather=rain` to hold a downpour while testing.
- In battle: **Fight** and **Run** (or **F** and **R**)

Tall grass on Route 1 can start a battle. After a few steps in the grass, one is guaranteed. Run works most of the time.

## What the parser uses

Formats and addresses come from the public [pret/pokefirered](https://github.com/pret/pokefirered) decompilation (US v1.0 symbol addresses and the C struct layouts). This repo does not vendor that project's graphics or data. Offsets live in `src/rom/constants.ts`.
