"""Web Swing browser quality checks.
Run: pip install playwright==1.55.0; playwright install chromium webkit
     python tests/web_swing_browser.py
The optional CAPTURE_MOTION=1 exports four simulation seconds at 24 frames/second.
This is an offline visual capture, not a physical-device performance benchmark.
"""
from pathlib import Path
import functools
import hashlib
import http.server
import json
import os
import shutil
import threading
import traceback
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
GAME = ROOT / 'games/web-swing/index.html'
shutil.copy(GAME, OUT / 'index.html')
blob = GAME.read_bytes()
blob_sha = hashlib.sha1(b'blob ' + str(len(blob)).encode() + b'\0' + blob).hexdigest()
SUITE = (ROOT / 'tests/web_swing_flow_checks.js').read_text()
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_port}/games/web-swing/?test'
results = []

def check(browser, name, passed, detail=None):
    results.append({'browser': browser, 'name': name, 'pass': bool(passed), 'detail': detail})

def render(page, script=''):
    page.evaluate('window.__webswing.start();window.__webswing.manual(true);' + script + ';window.__webswing.render()')

def rotate(page, width, height):
    page.set_viewport_size({'width': width, 'height': height})
    page.wait_for_function(f'innerWidth === {width} && innerHeight === {height}')
    page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    page.wait_for_function('Math.abs(document.getElementById("world").width/document.getElementById("world").height-innerWidth/innerHeight)<.01')

