
  function canPaint(x, y) {
    return x >= 0 && y >= 0 && x < W && y < H;
  }

  function paintBrush(cx, cy) {
    var r = tool === "water" ? 1.15 : tool === "stone" ? 1.9 : 2.7;
    var r2 = r * r;
    var x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r);
    var y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
    var x, y, i, t, ddx, ddy, d2, fall, changed = 0, crumbs = 0;
    for (y = y0; y <= y1; y++) {
      for (x = x0; x <= x1; x++) {
        if (!canPaint(x, y)) continue;
        ddx = x + 0.5 - cx;
        ddy = y + 0.5 - cy;
        d2 = ddx * ddx + ddy * ddy;
        if (d2 > r2 + 0.2) continue;
        fall = 1 - Math.sqrt(d2) / (r + 0.15);
        if (fall < 0.16) continue;
        if (tool === "dig") {
          if (fall < 0.74 && (hash(x, y) & 255) > fall * 290) continue;
        } else if (tool === "soil") {
          if (fall < 0.52 && (hash(x, y) & 255) > fall * 340) continue;
        } else if (tool === "stone") {
          if (fall < 0.28) continue;
        } else if (fall < 0.22) continue;
        if (y >= H - 3 && tool !== "water") continue;
        i = y * W + x;
        t = grid[i];
        if (tool === "dig") {
          if (t === EMPTY) continue;
          if (t === SOIL && fall < 0.48 && (hash(x, y + 11) & 3) === 0) {
            grid[i] = SAND;
            crumbs++;
          } else {
            grid[i] = EMPTY;
          }
          packed[i] = 0;
          changed++;
        } else if (tool === "soil") {
          if (t === EMPTY || t === SAND || t === WATER) {
            grid[i] = SOIL;
            packed[i] = 84;
            changed++;
          }
        } else if (tool === "stone") {
          if (t !== STONE) {
            grid[i] = STONE;
            packed[i] = 0;
            changed++;
          }
        } else if (tool === "water") {
          if (t === EMPTY) { grid[i] = WATER; changed++; }
        }
      }
    }
    if (changed) {
      sfxPaint(tool, changed);
      dirty = true;
      if (tool === "dig") spawnDust(cx, cy, crumbs ? 3 : 2, 168, 136, 86);
    }
    return changed;
  }

  function paintLine(x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(1, Math.ceil(dist * 3));
    var i, u;
    for (i = 0; i <= steps; i++) {
      u = i / steps;
      paintBrush(x0 + dx * u, y0 + dy * u);
    }
  }

  function eventCell(e) {
    var r = canvas.getBoundingClientRect();
    var x = ((e.clientX - r.left) / r.width) * W;
    var y = ((e.clientY - r.top) / r.height) * H;
    return [x, y];
  }

  function onDown(e) {
    if (!playing) return;
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    unlockAudio();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    painting = true;
    var c = eventCell(e);
    lastX = c[0];
    lastY = c[1];
    paintBrush(c[0], c[1]);
  }

  function onMove(e) {
    if (!painting) return;
    e.preventDefault();
    var c = eventCell(e);
    paintLine(lastX, lastY, c[0], c[1]);
    lastX = c[0];
    lastY = c[1];
  }

  function onUp() {
    painting = false;
    lastX = lastY = -1;
  }

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  function selectTool(next) {
    tool = next;
    buttons.forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-tool") === next);
    });
  }

  function gridToB64(g) {
    var i, n = g.length, bin = "";
    for (i = 0; i < n; i++) bin += String.fromCharCode(g[i]);
    return btoa(bin);
  }

  function b64ToGrid(str, dest) {
    var bin = atob(str), n = Math.min(bin.length, dest.length), i;
    for (i = 0; i < n; i++) dest[i] = bin.charCodeAt(i) & 7;
  }

  function readSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeSave() {
    if (!grid || N === 0) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1, W: W, H: H,
        grid: gridToB64(grid),
        mode: mode,
        muted: muted,
        tool: tool,
        charterStep: charterStep,
        charterDone: charterDone,
        hallTime: hallTime
      }));
      lastSaveAt = performance.now();
      dirty = false;
    } catch (e) {}
  }

  function bootSave() {
    var data = readSave();
    pendingSave = data;
    if (!data) {
      refreshStamp();
      syncMuteUI();
      refreshPlayLabels();
      return;
    }
    muted = !!data.muted;
    charterDone = !!data.charterDone;
    charterStep = data.charterStep | 0;
    if (charterStep > 3) charterStep = 3;
    mode = data.mode === "charter" ? "charter" : "sandbox";
    hallTime = +data.hallTime || 0;
    if (data.tool) tool = data.tool;
    if (data.grid && data.W && data.H) {
      var tmp = new Uint8Array(data.W * data.H);
      try { b64ToGrid(data.grid, tmp); blitGrid(tmp, data.W, data.H); } catch (e) {}
    }
    selectTool(tool === "clear" ? "soil" : tool);
    refreshStamp();
    syncMuteUI();
    refreshPlayLabels();
    updateGoal();
  }

  function refreshStamp() {
    stampEl.classList.toggle("on", charterDone);
  }

  function syncMuteUI() {
    muteBtn.classList.toggle("off", muted);
    muteBtn.setAttribute("aria-label", muted ? "Unmute" : "Mute");
    mute2.textContent = muted ? "Unmute" : "Mute";
    if (audio) audio.master.gain.setTargetAtTime(muted ? 0 : 0.34, audio.ctx.currentTime, 0.03);
  }

  function setMute(on) {
    muted = !!on;
    syncMuteUI();
    dirty = true;
    writeSave();
    if (!audio) unlockAudio();
    else if (audio.ctx.state === "suspended") audio.ctx.resume();
  }

  function refreshPlayLabels() {
    var data = readSave();
    var has = !!(data && data.grid);
    document.getElementById("btn-sandbox").textContent = (has && data.mode !== "charter") ? "Resume" : "Sandbox";
    document.getElementById("btn-charter").textContent = (has && data.mode === "charter") ? "Resume" : "Charter";
  }

  function setScreen(next) {
    screen = next;
    playing = next === "play";
    appEl.className = next;
    if (!playing) painting = false;
    if (next === "play") updateGoal();
    if (next === "title") refreshPlayLabels();
  }

  function startMode(nextMode) {
    unlockAudio();
    mode = nextMode;
    setScreen("play");
    dirty = true;
    writeSave();
    updateGoal();
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    toastT = 2.2;
  }

  function flashGold() {
    goldFlash = 1.1;
    statsEl.classList.add("gold");
    goalEl.classList.add("gold");
  }

  function hallStanding() {
    if (N === 0) return false;
    var x, y, i, roofed = 0, collapsing = 0, volume = 0, t;
    for (y = 0; y < H - 1; y++) {
      for (x = 0; x < W; x++) {
        i = y * W + x;
        t = grid[i];
        if ((t === SOIL || t === STONE) && grid[i + W] === EMPTY) {
          roofed++;
          if (t === SOIL && spans[i] >= 6 && !nearStone(x, y)) collapsing++;
        }
        if (t === EMPTY && y > 0 && y < H - 3 && SOLID[grid[i - W]]) volume++;
      }
    }
    return volume >= 12 && roofed >= 6 && collapsing === 0;
  }

  function updateGoal() {
    if (mode !== "charter") {
      goalEl.textContent = "";
      return;
    }
    if (charterStep <= 0) goalEl.textContent = "I  Hall  " + hallTime.toFixed(1) + "s";
    else if (charterStep === 1) goalEl.textContent = "II  Seal a dry room";
    else if (charterStep === 2) goalEl.textContent = "III  Wet cellar";
    else goalEl.textContent = "Master builder";
  }

  function completeGoal(msg) {
    charterStep++;
    if (charterStep >= 3) {
      charterStep = 3;
      charterDone = true;
      refreshStamp();
      msg = "Master builder";
    }
    flashGold();
    sfxFanfare();
    showToast(msg);
    dirty = true;
    writeSave();
    updateGoal();
  }

  function stepCharter(dt) {
    if (mode !== "charter" || !playing) return;
    if (charterStep === 0) {
      if (hallStanding()) {
        hallTime += dt;
        if (hallTime >= 10) {
          hallTime = 10;
          completeGoal("The hall stands");
        }
      } else {
        hallTime = Math.max(0, hallTime - dt * 1.6);
      }
      if ((frameTick & 7) === 0) updateGoal();
    } else if (charterStep === 1) {
      var i, hasC = false;
      for (i = 0; i < N; i++) if (grid[i] === CRYSTAL) { hasC = true; break; }
      if (hasC) completeGoal("A crystal is born");
    } else if (charterStep === 2) {
      var j, hasM = false;
      for (j = 0; j < N; j++) if (grid[j] === MUSHROOM) { hasM = true; break; }
      if (hasM) completeGoal("The cellar lives");
    }
  }
