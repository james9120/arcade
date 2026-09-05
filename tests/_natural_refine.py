"""Second-pass corrections found during interaction and render review."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'games/web-swing/index.html'
s=p.read_text()
s=s.replace("function pause(){if(state!=='playing')return;state='paused';clearInput();", "function pause(){if(state!=='playing')return;navigation.resumeWeb=input.web;state='paused';clearInput();")
s=s.replace("input.web=!!P.rope;accumulator=0;", "input.web=!!navigation.resumeWeb;accumulator=0;")
s=s.replace("P.rope?powerValue():0", "(P.rope||P.wall)?powerValue():0")
s=s.replace("P.rope&&flow.boost>.12", "(P.rope||P.wall)&&flow.boost>.12")
s=s.replace("'↑ POWER SWING '+Math.round", "(P.wall?'↑ WALL CLIMB ':'↑ POWER SWING ')+Math.round")
# A longer manually selected line must not be clamped to 100m on its first tick.
# That would create a position correction and a fictitious, enormous reel velocity.
s=s.replace("clamp(r.length+r.rate*dt,9,100)","clamp(r.length+r.rate*dt,9,r.source==='tap'?135:106)")
# Reject a back face hidden from the character by the target building itself.
s=s.replace('for(let q of buildings){if(q===b)continue;let hit=rayBox','for(let q of buildings){let hit=rayBox')
s=s.replace('AIM / ↑ POWER','STEER / ↑ POWER')
s=s.replace('unit(add(mul(P.wall.n,.96),[0,.30,0]))','unit(add(mul(P.wall.n,.45),[0,.90,0]))')
s=s.replace('foot=[s*.13,-.84+plant*.16,Math.cos(phase)*.26];',"const wallSide=Math.sign(localVector(root,P.wall.n)[0])||1;foot=[-wallSide*(.43-plant*.18)+s*.055,-.84+plant*.14,Math.cos(phase)*.26];")
s=s.replace('// The left stick chooses the NEXT facade attachment. Up also powers the live reel, without moving its anchor.','// Auto-target refresh state. The stick controls character steering and power.')
p.write_text(s)
checks=ROOT/'tests/web_swing_natural_checks.js'
t=checks.read_text()
extra=""" check('long tap lines do not shorten to the old 100m limit on the first tick',()=>{fresh();const a=g.buildings.map(b=>({b,p:[b.x-b.w/2-.04,Math.min(b.h-.4,g.P.p[1]+120),Math.max(b.z-b.d/2+.5,Math.min(b.z+b.d/2-.5,g.P.p[2]))],side:-1})).find(a=>g.surfaceAnchorValid(a,135)&&dist(a.p,g.P.p)>108);assert(a,'no long-line fixture');const before=[...g.P.p];assert(g.fireTap(a,50,50),'long tap failed');const length=g.P.rope.length;g.step();assert(dist(before,g.P.p)<1.5,'long-line catch snapped');assert(g.P.rope&&g.P.rope.length>107,'line clamped to old limit');return{length,firstTickTravel:dist(before,g.P.p)};});
 check('pausing a tap-only swing does not secretly enable auto-chain',()=>{fresh();g.fireTap(g.refreshTarget(),100,100);assert(!g.input.web,'initial input');g.pause();g.resume();assert(!g.input.web&&g.P.rope?.source==='tap','pause converted one-shot to auto-chain');});
 check('active wall geometry survives a floating-origin rebase',()=>{fresh('MANUAL');g.setPosition([3456,35,3456],[0,0,26]);const b=g.buildings.find(b=>!b.base&&b.x>3476&&b.x<3556&&b.z>3481&&b.z<3526&&b.h>40);assert(b,'far wall fixture');const wall=b.x-b.w/2;g.setPosition([wall-.70,25,b.z-b.d/2+2],[.8,0,26]);g.step(12);assert(g.P.wall,'no far wall run');const gap=(g.P.p[g.P.wall.axis]-g.P.wall.face)*g.P.wall.sign;g.rebase();assert(g.P.wall,'wall lost on rebase');const after=(g.P.p[g.P.wall.axis]-g.P.wall.face)*g.P.wall.sign;assert(Math.abs(gap-after)<1e-6,'wall moved relative to body');g.step();assert(g.P.wall,'rebased wall failed bounds');});
"""
assert 'long tap lines do not shorten' not in t
t=t.replace(' fresh();g.input.web=true;g.attach();g.step(120);g.render();return results;',extra+' fresh();g.input.web=true;g.attach();g.step(120);g.render();return results;')
checks.write_text(t)
runner=ROOT/'tests/web_swing_browser.py'
t=runner.read_text()
needle="                page.touchscreen.tap(scene_point['x'], scene_point['y'])"
assert needle in t
observer='''                # WebKit can quantize fractional touch coordinates. Compare with the
                # actual PointerEvent ray, not an impossible subpixel finger position.
                page.evaluate("document.getElementById('world').addEventListener('pointerdown',e=>{const a=window.__webswing.pickScreen(e.clientX,e.clientY);window.__observedTap={x:e.clientX,y:e.clientY,p:a?.p}},{once:true})")
'''
t=t.replace(needle,observer+needle)
t=t.replace("                error = sum((a-b)**2 for a,b in zip(tapped.get('anchor') or [999,999,999], scene_point['p']))**.5", "                observed = page.evaluate('window.__observedTap')\n                error = sum((a-b)**2 for a,b in zip(tapped.get('anchor') or [999,999,999], observed.get('p') or [0,0,0]))**.5\n                tapped['observedPointer'] = observed")
# Small wall-run sequence for pose review, in addition to the existing full-city shots.
needle="            page.screenshot(path=str(OUT / f'{name}-wall-run-landscape.png'))"
sequence="""
            if name == 'chromium':
                for ticks in (1, 8, 16, 24, 36, 48):
                    render(page, wall_fixture.replace('g.step(36)', f'g.step({ticks})'))
                    page.screenshot(path=str(OUT / f'wall-motion-{ticks:03d}.png'))
"""
t=t.replace(needle,needle+sequence)
runner.write_text(t)
