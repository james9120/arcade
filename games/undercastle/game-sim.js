
  "use strict";

  var EMPTY = 0, SOIL = 1, SAND = 2, STONE = 3, WATER = 4, CRYSTAL = 5, MUSHROOM = 6;
  var CELL = 7, PX = 4, GROW = 0.00016;
  var SOLID = [0, 1, 1, 1, 0, 1, 1];

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  var statsEl = document.getElementById("stats");
  var muteBtn = document.getElementById("mute");
  var buttons = document.querySelectorAll("#tools button");

  var W = 0, H = 0, N = 0, cssW = 0, cssH = 0, dpr = 1;
  var grid, spans, visited, moved, queue, sealed, light, glowR, glowG, glowB, colLight, packed;
  var off, offCtx, img, pix, imgW = 0, imgH = 0;

  var tool = "soil";
  var simTick = 0, frameTick = 0;
  var rooms = 0, alive = 0, lastHud = "";
  var painting = false, lastX = -1, lastY = -1;
  var hoverX = 0, hoverY = 0, hoverOn = false;
  var shake = 0, caveAcc = 0, caveCool = 0;
  var muted = false;

  var PMAX = 160, pc = 0;
  var px = new Float32Array(PMAX), py = new Float32Array(PMAX);
  var pvx = new Float32Array(PMAX), pvy = new Float32Array(PMAX);
  var plife = new Float32Array(PMAX), pmax = new Float32Array(PMAX);
  var pr = new Uint8Array(PMAX), pg = new Uint8Array(PMAX), pb = new Uint8Array(PMAX);

  var motes = [];
  var audio = null;

  var SAVE_KEY = "undercastle.v1";
  var appEl = document.getElementById("app");
  var goalEl = document.getElementById("goal");
  var toastEl = document.getElementById("toast");
  var stampEl = document.getElementById("stamp");
  var menuBtn = document.getElementById("menu");
  var mute2 = document.getElementById("btn-mute2");
  var screen = "title";
  var playing = false;
  var mode = "sandbox";
  var charterStep = 0;
  var charterDone = false;
  var hallTime = 0;
  var goldFlash = 0;
  var dirty = false;
  var lastSaveAt = 0;
  var lastFrameT = 0;
  var toastT = 0;
  var loadedOnce = false;
  var pendingSave = null;

  function clamp8(v) {
    return v < 0 ? 0 : v > 255 ? 255 : v | 0;
  }

  function hash(x, y) {
    var n = ((x * 374761393) + (y * 668265263)) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return n >>> 0;
  }

  function alloc() {
    grid = new Uint8Array(N);
    spans = new Uint16Array(N);
    visited = new Uint8Array(N);
    moved = new Uint8Array(N);
    queue = new Int32Array(N);
    sealed = new Uint8Array(N);
    light = new Float32Array(N);
    glowR = new Float32Array(N);
    glowG = new Float32Array(N);
    glowB = new Float32Array(N);
    colLight = new Float32Array(W);
    packed = new Uint8Array(N);
    imgW = W * PX;
    imgH = H * PX;
    off = document.createElement("canvas");
    off.width = imgW;
    off.height = imgH;
    offCtx = off.getContext("2d", { alpha: false });
    img = offCtx.createImageData(imgW, imgH);
    pix = img.data;
  }

  function generate() {
    grid.fill(EMPTY);
    sealed.fill(0);
    if (packed) packed.fill(0);
    var x, y;
    for (y = H - 3; y < H; y++) {
      for (x = 0; x < W; x++) grid[y * W + x] = STONE;
    }
    pc = 0;
    shake = 0;
    caveAcc = 0;
    caveCool = 0;
    rooms = 0;
    alive = 0;
    hallTime = 0;
    dirty = true;
    seedMotes();
  }

  function seedMotes() {
    motes.length = 0;
    var i, n = 14;
    for (i = 0; i < n; i++) {
      motes.push({
        x: Math.random() * Math.max(W, 1),
        y: Math.random() * Math.max(H * 0.55, 1),
        vx: (Math.random() - 0.5) * 0.015,
        vy: (Math.random() - 0.4) * 0.01,
        ph: Math.random() * 6.28
      });
    }
  }

  function fit() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = canvas.clientWidth;
    var ch = canvas.clientHeight;
    if (cw < 8 || ch < 8) return false;
    cssW = cw;
    cssH = ch;
    canvas.width = (cw * dpr) | 0;
    canvas.height = (ch * dpr) | 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    var nw = Math.max(24, (cw / CELL) | 0);
    var nh = Math.max(24, (ch / CELL) | 0);
    if (nw !== W || nh !== H) {
      var oldG = grid, oldW = W, oldH = H;
      W = nw;
      H = nh;
      N = W * H;
      alloc();
      generate();
      if (oldG && oldW) blitGrid(oldG, oldW, oldH);
      else if (!loadedOnce) {
        loadedOnce = true;
        bootSave();
      }
    }
    return true;
  }

  function blitGrid(src, sw, sh) {
    var cw = Math.min(W, sw), ch = Math.min(H, sh), x, y;
    for (y = 0; y < ch; y++) {
      var sy = sh - ch + y, dy = H - ch + y;
      for (x = 0; x < cw; x++) grid[dy * W + x] = src[sy * sw + x];
    }
  }

  function nearStone(x, y) {
    var dx, dy, xx, yy;
    for (dy = -1; dy <= 1; dy++) {
      yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      for (dx = -1; dx <= 1; dx++) {
        xx = x + dx;
        if (xx < 0 || xx >= W) continue;
        if (grid[yy * W + xx] === STONE) return true;
      }
    }
    return false;
  }

  function spawnDust(x, y, n, r, g, b) {
    var i, k;
    for (k = 0; k < n; k++) {
      if (pc >= PMAX) {
        for (i = 0; i < PMAX; i++) if (plife[i] <= 0) { pc = i; break; }
        if (plife[pc] > 0) return;
      }
      i = pc;
      px[i] = x + (Math.random() - 0.5) * 1.4;
      py[i] = y + (Math.random() - 0.2) * 0.8;
      pvx[i] = (Math.random() - 0.5) * 0.55;
      pvy[i] = -0.12 - Math.random() * 0.28;
      plife[i] = 34 + (Math.random() * 28) | 0;
      pmax[i] = plife[i];
      pr[i] = r; pg[i] = g; pb[i] = b;
      pc = i + 1;
    }
  }

  function tryCrumble(x, y, ch) {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    var i = y * W + x;
    if (grid[i] !== SOIL) return 0;
    if (packed[i] > 0) return 0;
    if (nearStone(x, y)) return 0;
    if (Math.random() >= ch) return 0;
    grid[i] = SAND;
    return 1;
  }

  function crumbleNear(x, y, span) {
    var ch = 0.07 + span * 0.028;
    if (ch > 0.42) ch = 0.42;
    return tryCrumble(x - 1, y, ch)
      + tryCrumble(x + 1, y, ch)
      + tryCrumble(x, y - 1, ch * 0.82)
      + tryCrumble(x - 1, y - 1, ch * 0.48)
      + tryCrumble(x + 1, y - 1, ch * 0.48);
  }

  function failSpan(x0, x1, y, span) {
    var mid = (x0 + x1 - 1) * 0.5;
    var n = 0;
    var cap, x, i, dist, half, center, chance, runCh;
    if (span < 8) return 0;
    cap = span >= 14 ? 4 : span >= 9 ? 3 : 2;
    half = span * 0.5;
    for (x = x0; x < x1 && n < cap; x++) {
      i = y * W + x;
      if (grid[i] !== SOIL) continue;
      if (packed[i] > 0) continue;
      if (nearStone(x, y)) continue;
      dist = x > mid ? x - mid : mid - x;
      center = 1 - dist / (half + 0.25);
      if (center < 0) center = 0;
      if (span < 6) chance = 0.035 * center;
      else {
        chance = (0.09 + (span - 6) * 0.05) * (0.22 + 0.78 * center);
        if (chance > 0.48) chance = 0.48;
      }
      if (Math.random() < chance) {
        grid[i] = SAND;
        n++;
        n += crumbleNear(x, y, span);
      }
    }
    if (n && span >= 6) {
      runCh = 0.12 + Math.min(0.22, (span - 6) * 0.025);
      for (x = x0; x < x1; x++) {
        i = y * W + x;
        if (grid[i] !== SOIL || packed[i] > 0 || nearStone(x, y)) continue;
        if (Math.random() < runCh) {
          grid[i] = SAND;
          n++;
        }
      }
    }
    return n;
  }

  function collapseJuice(n, ax, ay) {
    if (caveCool > 0) caveCool--;
    if (n <= 0) {
      caveAcc *= 0.8;
      return;
    }
    caveAcc = caveAcc * 0.7 + n;
    var dust = n <= 2 ? 2 : n <= 6 ? 3 + (n >> 1) : Math.min(12, 6 + (n >> 2));
    spawnDust(ax, ay, dust, 196, 164, 104);
    if (caveAcc < 3) return;
    if (caveAcc < 7) {
      shake = Math.max(shake, 0.26 + caveAcc * 0.05);
      return;
    }
    if (caveCool > 0) return;
    shake = Math.min(3.4, Math.max(shake, 0.95 + caveAcc * 0.07));
    sfxRumble(caveAcc | 0);
    caveCool = 40;
    caveAcc *= 0.35;
  }

  function decayPacked() {
    var x, y, i, left, right, below;
    if ((simTick % 12) !== 0) return;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        if (grid[i] !== SOIL || packed[i] === 0) continue;
        left = x > 0 ? grid[i - 1] : STONE;
        right = x < W - 1 ? grid[i + 1] : STONE;
        below = y < H - 1 ? grid[i + W] : STONE;
        if (below === EMPTY || (left === EMPTY && right === EMPTY)) packed[i]--;
      }
    }
  }

  function soilRepose() {
    var x, y, i, n = 0, left, right, below, dir, side, down, hgt, yy;
    for (y = 0; y < H - 1; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        if (grid[i] !== SOIL || packed[i] > 0) continue;
        if (nearStone(x, y)) continue;
        left = x > 0 ? grid[i - 1] : STONE;
        right = x < W - 1 ? grid[i + 1] : STONE;
        below = grid[i + W];
        if (left === EMPTY && right === EMPTY && SOLID[below]) {
          hgt = 1;
          for (yy = y - 1; yy >= 0 && hgt < 8; yy--) {
            if (grid[yy * W + x] !== SOIL) break;
            if ((x > 0 && grid[yy * W + x - 1] !== EMPTY) || (x < W - 1 && grid[yy * W + x + 1] !== EMPTY)) break;
            hgt++;
          }
          if (hgt >= 4 && Math.random() < 0.04) {
            grid[i] = SAND;
            n++;
            continue;
          }
        }
        for (dir = -1; dir <= 1; dir += 2) {
          if (x + dir < 0 || x + dir >= W) continue;
          side = grid[i + dir];
          down = grid[i + W + dir];
          if (side !== EMPTY || down !== EMPTY) continue;
          var back = dir === -1 ? right : left;
          if (SOLID[below] && SOLID[back]) continue;
          if (Math.random() < 0.016) {
            grid[i] = SAND;
            n++;
            break;
          }
        }
      }
    }
    return n;
  }

  function caveIn() {
    var x, y, x0, x1, row, below, span, i, n = 0, ax = 0, ay = 0, got = 0;
    decayPacked();
    for (y = 0; y < H - 1; y++) {
      row = y * W;
      below = row + W;
      x = 0;
      while (x < W) {
        if (grid[row + x] === SOIL && grid[below + x] === EMPTY) {
          x0 = x;
          x1 = x + 1;
          while (x1 < W && grid[row + x1] === SOIL && grid[below + x1] === EMPTY) x1++;
          span = x1 - x0;
          for (x = x0; x < x1; x++) {
            i = row + x;
            spans[i] = span;
            if (packed[i] > 0) packed[i]--;
          }
          got = failSpan(x0, x1, y, span);
          if (got) {
            n += got;
            ax += ((x0 + x1 - 1) * 0.5) * got;
            ay += y * got;
          }
          x = x1;
        } else {
          spans[row + x] = 0;
          x++;
        }
      }
    }
    got = slumpRun();
    if (got) {
      n += got;
      if (!ax && !ay) { ax = W * 0.5 * got; ay = (H * 0.5) * got; }
    }
    got = soilRepose();
    if (got) {
      n += got;
      if (!ax && !ay) { ax = W * 0.5 * got; ay = (H * 0.5) * got; }
    }
    collapseJuice(n, n ? ax / n : 0, n ? ay / n : 0);
    return n;
  }

  function slumpRun() {
    var x, y, i, below, ch, n = 0, cap = 10, sandAdj;
    for (y = 0; y < H - 1 && n < cap; y++) {
      for (x = 0; x < W && n < cap; x++) {
        i = y * W + x;
        if (grid[i] !== SOIL || packed[i] > 0) continue;
        if (nearStone(x, y)) continue;
        below = grid[i + W];
        if (below !== EMPTY && below !== SAND) continue;
        sandAdj = below === SAND
          || (x > 0 && grid[i - 1] === SAND)
          || (x < W - 1 && grid[i + 1] === SAND)
          || (y > 0 && grid[i - W] === SAND);
        if (!sandAdj) continue;
        ch = below === SAND ? 0.18 : 0.10;
        if (spans[i] >= 6) ch += 0.10;
        else if (spans[i] >= 4) ch += 0.04;
        if (Math.random() < ch) {
          grid[i] = SAND;
          n++;
        }
      }
    }
    return n;
  }

  function swapInto(i, dest) {
    var t = grid[dest];
    grid[dest] = grid[i];
    grid[i] = t;
    moved[dest] = 1;
  }

  function sandOpen(i) {
    var t = grid[i];
    return t === EMPTY || t === WATER;
  }

  function sandSteep(dest) {
    if (!sandOpen(dest)) return 0;
    if (dest + W >= N) return 1;
    return sandOpen(dest + W) ? 2 : 1;
  }

  function stepSand() {
    moved.fill(0);
    var x, y, n, i, d, ltr, dest, ls, rs;
    for (y = H - 2; y >= 0; y--) {
      ltr = ((y + simTick) & 1) === 0;
      for (n = 0; n < W; n++) {
        x = ltr ? n : W - 1 - n;
        i = y * W + x;
        if (grid[i] !== SAND || moved[i]) continue;
        d = i + W;
        if (sandOpen(d)) {
          swapInto(i, d);
          continue;
        }
        ls = x > 0 ? sandSteep(d - 1) : 0;
        rs = x < W - 1 ? sandSteep(d + 1) : 0;
        if (ls < 2 && rs < 2) {
          if (ls !== 1 && rs !== 1) continue;
          if ((simTick & 7) !== 0) continue;
          if ((hash(x, y) % 5) !== 0) continue;
        }
        if (ls > rs) dest = d - 1;
        else if (rs > ls) dest = d + 1;
        else dest = ((hash(x, y) & 1) ? d + 1 : d - 1);
        swapInto(i, dest);
      }
    }
  }

  function tryEmpty(i, dest) {
    if (grid[dest] !== EMPTY) return false;
    grid[dest] = WATER;
    grid[i] = EMPTY;
    moved[dest] = 1;
    return true;
  }

  function lookDrop(x, y, dir, maxd) {
    var d, xx, t, below;
    for (d = 1; d <= maxd; d++) {
      xx = x + dir * d;
      if (xx < 0 || xx >= W) return 99;
      t = grid[y * W + xx];
      if (t !== EMPTY && t !== WATER) return 99;
      if (y < H - 1) {
        below = grid[(y + 1) * W + xx];
        if (below === EMPTY) return d;
      }
    }
    return 99;
  }

  function countEmpty(x, y, dir) {
    var d, xx, t, n = 0;
    for (d = 1; d <= 8; d++) {
      xx = x + dir * d;
      if (xx < 0 || xx >= W) return n;
      t = grid[y * W + xx];
      if (t !== EMPTY) return n;
      n++;
    }
    return n;
  }

  function stepWater() {
    moved.fill(0);
    var x, y, n, i, ltr, dl, dr, ld, rd, le, re;
    for (y = H - 2; y >= 0; y--) {
      ltr = ((y + simTick) & 1) === 0;
      for (n = 0; n < W; n++) {
        x = ltr ? n : W - 1 - n;
        i = y * W + x;
        if (grid[i] !== WATER || moved[i]) continue;
        if (tryEmpty(i, i + W)) continue;
        dl = x > 0 && grid[i + W - 1] === EMPTY;
        dr = x < W - 1 && grid[i + W + 1] === EMPTY;
        if (dl || dr) {
          if (dl && dr) {
            ld = (y + 2 < H && grid[i + W + W - 1] === EMPTY) ? 0 : 1;
            rd = (y + 2 < H && grid[i + W + W + 1] === EMPTY) ? 0 : 1;
            if (ld !== rd) tryEmpty(i, ld < rd ? i + W - 1 : i + W + 1);
            else tryEmpty(i, (hash(x, y) & 1) ? i + W + 1 : i + W - 1);
          } else if (dl) tryEmpty(i, i + W - 1);
          else tryEmpty(i, i + W + 1);
          continue;
        }
        ld = lookDrop(x, y, -1, 12);
        rd = lookDrop(x, y, 1, 12);
        if (ld < 99 || rd < 99) {
          if (ld < rd && x > 0) tryEmpty(i, i - 1);
          else if (rd < ld && x < W - 1) tryEmpty(i, i + 1);
          else if (ld === rd) {
            if ((hash(x, y) & 1) && x < W - 1) tryEmpty(i, i + 1);
            else if (x > 0) tryEmpty(i, i - 1);
          }
          continue;
        }
        if (grid[i + W] === WATER) {
          dl = x > 0 && grid[i - 1] === EMPTY;
          dr = x < W - 1 && grid[i + 1] === EMPTY;
          if (dl && dr) {
            le = countEmpty(x, y, -1);
            re = countEmpty(x, y, 1);
            if (le !== re) tryEmpty(i, le > re ? i - 1 : i + 1);
            else tryEmpty(i, (hash(x, y) & 1) ? i + 1 : i - 1);
          } else if (dl) tryEmpty(i, i - 1);
          else if (dr) tryEmpty(i, i + 1);
          continue;
        }
        if (x > 1 && grid[i - 1] === EMPTY && grid[i - 2] === WATER) tryEmpty(i, i - 1);
        else if (x < W - 2 && grid[i + 1] === EMPTY && grid[i + 2] === WATER) tryEmpty(i, i + 1);
      }
    }
  }

  function adjWater(p, x, y) {
    if (x > 0 && grid[p - 1] === WATER) return true;
    if (x < W - 1 && grid[p + 1] === WATER) return true;
    if (y > 0 && grid[p - W] === WATER) return true;
    if (y < H - 1 && grid[p + W] === WATER) return true;
    return false;
  }

  function life() {
    visited.fill(0);
    sealed.fill(0);
    rooms = 0;
    alive = 0;
    var i, p, x, y, qh, qt, sky, wet, grow, k, below, newC = 0;
    for (i = 0; i < N; i++) {
      if (grid[i] === CRYSTAL || grid[i] === MUSHROOM) alive++;
    }
    for (i = 0; i < N; i++) {
      if (grid[i] !== EMPTY || visited[i]) continue;
      qh = 0;
      qt = 0;
      queue[qt++] = i;
      visited[i] = 1;
      sky = false;
      wet = false;
      while (qh < qt) {
        p = queue[qh++];
        x = p % W;
        y = (p / W) | 0;
        if (y === 0) sky = true;
        if (!wet && adjWater(p, x, y)) wet = true;
        if (x > 0 && grid[p - 1] === EMPTY && !visited[p - 1]) { visited[p - 1] = 1; queue[qt++] = p - 1; }
        if (x < W - 1 && grid[p + 1] === EMPTY && !visited[p + 1]) { visited[p + 1] = 1; queue[qt++] = p + 1; }
        if (y > 0 && grid[p - W] === EMPTY && !visited[p - W]) { visited[p - W] = 1; queue[qt++] = p - W; }
        if (y < H - 1 && grid[p + W] === EMPTY && !visited[p + W]) { visited[p + W] = 1; queue[qt++] = p + W; }
      }
      if (sky) continue;
      if (qt < 10) continue;
      rooms++;
      for (k = 0; k < qt; k++) sealed[queue[k]] = 1;
      grow = wet ? MUSHROOM : CRYSTAL;
      for (k = 0; k < qt; k++) {
        p = queue[k];
        y = (p / W) | 0;
        if (y >= H - 1) continue;
        below = grid[p + W];
        if (below !== SOIL && below !== SAND && below !== STONE) continue;
        if (Math.random() < GROW) {
          grid[p] = grow;
          alive++;
          if (grow === CRYSTAL) newC++;
        }
      }
    }
    if (newC > 0) sfxChime();
  }