with sync_playwright() as playwright:
    for name in ('chromium', 'webkit'):
        browser = None
        page = None
        errors = []
        try:
            options = {'headless': True}
            if name == 'chromium':
                options['args'] = ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
                if os.environ.get('CHROMIUM_EXECUTABLE'):
                    options['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
            browser = getattr(playwright, name).launch(**options)
            page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(URL, wait_until='load')
            page.wait_for_function('Boolean(window.__webswing)', timeout=30000)
            page.evaluate('window.__webswing.manual(true)')
            page.screenshot(path=str(OUT / f'{name}-title.png'))
            page.locator('#start').tap()
            check(name, 'actual touch starts the game', page.evaluate('window.__webswing.state') == 'playing')
            for item in page.evaluate(SUITE):
                results.append({'browser': name, **item})
            page.screenshot(path=str(OUT / f'{name}-swing-portrait.png'))
            render(page, 'window.__webswing.input.x=.75;window.__webswing.input.y=-.60;window.__webswing.refreshTarget();window.__webswing.step(24)')
            page.screenshot(path=str(OUT / f'{name}-aim-portrait.png'))
            render(page, 'window.__webswing.input.web=true;window.__webswing.attach();window.__webswing.input.y=-1;window.__webswing.step(88)')
            page.screenshot(path=str(OUT / f'{name}-power-portrait.png'))
            render(page, 'window.__webswing.P.v=[0,-16,42];window.__webswing.step(18)')
            page.screenshot(path=str(OUT / f'{name}-freefall-portrait.png'))
            render(page, 'window.__webswing.trick();window.__webswing.step(24)')
            page.screenshot(path=str(OUT / f'{name}-trick-portrait.png'))
            touch = page.evaluate(r'''()=>{
              const g=window.__webswing;g.start();const pad=document.getElementById('pad'),web=document.getElementById('web'),r=pad.getBoundingClientRect();
              pad.dispatchEvent(new PointerEvent('pointerdown',{pointerId:11,pointerType:'touch',bubbles:true,clientX:r.left+r.width*.75,clientY:r.top+r.height*.18}));
              web.dispatchEvent(new PointerEvent('pointerdown',{pointerId:12,pointerType:'touch',bubbles:true}));
              const held=g.input.x>.2&&g.input.web&&!!g.P.rope,power=g.powerValue()>.4;
              pad.dispatchEvent(new PointerEvent('pointerup',{pointerId:11,pointerType:'touch',bubbles:true}));
              const independent=g.input.x===0&&g.input.web&&!!g.P.rope;
              web.dispatchEvent(new PointerEvent('pointercancel',{pointerId:12,pointerType:'touch',bubbles:true}));
              return{held,power,independent,clean:!g.input.web&&!g.P.rope,state:g.state};
            }''')
            check(name, 'simultaneous aiming, up-power, hold and independent touch cancellation', all(touch[k] for k in ('held', 'power', 'independent', 'clean')) and touch['state'] == 'playing', touch)
            page.locator('#pause').tap()
            before = page.evaluate('window.__webswing.settings.swingMode')
            page.locator('#swingMode').tap()
            after = page.evaluate('window.__webswing.settings.swingMode')
            check(name, 'actual touch toggles Flow and Manual in pause', before != after)
            page.locator('#resume').tap()
            rotate(page, 844, 390)
            render(page, 'window.__webswing.setSwingMode("FLOW");window.__webswing.input.web=true;window.__webswing.attach();window.__webswing.step(105)')
            page.screenshot(path=str(OUT / f'{name}-swing-landscape.png'))
            ratio = page.evaluate('({canvas:document.getElementById("world").width/document.getElementById("world").height,viewport:innerWidth/innerHeight})')
            check(name, 'rotation preserves drawing-buffer aspect', abs(ratio['canvas'] - ratio['viewport']) < .01, ratio)
            render(page, 'window.__webswing.setPosition([0,12,74],[0,0,18]);window.__webswing.step(4)')
            page.screenshot(path=str(OUT / f'{name}-street-day.png'))
            page.evaluate('window.__webswing.setDay(40)')
            page.screenshot(path=str(OUT / f'{name}-street-night.png'))
            if name == 'chromium' and os.environ.get('CAPTURE_MOTION') == '1':
                frame_dir = OUT / 'motion'
                frame_dir.mkdir(exist_ok=True)
                render(page, 'window.__webswing.setSwingMode("FLOW");window.__webswing.input.web=true;window.__webswing.attach()')
                for frame in range(96):
                    page.evaluate('frame=>{const g=window.__webswing;g.input.y=frame>=24&&frame<48?-.65:0;g.step(5);g.render(1/24,1)}', frame)
                    page.screenshot(path=str(frame_dir / f'{frame:04d}.png'))
                check(name, 'rendered four-second powered Flow sequence remains playable', page.evaluate('window.__webswing.state') == 'playing')
            for width, height in ((844, 390), (320, 568)):
                small = browser.new_page(viewport={'width': width, 'height': height}, device_scale_factor=1, is_mobile=True, has_touch=True)
                small.goto(URL, wait_until='load')
                small.wait_for_function('Boolean(window.__webswing)')
                small.evaluate('window.__webswing.manual(true)')
                small.screenshot(path=str(OUT / f'{name}-welcome-{width}.png'))
                small.locator('#start').tap()
                check(name, f'actual touch starts from {width}x{height} welcome layout', small.evaluate('window.__webswing.state') == 'playing')
                small.close()
            check(name, 'no uncaught JavaScript or WebGL errors', not errors and page.evaluate('window.__webswing.stats.glError') == 0, errors)
        except Exception as error:
            results.append({'browser': name, 'name': 'browser execution', 'pass': False, 'error': str(error), 'trace': traceback.format_exc()})
            if page:
                try:
                    page.screenshot(path=str(OUT / f'{name}-failure.png'))
                except Exception:
                    pass
        finally:
            if browser:
                browser.close()
server.shutdown()
(OUT / 'results.json').write_text(json.dumps(results, indent=2))
(OUT / 'metadata.json').write_text(json.dumps({'game_blob': blob_sha, 'capture': 'Offline simulation at 24 fps, not a device performance measurement', 'suite': 'Chromium and WebKit software rendering'}, indent=2))
print(json.dumps(results, indent=2))
failed = [result for result in results if not result['pass']]
print(f'RESULT: {len(results)-len(failed)}/{len(results)} passed; game blob {blob_sha}')
raise SystemExit(bool(failed))
