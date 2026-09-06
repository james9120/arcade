"""Reproducible rendered traversal review; run after web_swing_browser.py.

Uses the same pinned Playwright installation. Captures are offline 12 fps, NOT a
performance result. A separate six-second live RAF measurement is reported.
Serve the repo on 127.0.0.1:8000 first. Optional FFMPEG_EXECUTABLE encodes WebM.
"""
from pathlib import Path
import json
import os
import subprocess
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 'movement'
OUT.mkdir(parents=True, exist_ok=True)
SCENARIOS = tuple(os.environ.get('MOTION_SCENARIOS', 'practice,normal,chain,power,turn,wall,tap,low,imperfect').split(','))
if os.environ.get('PERFORMANCE_ONLY') == '1':
    SCENARIOS = ()
SETUP = """kind=>{const g=__webswing;g.start();g.manual(true);g.settings.sound=false;g.setSwingMode('FLOW');
if(kind==='practice'){g.setSwingMode('NORMAL');g.jumpDown();}
else if(kind==='normal'){g.setSwingMode('NORMAL');g.webPress();g.jumpDown();}
else if(kind==='wall'){g.setSwingMode('NORMAL');const b=g.buildings.find(b=>!b.base&&b.x>20&&b.x<100&&b.z>25&&b.z<70);g.setPosition([b.x-b.w/2-.7,25,b.z-b.d/2+2],[.8,0,26]);g.jumpDown();}
else if(kind==='turn'){g.setPosition([0,90,106],[0,8,30]);}
else {if(kind==='low')g.setPosition([0,22,48],[0,-14,38]);g.input.web=true;g.attach();}g.render();}"""
FRAME = """({kind,i})=>{const g=__webswing,t=i/12;
g.input.y=(kind==='normal'||kind==='practice')&&t<1||kind==='power'&&t<1.25?-1:kind==='low'&&t<1.5?-.7:0;
g.input.x=kind==='turn'&&i<10||kind==='imperfect'&&t<2.7?1:kind==='wall'&&i>=5&&i<7?1:0;
if(kind==='turn'&&i===10){g.input.web=true;g.attach();}
if(kind==='normal'){if(i===12)g.jumpUp();if(i===32||i===70){g.webPress();g.jumpDown();}if(i===45||i===83)g.jumpUp();}
if(kind==='practice'){if(i===12||i===35||i===65)g.jumpUp();if(i===20||i===48)g.webPress();if(i===24||i===55)g.jumpDown();}
if(kind==='power'&&i===14){g.input.web=false;g.release(false,true);}if(kind==='power'&&i===27)g.input.web=true;
if(kind==='wall'){if(i===5)g.jumpUp();if(i===8||i===43||i===78){g.webPress();g.jumpDown();}if(i===22||i===57||i===92)g.jumpUp();}
if(kind==='tap'&&i===5){g.fireTap(g.refreshTarget(),150,250);}if(kind==='imperfect'&&i===40)g.fireTap(null,100,100);
g.step(10);g.render(1/12,1);
return{t:g.stats.elapsed,state:g.state,p:g.P.p,v:g.P.v,input:{x:g.input.x,y:g.input.y,jump:g.jumpControl.held,charge:g.jumpControl.charge},rope:g.P.rope&&{age:g.P.rope.age,charge:g.P.rope.charge,length:g.P.rope.length},swings:g.stats.swingCount,grounded:!!g.P.grounded,wall:!!g.P.wall,wallRuns:g.wallControl.runs,glError:g.stats.glError};}"""

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    page.goto('http://127.0.0.1:8000/games/web-swing/?test')
    results = {}
    for kind in SCENARIOS:
        folder = OUT / kind
        folder.mkdir(exist_ok=True)
        page.goto('http://127.0.0.1:8000/games/web-swing/?test' + ('&practice' if kind == 'practice' else ''))
        page.evaluate(SETUP, kind)
        states = []
        for i in range(48 if kind == 'turn' else 192 if kind == 'practice' else 96):
            state = page.evaluate(FRAME, {'kind': kind, 'i': i})
            states.append(state)
            page.screenshot(path=str(folder / f'{i:03}.jpg'), type='jpeg', quality=85)
            if state['state'] != 'playing':
                break
        results[kind] = states
        ffmpeg = os.environ.get('FFMPEG_EXECUTABLE')
        if ffmpeg:
            frames = b''.join(path.read_bytes() for path in sorted(folder.glob('*.jpg'))[:len(states)])
            subprocess.run([ffmpeg, '-y', '-f', 'image2pipe', '-r', '12', '-c:v', 'mjpeg', '-i', 'pipe:0', '-pix_fmt', 'yuv420p', '-c:v', 'libvpx', '-b:v', '1600k', str(OUT / f'{kind}.webm')], input=frames, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        print(kind, states[-1], flush=True)
    previous = json.loads((OUT / 'trajectories.json').read_text()) if (OUT / 'trajectories.json').exists() else {}
    previous.update(results)
    (OUT / 'trajectories.json').write_text(json.dumps(previous, indent=2))
    # Live rendering, with real elapsed wall time and no manual stepping or captures.
    page.evaluate("__webswing.start();__webswing.input.web=true;__webswing.attach();__webswing.manual(false)")
    performance = page.evaluate("""()=>new Promise(resolve=>{const samples=[],g=__webswing,start=performance.now(),sim=g.stats.elapsed;let previous=start;function sample(t){samples.push(t-previous);previous=t;if(t-start<6000){requestAnimationFrame(sample);return;}samples.shift();samples.sort((a,b)=>a-b);const c=document.querySelector('#world'),gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');resolve({browser:navigator.userAgent,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],samples:samples.length,medianMs:samples[Math.floor(samples.length*.5)],p95Ms:samples[Math.floor(samples.length*.95)],wallSeconds:(t-start)/1000,simulationSeconds:g.stats.elapsed-sim,state:g.state});}requestAnimationFrame(sample);})""")
    (OUT / 'performance.json').write_text(json.dumps(performance, indent=2))
    print('LIVE PERFORMANCE', performance)
    browser.close()
