
  function step() {
    caveIn();
    stepSand();
    stepWater();
    life();
    simTick++;
  }

  function stampGlow(cx, cy, r, g, b, rad) {
    var dx, dy, xx, yy, i, d, f;
    for (dy = -rad; dy <= rad; dy++) {
      yy = cy + dy;
      if (yy < 0 || yy >= H) continue;
      for (dx = -rad; dx <= rad; dx++) {
        xx = cx + dx;
        if (xx < 0 || xx >= W) continue;
        d = dx * dx + dy * dy;
        if (d > rad * rad) continue;
        f = 1 - Math.sqrt(d) / (rad + 0.35);
        f *= f;
        i = yy * W + xx;
        glowR[i] += r * f;
        glowG[i] += g * f;
        glowB[i] += b * f;
      }
    }
  }

  function computeLight() {
    var x, y, i, t, pass, L, a, dx, dy, xx, yy, blocked, pulse, sunX, cave;
    glowR.fill(0);
    glowG.fill(0);
    glowB.fill(0);
    sunX = W * 0.5;

    for (x = 0; x < W; x++) {
      colLight[x] = 0.9 + 0.1 * Math.max(0, 1 - Math.abs(x - sunX) / (W * 0.55));
    }
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        t = grid[i];
        if (t === EMPTY || t === CRYSTAL || t === MUSHROOM) {
          light[i] = colLight[x];
          colLight[x] *= 0.9994;
        } else if (t === WATER) {
          light[i] = colLight[x] * 0.8;
          colLight[x] *= 0.88;
        } else {
          light[i] = colLight[x] * 0.7;
          colLight[x] *= t === STONE ? 0.55 : 0.42;
        }
        if (colLight[x] < 0.16) colLight[x] = 0.16;
      }
    }

    for (pass = 0; pass < 2; pass++) {
      for (y = 0; y < H; y++) {
        for (x = 0; x < W; x++) {
          i = y * W + x;
          t = grid[i];
          if (t !== EMPTY && t !== WATER && t !== CRYSTAL && t !== MUSHROOM) continue;
          L = light[i];
          if (x > 0 && light[i - 1] * 0.72 > L) L = light[i - 1] * 0.72;
          if (x < W - 1 && light[i + 1] * 0.72 > L) L = light[i + 1] * 0.72;
          if (y > 0 && light[i - W] * 0.84 > L) L = light[i - W] * 0.84;
          light[i] = L;
        }
      }
    }

    pulse = 0.62 + 0.38 * Math.sin(frameTick * 0.075);
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        t = grid[i];
        if (t === CRYSTAL) stampGlow(x, y, 0.55, 0.42, 0.95, 4);
        else if (t === MUSHROOM) stampGlow(x, y, 0.9 * pulse, 0.42 * pulse, 0.1 * pulse, 3);
      }
    }

    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        t = grid[i];
        blocked = 0;
        for (dy = -1; dy <= 1; dy++) {
          yy = y + dy;
          for (dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            xx = x + dx;
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) { blocked++; continue; }
            if (SOLID[grid[yy * W + xx]]) blocked++;
          }
        }
        a = blocked * 0.125;
        L = light[i] * (1 - a * 0.36);
        if (sealed[i]) L *= 0.32;
        else {
          cave = 0;
          if (y > 0 && sealed[i - W]) cave++;
          if (y < H - 1 && sealed[i + W]) cave++;
          if (x > 0 && sealed[i - 1]) cave++;
          if (x < W - 1 && sealed[i + 1]) cave++;
          if (cave) L *= 1 - 0.11 * cave;
        }
        L *= 1 - ((x / W - 0.5) * (x / W - 0.5) * 0.35 + (y / H) * (y / H) * 0.08);
        if (t === EMPTY || t === WATER || t === CRYSTAL || t === MUSHROOM) {
          if (sealed[i] && t === EMPTY) light[i] = L < 0.18 ? 0.18 : L > 1.2 ? 1.2 : L;
          else light[i] = L < 0.12 ? 0.12 : L > 1.2 ? 1.2 : L;
        } else {
          light[i] = L < 0.22 ? 0.22 : L > 1.2 ? 1.2 : L;
        }
      }
    }
  }

  function nearWaterCell(x, y) {
    var i = y * W + x;
    if (x > 0 && grid[i - 1] === WATER) return true;
    if (x < W - 1 && grid[i + 1] === WATER) return true;
    if (y > 0 && grid[i - W] === WATER) return true;
    if (y < H - 1 && grid[i + W] === WATER) return true;
    return false;
  }

  function writeAlbedo() {
    var x, y, i, t, sx, sy, o, row, base, hr, hg, hb, n, facet, h, surface, g, band;
    var sunX = W * 0.5, sunY = H * 0.055, dx, dy, sun, skyT, tw, spark, u, t2;
    var emptyAbove, waterAbove;

    for (y = 0; y < H; y++) {
      skyT = y / (H * 0.42);
      for (x = 0; x < W; x++) {
        i = y * W + x;
        t = grid[i];
        h = hash(x, y);
        emptyAbove = y === 0 || grid[i - W] === EMPTY || grid[i - W] === CRYSTAL || grid[i - W] === MUSHROOM;
        waterAbove = y > 0 && grid[i - W] === WATER;

        if (t === EMPTY) {
          if (sealed[i]) {
            hr = 28; hg = 24; hb = 48;
          } else {
            u = y / Math.max(1, H - 4);
            if (u > 1) u = 1;
            if (u < 0.32) {
              t2 = u / 0.32;
              hr = (198 * (1 - t2) + 110 * t2) | 0;
              hg = (122 * (1 - t2) + 68 * t2) | 0;
              hb = (68 * (1 - t2) + 78 * t2) | 0;
            } else {
              t2 = (u - 0.32) / 0.68;
              hr = (110 * (1 - t2) + 48 * t2) | 0;
              hg = (68 * (1 - t2) + 36 * t2) | 0;
              hb = (78 * (1 - t2) + 62 * t2) | 0;
            }
          }
        } else if (t === SOIL) {
          surface = emptyAbove && !waterAbove;
          g = h % 8;
          if (surface) {
            hr = 138; hg = 92; hb = 48;
          } else {
            hr = g === 0 ? 120 : g < 4 ? 148 : 110;
            hg = g === 0 ? 78 : g < 4 ? 98 : 70;
            hb = g === 0 ? 40 : g < 4 ? 52 : 36;
          }
          if (y < H - 1 && grid[i + W] === EMPTY && spans[i] >= 3) {
            var stress = spans[i] >= 6 ? 0.70 : spans[i] >= 4 ? 0.82 : 0.90;
            hr = (hr * stress) | 0;
            hg = (hg * stress) | 0;
            hb = (hb * stress) | 0;
          }
        } else if (t === SAND) {
          g = h % 3;
          hr = g === 0 ? 184 : g === 1 ? 214 : 198;
          hg = g === 0 ? 148 : g === 1 ? 180 : 164;
          hb = g === 0 ? 86 : g === 1 ? 112 : 98;
        } else if (t === STONE) {
          g = h % 5;
          if (y >= H - 3) {
            if (y === H - 3) { hr = 150 + (g < 2 ? 10 : 0); hg = 132; hb = 104; }
            else if (y === H - 2) { hr = 128 + (g === 0 ? 10 : 0); hg = 114; hb = 96; }
            else { hr = 108 + (g === 0 ? 12 : 0); hg = 98; hb = 86; }
          } else {
            hr = g === 0 ? 168 : g === 1 ? 148 : 132;
            hg = g === 0 ? 158 : g === 1 ? 140 : 126;
            hb = g === 0 ? 142 : g === 1 ? 128 : 116;
          }
        } else if (t === WATER) {
          g = (x + y + (frameTick >> 3)) & 3;
          hr = g === 0 ? 54 : 28;
          hg = g === 0 ? 130 : g === 1 ? 92 : 74;
          hb = g === 0 ? 196 : g === 1 ? 154 : 128;
          if (emptyAbove) { hr = 148; hg = 214; hb = 236; }
        } else if (t === CRYSTAL) {
          g = h % 4;
          if (g === 0) { hr = 124; hg = 92; hb = 210; }
          else if (g === 1) { hr = 94; hg = 234; hb = 212; }
          else if (g === 2) { hr = 176; hg = 140; hb = 250; }
          else { hr = 103; hg = 232; hb = 249; }
        } else {
          g = h % 3;
          hr = g === 0 ? 210 : g === 1 ? 232 : 196;
          hg = g === 0 ? 92 : g === 1 ? 122 : 80;
          hb = g === 0 ? 38 : g === 1 ? 52 : 32;
        }

        if (t !== EMPTY && t !== WATER && nearWaterCell(x, y)) {
          hr = (hr * 0.72 + 28) | 0;
          hg = (hg * 0.78 + 36) | 0;
          hb = (hb * 0.82 + 48) | 0;
        }

        base = ((y * PX) * imgW + (x * PX)) << 2;
        for (sy = 0; sy < PX; sy++) {
          row = base + ((sy * imgW) << 2);
          for (sx = 0; sx < PX; sx++) {
            n = ((h >>> (sx + sy * 3)) & 7) - 3;
            facet = (sx + sy < 3) ? 10 : -8;
            o = row + (sx << 2);
            if (t === EMPTY) {
              tw = ((h + sx * 17 + sy * 31) & 255);
              if (!sealed[i] && y < H * 0.28 && tw < 3) {
                pix[o] = 210; pix[o + 1] = 190; pix[o + 2] = 150; pix[o + 3] = 255;
              } else {
                pix[o] = clamp8(hr + n); pix[o + 1] = clamp8(hg + n); pix[o + 2] = clamp8(hb + n + (sealed[i] ? 6 : 0)); pix[o + 3] = 255;
              }
            } else if (t === SOIL && emptyAbove && !waterAbove && sy <= 1) {
              pix[o] = clamp8((sy === 0 ? 92 : 78) + n * 3);
              pix[o + 1] = clamp8((sy === 0 ? 118 : 102) + n * 2);
              pix[o + 2] = clamp8((sy === 0 ? 38 : 28) + n);
              pix[o + 3] = 255;
            } else if (t === WATER && emptyAbove && sy === 0) {
              pix[o] = 196; pix[o + 1] = 236; pix[o + 2] = 250; pix[o + 3] = 255;
            } else if (t === WATER) {
              spark = ((h + frameTick * 13 + sx * 7 + sy * 11) >>> 0) % 47;
              if (spark === 0) { pix[o] = 210; pix[o + 1] = 236; pix[o + 2] = 245; pix[o + 3] = 255; }
              else {
                pix[o] = clamp8(hr + n + facet);
                pix[o + 1] = clamp8(hg + n + facet);
                pix[o + 2] = clamp8(hb + n + facet);
                pix[o + 3] = 255;
              }
            } else if (t === CRYSTAL) {
              tw = ((h + (frameTick >> 2) + sx + sy * 3) >>> 0) % 18;
              if (sx === 1 && sy === 1 || tw === 0) {
                pix[o] = 240; pix[o + 1] = 250; pix[o + 2] = 255; pix[o + 3] = 255;
              } else {
                pix[o] = clamp8(hr + facet * 2 + n);
                pix[o + 1] = clamp8(hg + facet * 2 + n);
                pix[o + 2] = clamp8(hb + facet + n);
                pix[o + 3] = 255;
              }
            } else if (t === MUSHROOM) {
              if (sy >= 2) {
                pix[o] = clamp8(210 + n); pix[o + 1] = clamp8(196 + n); pix[o + 2] = clamp8(150 + n); pix[o + 3] = 255;
              } else {
                pix[o] = clamp8(hr + n + facet);
                pix[o + 1] = clamp8(hg + n);
                pix[o + 2] = clamp8(hb + n);
                pix[o + 3] = 255;
              }
            } else if (t !== EMPTY && t !== WATER && nearWaterCell(x, y) && sy === 0 && sx < 2) {
              pix[o] = clamp8(hr + 48); pix[o + 1] = clamp8(hg + 52); pix[o + 2] = clamp8(hb + 58); pix[o + 3] = 255;
            } else {
              pix[o] = clamp8(hr + n * 4 + facet);
              pix[o + 1] = clamp8(hg + n * 3 + facet);
              pix[o + 2] = clamp8(hb + n * 2 + facet);
              pix[o + 3] = 255;
            }
          }
        }
      }
    }
  }

  function lightingPass() {
    var x, y, i, sx, sy, o, row, base, L, warm, cool, gr, gg, gb, r, g, b;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        L = light[i];
        if (grid[i] === EMPTY) { warm = L * 10; cool = (1 - L) * 14; }
        else { warm = L * 38; cool = (1 - L) * 26; }
        if (sealed[i]) cool += 18;
        gr = glowR[i] * 255;
        gg = glowG[i] * 255;
        gb = glowB[i] * 255;
        base = ((y * PX) * imgW + (x * PX)) << 2;
        for (sy = 0; sy < PX; sy++) {
          row = base + ((sy * imgW) << 2);
          for (sx = 0; sx < PX; sx++) {
            o = row + (sx << 2);
            r = pix[o];
            g = pix[o + 1];
            b = pix[o + 2];
            pix[o]     = clamp8(r * (0.48 + 0.52 * L) + gr + warm);
            pix[o + 1] = clamp8(g * (0.48 + 0.52 * L) + gg + warm * 0.45);
            pix[o + 2] = clamp8(b * (0.48 + 0.52 * L) + gb + cool);
          }
        }
      }
    }
  }

  function stampSun() {
    var cx = (W * 0.5) * PX;
    var cy = Math.max(PX * 1.2, H * 0.04 * PX);
    var rad = Math.max(26, W * PX * 0.2);
    var rad2 = rad * rad;
    var x0 = Math.max(0, (cx - rad) | 0), x1 = Math.min(imgW, (cx + rad + 1) | 0);
    var y0 = Math.max(0, (cy - rad) | 0), y1 = Math.min(imgH, (cy + rad + 1) | 0);
    var x, y, dx, dy, d2, f, o;
    for (y = y0; y < y1; y++) {
      dy = y - cy;
      for (x = x0; x < x1; x++) {
        dx = x - cx;
        d2 = dx * dx + dy * dy * 1.2;
        if (d2 > rad2) continue;
        f = 1 - d2 / rad2;
        f = f * f;
        o = (y * imgW + x) << 2;
        pix[o]     = clamp8(pix[o] + f * 155);
        pix[o + 1] = clamp8(pix[o + 1] + f * 78);
        pix[o + 2] = clamp8(pix[o + 2] + f * 16);
      }
    }
  }

  function overlaySparkles() {
    var x, y, i, t, h, sx, sy, o, base, row, tw;
    for (y = 0; y < H; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        t = grid[i];
        h = hash(x, y + (frameTick >> 2));
        if (t === EMPTY && !sealed[i] && y < H * 0.3 && (h % 97) === 0) {
          o = (((y * PX + 1) * imgW + (x * PX + 1)) << 2);
          pix[o] = 230; pix[o + 1] = 210; pix[o + 2] = 170;
        } else if (t === WATER) {
          if (((h + frameTick * 3) % 41) === 0) {
            sx = h % PX; sy = (h >> 3) % PX;
            o = (((y * PX + sy) * imgW + (x * PX + sx)) << 2);
            pix[o] = 220; pix[o + 1] = 240; pix[o + 2] = 250;
          }
        } else if (t === CRYSTAL) {
          tw = (h + frameTick) % 16;
          if (tw < 2) {
            o = (((y * PX + 1) * imgW + (x * PX + 1)) << 2);
            pix[o] = 255; pix[o + 1] = 255; pix[o + 2] = 255;
          }
        } else if (t === STONE && y >= H - 3 && (h % 53) === 0) {
          o = (((y * PX + (h % 4)) * imgW + (x * PX + ((h >> 2) % 4))) << 2);
          pix[o] = clamp8(pix[o] + 40);
          pix[o + 1] = clamp8(pix[o + 1] + 28);
          pix[o + 2] = clamp8(pix[o + 2] + 16);
        }
      }
    }
  }

  function plotWorldPixel(fx, fy, r, g, b, a) {
    var x = (fx * PX) | 0, y = (fy * PX) | 0;
    if (x < 0 || y < 0 || x >= imgW || y >= imgH) return;
    var o = (y * imgW + x) << 2;
    var k = a, ik = 1 - k;
    pix[o]     = clamp8(pix[o] * ik + r * k);
    pix[o + 1] = clamp8(pix[o + 1] * ik + g * k);
    pix[o + 2] = clamp8(pix[o + 2] * ik + b * k);
  }

  function stepParticles() {
    var i, a;
    for (i = 0; i < PMAX; i++) {
      if (plife[i] <= 0) continue;
      plife[i]--;
      px[i] += pvx[i];
      pvy[i] += 0.018;
      py[i] += pvy[i];
      pvx[i] *= 0.96;
      a = plife[i] / pmax[i];
      plotWorldPixel(px[i], py[i], pr[i], pg[i], pb[i], a);
      plotWorldPixel(px[i] + 0.35, py[i], pr[i], pg[i], pb[i], a);
      plotWorldPixel(px[i], py[i] + 0.35, pr[i], pg[i], pb[i], a * 0.85);
      plotWorldPixel(px[i] + 0.35, py[i] + 0.35, pr[i], pg[i], pb[i], a * 0.7);
      plotWorldPixel(px[i] + 0.7, py[i] + 0.15, pr[i], pg[i], pb[i], a * 0.4);
    }
    for (i = 0; i < motes.length; i++) {
      a = motes[i];
      a.x += a.vx;
      a.y += a.vy;
      a.ph += 0.03;
      if (a.x < 0) a.x = W;
      if (a.x > W) a.x = 0;
      if (a.y < 0) a.y = H * 0.5;
      if (a.y > H * 0.62) a.y = 0;
      if (W > 0) {
        var gi = ((a.y) | 0) * W + ((a.x) | 0);
        if (gi >= 0 && gi < N && grid[gi] === EMPTY && !sealed[gi]) {
          plotWorldPixel(a.x, a.y, 220, 190, 140, 0.18 + 0.16 * Math.sin(a.ph));
        }
      }
    }
  }

  function render() {
    if (N === 0) return;
    computeLight();
    writeAlbedo();
    lightingPass();
    stampSun();
    overlaySparkles();
    stepParticles();
    offCtx.putImageData(img, 0, 0);

    var ox = 0, oy = 0;
    if (shake > 0.04) {
      ox = ((hash(frameTick, 3) % 5) - 2) * (shake / 2);
      oy = ((hash(frameTick, 7) % 5) - 2) * (shake / 2);
      if (ox > 2) ox = 2; if (ox < -2) ox = -2;
      if (oy > 2) oy = 2; if (oy < -2) oy = -2;
      shake *= shake > 1.2 ? 0.88 : 0.76;
    } else shake = 0;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0a080c";
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.drawImage(off, ox, oy, cssW, cssH);

    if (playing && hoverOn && W > 0) {
      var cellPx = cssW / W;
      var br = brushRadius();
      ctx.save();
      ctx.beginPath();
      ctx.arc(hoverX * cellPx, hoverY * cellPx, br * cellPx, 0, Math.PI * 2);
      ctx.strokeStyle = tool === "dig" ? "rgba(240,200,140,0.85)" : "rgba(255,236,200,0.7)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,220,160,0.08)";
      ctx.fill();
      ctx.restore();
    }

    var line = "rooms " + rooms + "\nalive " + alive;
    if (line !== lastHud) {
      lastHud = line;
      statsEl.textContent = line;
    }
  }
