"""Browser regressions for the dependency-free Web / Swing game.
Run: pip install playwright==1.55.0; playwright install chromium webkit
     python tests/web_swing_browser.py
Artifacts, including the exact tested HTML, are written to test-results/.
These are software-rendered browser checks, not physical iPhone benchmarks.
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
 check('freefall is ballistic without hidden forward thrust',()=>{fresh();g.setPosition([0,120,48],[0,0,0]);g.clearWorld();g.step(120);assert(g.P.v[1]<-23.7&&g.P.v[1]>-24.1,'incorrect tuned gravity');assert(Math.abs(g.P.v[2])<1e-10,'hidden forward force');assert(g.P.p[1]>107.8&&g.P.p[1]<108.1,'incorrect ballistic position');return {p:g.P.p,v:g.P.v}});
 check('slack rope cannot push or pull prematurely',()=>{fresh();g.P.rope={a:[0,70,48],length:50,age:0,tension:0,side:1,rate:0,zip:0};const p=[...g.P.p],v=[...g.P.v];g.solveRope(1/120);assert(distance(p,g.P.p)<1e-10&&distance(v,g.P.v)<1e-10,'slack rope applied force')});
 check('unpowered rope remains bounded without adding energy',()=>{fresh();g.setPosition([0,110,0],[23,0,0]);g.P.rope={a:[0,150,0],length:40,age:0,tension:0,side:1,rate:0,zip:0};g.clearWorld();const e0=.5*distance(g.P.v,[0,0,0])**2+g.constants.G*g.P.p[1];let maxStretch=0,maxEnergy=e0;for(let i=0;i<1200;i++){g.step();assert(g.P.rope,'rope unexpectedly detached');maxStretch=Math.max(maxStretch,distance(g.P.p,g.P.rope.a)-g.P.rope.length);maxEnergy=Math.max(maxEnergy,.5*distance(g.P.v,[0,0,0])**2+g.constants.G*g.P.p[1]);}assert(maxStretch<.001,'rope stretched');assert(maxEnergy<=e0+1,'energy added without input');return {maxStretch,e0,maxEnergy}});
 check('explicit reeling starts with bounded acceleration rather than a snap',()=>{fresh();g.attach();g.input.reel=1;const p=[...g.P.p],l=g.P.rope.length;g.solveRope(1/120);assert(distance(p,g.P.p)<.01,'first reel step snapped');assert(l-g.P.rope.length>0&&l-g.P.rope.length<.01,'first reel step must be finite and nonzero')});
 check('fixed timestep matches 30, 60 and 120 frame updates',()=>{let states=[];for(const fps of [30,60,120]){fresh();g.setPosition([0,120,48],[0,0,25]);g.clearWorld();for(let i=0;i<fps*2;i++)g.tick(1/fps);states.push({fps,p:[...g.P.p],v:[...g.P.v],elapsed:g.stats.elapsed})}assert(distance(states[0].p,states[2].p)<.002,'30/120 differ');assert(distance(states[1].p,states[2].p)<.002,'60/120 differ');return states});
 check('opposing traffic signals never receive simultaneous green',()=>{fresh();for(let t=0;t<56;t+=.1){g.setTime(t);assert(!(g.signal(0,0,0)&&g.signal(0,0,2)),'conflicting green at '+t)}});
 check('day-night timer wraps at precisely 600 simulation seconds',()=>{fresh();g.setDay(599.75);g.setPosition([0,120,48],[0,0,0]);g.clearWorld();g.step(60);assert(Math.abs(g.stats.dayTime-.25)<.00001,'incorrect day wrap');return g.stats.dayTime});
 check('ground contact ends the run',()=>{fresh();g.setPosition([0,1.02,48],[0,-5,10]);g.clearWorld();g.step(20);assert(g.state==='dead','ground hit did not end game');assert(!document.getElementById('over').hidden,'results panel missing')});
 check('high-speed facade collision does not tunnel through the wall',()=>{fresh();const b=g.buildings.find(b=>!b.base&&b.x>20&&b.x<100&&b.z>25&&b.z<70);assert(b,'test facade missing');const wall=b.x-b.w/2;g.setPosition([wall-5,10,b.z],[2000,0,0]);g.step();assert(g.P.p[0]<=wall-.399,'tunnelled into facade');assert(Math.abs(g.P.v[0])<.01,'normal velocity retained');assert(g.state==='playing','wall contact killed run');return {wall,p:[...g.P.p],v:[...g.P.v]}});
 check('pause freezes simulation and preserves rope on resume',()=>{fresh();g.attach();g.pause();const p=[...g.P.p];g.step(60);assert(distance(p,g.P.p)<1e-10,'movement while paused');g.resume();assert(g.P.rope,'resume silently released rope')});
 check('floating origin preserves nearby building geometry',()=>{fresh();g.setPosition([3500,70,3500]);const before=g.buildings.map(b=>[b.x,b.z,b.w,b.d,b.h,b.base||0]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[4]-b[4]);g.rebase();const shift=g.stats.origin.map(x=>x*144);const after=g.buildings.map(b=>[b.x+shift[0],b.z+shift[1],b.w,b.d,b.h,b.base||0]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[4]-b[4]);assert(before.length===after.length,'building count changed');assert(before.every((v,i)=>v.every((n,j)=>Math.abs(n-after[i][j])<.000001)),'buildings changed after rebasing')});
 check('chunk streaming stays within instance and object budgets',()=>{fresh();let peak=0;for(let i=0;i<30;i++){g.setPosition([0,70,48+i*144]);const s=g.stats;assert(s.chunks===25,'chunk accumulation');assert(s.overflows===0,'static instance overflow');assert(s.cars===72&&s.pedestrians===120,'agent count grew');peak=Math.max(peak,s.instances)}return {peakInstances:peak,chunks:g.stats.chunks}});
 // The old Y-to-reel script is deliberately replaced: Y now aims anchor height.
 // This route uses only thumb aiming, holding/releasing WEB and the normal ZIP action.
 check('30-second traversal using stick aim and held WEB without manual reel',()=>{fresh();let air=0,releases=0;for(let i=0;i<3600&&g.state==='playing';i++){const {P,input}=g;input.x=Math.max(-.7,Math.min(.7,P.p[0]*.02+P.v[0]*.024));input.y=P.p[1]<35?-.22:0;input.reel=0;if(P.rope){air=0;input.web=true;if(P.p[1]<20&&g.stats.energy>31)g.zip();if(P.rope.age>.25&&P.v[1]>5&&P.v[2]>8){input.web=false;g.release();releases++}}else{input.web=false;air+=1/120;if(i===0||air>.13&&(P.v[1]<5||P.p[1]<22)){if(g.attach())input.web=true}}g.step()}const s=g.stats;assert(g.state==='playing','scripted run crashed');assert(s.elapsed>29.99,'did not finish 30 seconds');assert(s.swingCount>=16&&releases>=16,'not enough chained swings');assert(g.P.p[2]>748,'no sustained forward traversal');assert(s.overflows===0,'geometry overflow during traversal');return {seconds:s.elapsed,distance:s.distance,forwardProgress:g.P.p[2]-48,swings:s.swingCount,releases}});
 check('bounded geometry and graphics render',()=>{fresh();g.attach();g.step(80);g.render();const s=g.stats;assert(s.glError===0,'WebGL error '+s.glError);assert(s.overflows===0,'instance buffer overflow');assert(s.chunks===25,'chunk budget changed');return s});
 check('long frames do not run the simulation in slow motion',()=>{let states=[];for(let fps of[5,8,15,60]){fresh();g.setPosition([0,120,48],[0,0,10]);g.clearWorld();for(let i=0;i<fps;i++)g.tick(1/fps);states.push({fps,elapsed:g.stats.elapsed,p:[...g.P.p]})}for(let q of states){assert(Math.abs(q.elapsed-1)<.00001,'lost game time at '+q.fps);assert(distance(q.p,states[3].p)<.0001,'different path at '+q.fps)}return states});
 check('launch traversal speed exceeds the old build without a catch boost',()=>{fresh();assert(g.P.v[2]===46,'incorrect launch speed');const p=[...g.P.p],v=[...g.P.v];g.attach();assert(distance(p,g.P.p)<1e-9&&distance(v,g.P.v)<1e-9,'catch teleported or boosted');g.release();g.clearWorld();g.step(120);assert(g.stats.distance>45,'first second lacks forward progress');return {launchSpeed:46,firstSecondDistance:g.stats.distance,gravity:g.constants.G}});
 check('continuous character has fixed limb lengths and a bounded mesh',()=>{fresh();for(let phase of[0,1,2,3]){g.start();if(phase===1){g.attach();g.step(130)}if(phase===2)g.P.v=[0,-20,40];if(phase===3){g.trick();g.step(24)}g.render();for(let l of g.character.armLengths){assert(Math.abs(l[0]-.307)<.00001&&Math.abs(l[1]-.302)<.00001,'arm stretched')}for(let l of g.character.legLengths){assert(Math.abs(l[0]-.436)<.00001&&Math.abs(l[1]-.433)<.00001,'leg stretched')}assert(g.character.triangles>1500&&g.character.triangles<4000,'character triangle budget');assert(g.stats.glError===0,'mesh WebGL error')}return {triangles:g.character.triangles,arms:g.character.armLengths,legs:g.character.legLengths}});
 check('aim sides map to camera screen left and right',()=>{let out=[];for(let x of[-1,1]){fresh();g.input.x=x;g.refreshTarget();g.render();let a=g.aim;assert(a.target,'no anchor for '+x);assert(a.target.p[0]*x<0,'wrong world side');let screen=g.project(a.target.p);assert(screen&&(screen[0]-innerWidth*.5)*x>0,'wrong screen side');out.push(a)}return out});
 check('up and down change anchor height but do not reel',()=>{let out=[];for(let y of[-1,1]){fresh();g.input.y=y;g.refreshTarget();assert(g.aim.target,'no anchor');out.push(g.aim.target.p);assert(g.reelValue()===0,'Y changes reel')}assert(out[0][1]>out[1][1]+20,'height not guided');return out});
 check('preview is the exact catch point without movement or boost',()=>{fresh();g.input.x=.8;g.input.y=-.3;g.refreshTarget();const t=[...g.aim.target.p],p=[...g.P.p],v=[...g.P.v];assert(g.attach(),'attach failed');assert(distance(t,g.P.rope.a)<1e-9,'preview changed at catch');assert(distance(p,g.P.p)<1e-9&&distance(v,g.P.v)<1e-9,'catch snapped');return t});
 check('aiming the next side preserves the held web and queued catch',()=>{fresh();g.input.x=-.8;g.refreshTarget();g.attach();const old=[...g.P.rope.a],length=g.P.rope.length;g.input.x=.8;g.refreshTarget();assert(g.aim.target,'next target missing');assert(g.aim.target.p[0]<0,'next target wrong side');assert(distance(old,g.P.rope.a)===0&&g.P.rope.length===length,'current rope changed');const next=[...g.aim.target.p];g.render();assert(document.getElementById('aimText').textContent==='NEXT WEB','next label absent');assert(!document.getElementById('aimTarget').hidden,'preview hidden');g.release();assert(g.attach(),'queued catch failed');assert(distance(next,g.P.rope.a)<1e-9,'queued catch ignored');return {old,next}});
 check('empty world cannot produce an invisible attachment',()=>{fresh();g.clearWorld();g.refreshTarget();assert(!g.aim.target&&!g.attach(),'attached to nothing');g.render();assert(document.getElementById('aimText').textContent==='NO ANCHOR','missing out-of-reach feedback')});
 check('two five-digit hands are generated in every pose',()=>{const out=[];for(let pose of['open','aim','shoot','grip','flip','dive']){fresh();if(pose==='aim'){g.input.x=1;g.refreshTarget()}if(pose==='shoot'||pose==='grip'){assert(g.attach(),'pose anchor missing');g.P.rope.age=pose==='shoot'?.02:1}if(pose==='flip')g.trick();if(pose==='dive')g.input.dive=true;g.render();assert(g.character.hands.length===2,'missing hands');for(let h of g.character.hands){assert(h.tips.length===5&&h.joints.length===5,'missing digits');for(let a=0;a<5;a++){assert(h.tips[a].every(Number.isFinite),'invalid finger');for(let b=a+1;b<5;b++)assert(distance(h.tips[a],h.tips[b])>.015,'digits overlap')}assert(h.socket.every(Number.isFinite),'invalid wrist shooter')}assert(g.character.triangles<4000,'mesh budget exceeded');assert(g.stats.glError===0,'hand draw error');out.push({pose,modes:g.character.hands.map(h=>h.mode),triangles:g.character.triangles})}return out});
 check('chosen left and right anchors accelerate toward the selected side',()=>{const out=[];for(let x of[-1,1]){fresh();g.input.x=x;g.refreshTarget();assert(g.attach(),'missing selected anchor');g.step(75);assert(g.P.v[0]*x<0,'opposite swing acceleration');out.push([...g.P.v])}return out});
 check('held-web low-altitude reel is independent of thumb height',()=>{const rates=[];for(let y of[-1,1]){fresh();g.attach();g.P.rope.age=1;g.input.web=true;g.input.y=y;rates.push(g.reelValue());const before=g.P.rope.length;g.solveRope(1/120);assert(before-g.P.rope.length>0&&before-g.P.rope.length<.01,'assisted reel not progressive')}assert(rates[0]===rates[1]&&rates[0]>0,'aim height changed assisted reel');return rates});
 check('neutral stick and restart clear the active aim gesture',()=>{fresh();g.input.x=.8;g.refreshTarget();assert(g.aim.intent.active,'gesture did not activate');g.input.x=g.input.y=0;g.refreshTarget();assert(!g.aim.intent.active,'neutral did not clear gesture');g.input.x=1;g.refreshTarget();g.start();assert(!g.aim.intent.active&&g.input.x===0&&g.input.y===0,'restart kept old aim')});
 fresh();g.input.web=true;g.attach();g.step(100);g.input.x=.7;g.refreshTarget();g.render();return results;
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
            page.locator('#start').tap()
            assert page.evaluate('window.__webswing.state') == 'playing'
            results.append({'browser':name,'name':'touch start button','pass':True})
            for item in page.evaluate(SUITE):
                results.append({'browser':name,**item})
            page.screenshot(path=str(OUT/f'{name}-swing-portrait.png'))
            page.evaluate('window.__webswing.start();window.__webswing.P.v=[0,-16,42];window.__webswing.render()')
            page.screenshot(path=str(OUT/f'{name}-freefall-portrait.png'))
            page.evaluate('window.__webswing.start();window.__webswing.input.x=-.75;window.__webswing.input.y=-.25;window.__webswing.refreshTarget();window.__webswing.render()')
            page.screenshot(path=str(OUT/f'{name}-aim-left-portrait.png'))
            page.evaluate('window.__webswing.input.x=.75;window.__webswing.refreshTarget();window.__webswing.render()')
            page.screenshot(path=str(OUT/f'{name}-aim-right-portrait.png'))
            page.evaluate('window.__webswing.start();window.__webswing.trick();window.__webswing.step(24);window.__webswing.render()')
            page.screenshot(path=str(OUT/f'{name}-trick-portrait.png'))
            touch = page.evaluate(r'''()=>{const g=window.__webswing;g.start();const pad=document.getElementById('pad'),web=document.getElementById('web'),r=pad.getBoundingClientRect();pad.dispatchEvent(new PointerEvent('pointerdown',{pointerId:11,pointerType:'touch',bubbles:true,clientX:r.right-12,clientY:r.top+r.height/2}));const preview=g.aim.target?.p.slice();web.dispatchEvent(new PointerEvent('pointerdown',{pointerId:12,pointerType:'touch',bubbles:true}));const held=g.input.x>.2&&g.input.web&&!!g.P.rope;const matched=!!preview&&!!g.P.rope&&Math.hypot(...preview.map((n,i)=>n-g.P.rope.a[i]))<1e-8;pad.dispatchEvent(new PointerEvent('pointerup',{pointerId:11,pointerType:'touch',bubbles:true}));const independent=g.input.x===0&&g.input.web&&!!g.P.rope;web.dispatchEvent(new PointerEvent('pointercancel',{pointerId:12,pointerType:'touch',bubbles:true}));return{held,matched,independent,clean:!g.input.web&&!g.P.rope,state:g.state}}''')
            results.append({'browser':name,'name':'independent touch pointers, aimed catch and cancellation','pass':all(touch[k] for k in ('held','matched','independent','clean')) and touch['state']=='playing','detail':touch})
            # Wait for asynchronous viewport/layout notifications before manual rendering.
            page.set_viewport_size({'width':844,'height':390})
            page.wait_for_function('innerWidth === 844 && innerHeight === 390')
            page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
            page.wait_for_function('Math.abs(document.getElementById("world").width/document.getElementById("world").height-innerWidth/innerHeight)<.01')
            page.evaluate('window.__webswing.start();window.__webswing.input.web=true;window.__webswing.attach();window.__webswing.step(100);window.__webswing.input.x=-.7;window.__webswing.refreshTarget();window.__webswing.render()')
            ratio = page.evaluate('({canvas:document.getElementById("world").width/document.getElementById("world").height, viewport:innerWidth/innerHeight})')
            results.append({'browser':name,'name':'phone rotation updates drawing-buffer aspect','pass':abs(ratio['canvas']-ratio['viewport'])<.01,'detail':ratio})
            page.screenshot(path=str(OUT/f'{name}-swing-landscape.png'))
            page.evaluate('window.__webswing.start();window.__webswing.P.v=[0,-9,46];window.__webswing.render()')
            page.screenshot(path=str(OUT/f'{name}-freefall-landscape.png'))
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
