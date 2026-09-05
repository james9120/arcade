"""Browser regressions for the dependency-free Web / Swing game.
Run: pip install playwright==1.55.0; playwright install chromium webkit
     python tests/web_swing_browser.py
Artifacts, including the exact tested HTML, are written to test-results/.
"""
from pathlib import Path
import functools
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
shutil.copy(ROOT / 'games/web-swing/index.html', OUT / 'index.html')
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT)))
threading.Thread(target=server.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{server.server_port}/games/web-swing/?test'
results = []

SUITE = r'''() => {
 const g=window.__webswing, results=[];
 const check=(name,fn)=>{try{const detail=fn();results.push({name,pass:true,detail})}catch(e){results.push({name,pass:false,error:String(e)})}};
 const assert=(v,m)=>{if(!v)throw Error(m)};
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 const fresh=()=>{g.start();g.manual(true)};
 check('attachment and release preserve position and velocity',()=>{fresh();const p=[...g.P.p],v=[...g.P.v];assert(g.attach(),'no starting anchor');assert(distance(p,g.P.p)<1e-10,'attachment moved player');assert(distance(v,g.P.v)<1e-10,'attachment boosted player');g.release();assert(distance(v,g.P.v)<1e-10,'release boosted player');return {p,v}});
 check('freefall is ballistic without hidden forward thrust',()=>{fresh();g.setPosition([0,120,48],[0,0,0]);g.clearWorld();g.step(120);assert(g.P.v[1]<-9.7&&g.P.v[1]>-9.9,'incorrect gravity');assert(Math.abs(g.P.v[2])<1e-10,'hidden forward force');assert(g.P.p[1]>115&&g.P.p[1]<115.2,'incorrect ballistic position');return {p:g.P.p,v:g.P.v}});
 check('slack rope cannot push or pull prematurely',()=>{fresh();g.P.rope={a:[0,70,48],length:50,age:0,tension:0,side:1,rate:0,zip:0};const p=[...g.P.p],v=[...g.P.v];g.solveRope(1/120);assert(distance(p,g.P.p)<1e-10&&distance(v,g.P.v)<1e-10,'slack rope applied force')});
 check('unpowered rope remains bounded without adding energy',()=>{fresh();g.setPosition([0,110,0],[23,0,0]);g.P.rope={a:[0,150,0],length:40,age:0,tension:0,side:1,rate:0,zip:0};g.clearWorld();const e0=.5*distance(g.P.v,[0,0,0])**2+9.81*g.P.p[1];let maxStretch=0,maxEnergy=e0;for(let i=0;i<1200;i++){g.step();assert(g.P.rope,'rope unexpectedly detached');maxStretch=Math.max(maxStretch,distance(g.P.p,g.P.rope.a)-g.P.rope.length);maxEnergy=Math.max(maxEnergy,.5*distance(g.P.v,[0,0,0])**2+9.81*g.P.p[1]);}assert(maxStretch<.001,'rope stretched');assert(maxEnergy<=e0+1,'energy added without input');return {maxStretch,e0,maxEnergy}});
 check('reeling starts with bounded acceleration rather than a snap',()=>{fresh();g.attach();g.input.y=-1;const p=[...g.P.p],l=g.P.rope.length;g.solveRope(1/120);assert(distance(p,g.P.p)<.01,'first reel step snapped');assert(l-g.P.rope.length<.01,'first reel step shortened too far')});
 check('fixed timestep matches 30, 60 and 120 frame updates',()=>{let states=[];for(const fps of [30,60,120]){fresh();g.setPosition([0,120,48],[0,0,25]);g.clearWorld();for(let i=0;i<fps*2;i++)g.tick(1/fps);states.push({fps,p:[...g.P.p],v:[...g.P.v],elapsed:g.stats.elapsed})}assert(distance(states[0].p,states[2].p)<.002,'30/120 differ');assert(distance(states[1].p,states[2].p)<.002,'60/120 differ');return states});
 check('opposing traffic signals never receive simultaneous green',()=>{fresh();for(let t=0;t<56;t+=.1){g.setTime(t);assert(!(g.signal(0,0,0)&&g.signal(0,0,2)),'conflicting green at '+t)}});
 check('day-night timer wraps at precisely 600 simulation seconds',()=>{fresh();g.setDay(599.75);g.setPosition([0,120,48],[0,0,0]);g.clearWorld();g.step(60);assert(Math.abs(g.stats.dayTime-.25)<.00001,'incorrect day wrap');return g.stats.dayTime});
 check('ground contact ends the run',()=>{fresh();g.setPosition([0,1.02,48],[0,-5,10]);g.clearWorld();g.step(20);assert(g.state==='dead','ground hit did not end game');assert(!document.getElementById('over').hidden,'results panel missing')});
 check('pause freezes simulation and preserves rope on resume',()=>{fresh();g.attach();g.pause();const p=[...g.P.p];g.step(60);assert(distance(p,g.P.p)<1e-10,'movement while paused');g.resume();assert(g.P.rope,'resume silently released rope')});
 check('floating origin preserves nearby building geometry',()=>{fresh();g.setPosition([3500,70,3500]);const before=g.buildings.map(b=>[b.x,b.z,b.w,b.d,b.h,b.base||0]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[4]-b[4]);g.rebase();const shift=g.stats.origin.map(x=>x*144);const after=g.buildings.map(b=>[b.x+shift[0],b.z+shift[1],b.w,b.d,b.h,b.base||0]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[4]-b[4]);assert(before.length===after.length,'building count changed');assert(before.every((v,i)=>v.every((n,j)=>Math.abs(n-after[i][j])<.000001)),'buildings changed after rebasing')});
 check('bounded geometry and graphics render',()=>{fresh();g.attach();g.step(80);g.render();const s=g.stats;assert(s.glError===0,'WebGL error '+s.glError);assert(s.overflows===0,'instance buffer overflow');assert(s.chunks===25,'chunk budget changed');return s});
 fresh();g.attach();g.step(120);g.render();return results;
}'''

with sync_playwright() as p:
    for name in ('chromium', 'webkit'):
        browser = None
        try:
            opts = {'headless': True}
            if name == 'chromium':
                opts['args'] = ['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
                if os.environ.get('CHROMIUM_EXECUTABLE'):
                    opts['executable_path'] = os.environ['CHROMIUM_EXECUTABLE']
            browser = getattr(p, name).launch(**opts)
            page = browser.new_page(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
            errors=[]
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(URL, wait_until='load')
            page.wait_for_function('Boolean(window.__webswing)', timeout=20000)
            page.evaluate('window.__webswing.manual(true)')
            page.screenshot(path=str(OUT/f'{name}-title.png'))
            # Use an actual browser-dispatched touch tap for the start button.
            page.locator('#start').tap()
            assert page.evaluate('window.__webswing.state') == 'playing'
            results.append({'browser':name,'name':'touch start button','pass':True})
            for item in page.evaluate(SUITE):
                results.append({'browser':name,**item})
            page.screenshot(path=str(OUT/f'{name}-swing-portrait.png'))
            # Two independent pointer IDs must not cancel one another.
            touch = page.evaluate(r'''()=>{const g=window.__webswing;g.start();const pad=document.getElementById('pad'),web=document.getElementById('web'),r=pad.getBoundingClientRect();pad.dispatchEvent(new PointerEvent('pointerdown',{pointerId:11,pointerType:'touch',bubbles:true,clientX:r.right-12,clientY:r.top+r.height/2}));web.dispatchEvent(new PointerEvent('pointerdown',{pointerId:12,pointerType:'touch',bubbles:true}));const held=g.input.x>.2&&g.input.web&&!!g.P.rope;pad.dispatchEvent(new PointerEvent('pointerup',{pointerId:11,pointerType:'touch',bubbles:true}));const independent=g.input.x===0&&g.input.web;web.dispatchEvent(new PointerEvent('pointercancel',{pointerId:12,pointerType:'touch',bubbles:true}));return{held,independent,clean:!g.input.web&&!g.P.rope,state:g.state}}''')
            results.append({'browser':name,'name':'independent touch pointers and cancellation','pass':all(touch[k] for k in ('held','independent','clean')) and touch['state']=='playing','detail':touch})
            page.set_viewport_size({'width':844,'height':390})
            page.evaluate('window.__webswing.start();window.__webswing.attach();window.__webswing.step(120);window.__webswing.render()')
            page.screenshot(path=str(OUT/f'{name}-swing-landscape.png'))
            page.evaluate('window.__webswing.setDay(40)')
            page.screenshot(path=str(OUT/f'{name}-night.png'))
            results.append({'browser':name,'name':'no uncaught browser errors','pass':not errors,'errors':errors})
        except Exception as e:
            results.append({'browser':name,'name':'browser execution','pass':False,'error':str(e),'trace':traceback.format_exc()})
        finally:
            if browser:
                browser.close()
server.shutdown()
(OUT/'results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
failed=[r for r in results if not r['pass']]
print(f'RESULT: {len(results)-len(failed)}/{len(results)} passed')
raise SystemExit(bool(failed))
