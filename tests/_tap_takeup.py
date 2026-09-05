"""Final targeted polish: reel slack out of a long tapped line over time, never snap it."""
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'games/web-swing/index.html'
s=p.read_text();data=s.encode()
assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()=='23594ce87de8a1f2f1eaa82133f5226295a4fc81','Unexpected runtime'
old="wanted=r.zip>0?-20:reel>0?-reel*(8+powerValue()*4):-reel*8"
new="wanted=r.source==='tap'&&r.a[1]-r.length<12&&energy>1?-38:r.zip>0?-20:reel>0?-reel*(8+powerValue()*4):-reel*8"
assert s.count(old)==1;s=s.replace(old,new)
old='r.rate+=clamp(wanted-r.rate,-42*dt,42*dt);'
new="const acceleration=r.source==='tap'?70:42;if(r.source==='tap'&&wanted===-38)energy=Math.max(0,energy-18*dt);r.rate+=clamp(wanted-r.rate,-acceleration*dt,acceleration*dt);"
assert s.count(old)==1;s=s.replace(old,new)
s=s.replace('function solveRope(dt){','// Long tap arcs use a stamina-powered slack take-up with bounded acceleration.\n// The clicked anchor never moves, and attachment itself never modifies p or v.\nfunction solveRope(dt){',1)
p.write_text(s)
p=ROOT/'tests/web_swing_natural_checks.js';s=p.read_text()
extra=""" check('a distant tapped line takes up progressively and completes an airborne arc',()=>{fresh();g.render();const a=g.pickScreen(innerWidth*.10,innerHeight*.28);assert(a&&g.surfaceAnchorValid(a,135),'distant scene fixture');const p=[...g.P.p],v=[...g.P.v],L=dist(a.p,p);assert(L>110&&a.p[1]-L<0,'fixture no longer exercises slack take-up');assert(g.fireTap(a,innerWidth*.1,innerHeight*.28),'tap failed');assert(dist(p,g.P.p)<1e-9&&dist(v,g.P.v)<1e-9,'tap snap');const initialEnergy=g.stats.energy;let minY=Infinity,maxSpeed=0;for(let i=0;i<270&&g.state==='playing';i++){g.step();minY=Math.min(minY,g.P.p[1]);maxSpeed=Math.max(maxSpeed,dist(g.P.v,[0,0,0]));if(i===0)assert(dist(p,g.P.p)<1.5,'first-tick snap');}assert(g.state==='playing','long tap fell before completing arc');assert(g.stats.energy<initialEnergy-5,'take-up not energy-limited');assert(maxSpeed<115,'pathological velocity spike');assert(!g.input.web,'tap latched auto mode');return{initialLine:L,seconds:g.stats.elapsed,minY,maxSpeed,energy:g.stats.energy};});
 check('holding WEB after a distant tap returns to automatic travel',()=>{fresh();g.render();const a=g.pickScreen(innerWidth*.10,innerHeight*.28);assert(a&&g.surfaceAnchorValid(a,135),'distant scene fixture');g.input.web=true;assert(g.fireTap(a,innerWidth*.1,innerHeight*.28),'tap failed');g.step(1200);assert(g.state==='playing'&&g.stats.swingCount>2,'did not resume after distant tap');return{seconds:g.stats.elapsed,distance:g.stats.distance,swings:g.stats.swingCount};});
"""
needle=' fresh();g.input.web=true;g.attach();g.step(120);g.render();return results;'
assert needle in s;s=s.replace(needle,extra+needle);p.write_text(s)
print('Progressive long-tap take-up and two full-arc regressions added')
