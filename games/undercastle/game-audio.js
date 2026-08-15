
  function sfxFanfare() {
    if (!audio || muted) return;
    var t = nowMs();
    tone(t, 784, "sine", 0.07, 0.18);
    tone(t + 0.08, 988, "sine", 0.07, 0.2);
    tone(t + 0.16, 1176, "sine", 0.08, 0.32);
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      unlockAudio();
      var next = btn.getAttribute("data-tool");
      if (next === "clear") {
        generate();
        hallTime = 0;
        selectTool("soil");
        sfxClear();
        dirty = true;
        writeSave();
        updateGoal();
        return;
      }
      selectTool(next);
    });
  });

  muteBtn.addEventListener("click", function () { setMute(!muted); });
  mute2.addEventListener("click", function () { unlockAudio(); setMute(!muted); });
  document.getElementById("btn-sandbox").addEventListener("click", function () { startMode("sandbox"); });
  document.getElementById("btn-charter").addEventListener("click", function () { startMode("charter"); });
  document.getElementById("btn-how").addEventListener("click", function () { unlockAudio(); setScreen("how"); });
  document.getElementById("btn-gotit").addEventListener("click", function () { setScreen("title"); });
  menuBtn.addEventListener("click", function () {
    writeSave();
    setScreen("title");
  });

  function makeNoise(ctx, dur) {
    var n = (ctx.sampleRate * dur) | 0;
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0), i, acc = 0;
    for (i = 0; i < n; i++) {
      acc = acc * 0.97 + (Math.random() * 2 - 1) * 0.03;
      d[i] = acc * 6 + (Math.random() * 2 - 1) * 0.25;
    }
    return buf;
  }

  function unlockAudio() {
    if (audio) {
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      return;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var actx = new AC();
    var master = actx.createGain();
    master.gain.value = muted ? 0 : 0.34;
    master.connect(actx.destination);

    var noiseBuf = makeNoise(actx, 1.4);
    var bedSrc = actx.createBufferSource();
    bedSrc.buffer = noiseBuf;
    bedSrc.loop = true;
    var bedF = actx.createBiquadFilter();
    bedF.type = "lowpass";
    bedF.frequency.value = 190;
    bedF.Q.value = 0.7;
    var bedG = actx.createGain();
    bedG.gain.value = 0.045;
    bedSrc.connect(bedF);
    bedF.connect(bedG);
    bedG.connect(master);
    bedSrc.start();

    var hum = actx.createOscillator();
    hum.type = "sine";
    hum.frequency.value = 52;
    var humG = actx.createGain();
    humG.gain.value = 0.012;
    hum.connect(humG);
    humG.connect(master);
    hum.start();

    var lfo = actx.createOscillator();
    lfo.frequency.value = 0.07;
    var lfoG = actx.createGain();
    lfoG.gain.value = 40;
    lfo.connect(lfoG);
    lfoG.connect(bedF.frequency);
    lfo.start();

    audio = { ctx: actx, master: master, noise: noiseBuf, last: { dig: 0, soil: 0, stone: 0, water: 0, rumble: 0, chime: 0 } };
  }

  function nowMs() { return audio ? audio.ctx.currentTime : 0; }

  function sfxPaint(kind, n) {
    if (!audio || muted) return;
    var t = nowMs();
    var key = kind === "dig" ? "dig" : kind === "stone" ? "stone" : kind === "water" ? "water" : "soil";
    if (t - audio.last[key] < 0.07) return;
    audio.last[key] = t;
    var ctx = audio.ctx;
    if (kind === "dig") {
      burstNoise(t, 0.07, 900, 1.2, 0.16);
    } else if (kind === "stone") {
      tone(t, 88, "triangle", 0.14, 0.12);
      burstNoise(t, 0.04, 400, 0.7, 0.08);
    } else if (kind === "water") {
      burstNoise(t, 0.12, 720, 0.5, 0.1);
    } else {
      burstNoise(t, 0.055, 420, 0.8, 0.1);
      tone(t, 70, "sine", 0.05, 0.08);
    }
  }

  function sfxRumble(n) {
    if (!audio || muted) return;
    var t = nowMs();
    if (t - audio.last.rumble < (n >= 12 ? 0.42 : 0.62)) return;
    audio.last.rumble = t;
    var dur = 0.38 + Math.min(0.5, n * 0.022);
    var gain = 0.14 + Math.min(0.16, n * 0.008);
    tone(t, 40, "sine", gain, dur);
    tone(t, 61, "triangle", 0.06 + Math.min(0.06, n * 0.004), dur * 0.75);
    burstNoise(t, Math.min(0.7, 0.28 + n * 0.018), 130, 0.55, 0.1 + Math.min(0.1, n * 0.006));
  }

  function sfxChime() {
    if (!audio || muted) return;
    var t = nowMs();
    if (t - audio.last.chime < 0.18) return;
    audio.last.chime = t;
    tone(t, 1046, "sine", 0.07, 0.28);
    tone(t + 0.03, 1568, "sine", 0.045, 0.22);
  }

  function sfxClear() {
    if (!audio || muted) return;
    burstNoise(nowMs(), 0.16, 260, 0.5, 0.08);
  }

  function tone(t, freq, type, gain, dur) {
    if (!audio) return;
    var ctx = audio.ctx;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(audio.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function burstNoise(t, dur, freq, q, gain) {
    if (!audio) return;
    var ctx = audio.ctx;
    var src = ctx.createBufferSource();
    src.buffer = audio.noise;
    var f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(audio.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  window.addEventListener("resize", fit);
  if (window.ResizeObserver) new ResizeObserver(fit).observe(canvas);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) writeSave();
    if (!audio) return;
    if (document.hidden) audio.ctx.suspend();
    else if (!muted) audio.ctx.resume();
  });

  function frame(now) {
    if (N === 0) fit();
    var dt = lastFrameT ? Math.min(0.05, (now - lastFrameT) / 1000) : 0.016;
    lastFrameT = now || 0;
    if (N > 0) {
      step();
      step();
      if (playing) {
        stepCharter(dt);
        if (dirty && now - lastSaveAt > 3000) writeSave();
      }
      if (goldFlash > 0) {
        goldFlash -= dt;
        if (goldFlash <= 0) {
          goldFlash = 0;
          statsEl.classList.remove("gold");
          goalEl.classList.remove("gold");
        }
      }
      if (toastT > 0) {
        toastT -= dt;
        if (toastT <= 0) toastEl.classList.remove("show");
      }
      render();
      frameTick++;
    }
    requestAnimationFrame(frame);
  }

  if (!fit()) {
    requestAnimationFrame(function retry() {
      if (!fit()) requestAnimationFrame(retry);
    });
  }
  requestAnimationFrame(frame);