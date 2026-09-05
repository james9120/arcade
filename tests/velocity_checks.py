"""Preview adapter: run the existing regression suite against gameplay-tuned gravity.
The candidate HTML is generated before this script. Browser results do not assert
human-rated feel or physical iPhone performance.
"""
from pathlib import Path
path = Path(__file__).with_name('web_swing_browser.py')
s = path.read_text()
s = s.replace("assert(g.P.v[1]<-9.7&&g.P.v[1]>-9.9,'incorrect gravity')", "assert(g.P.v[1]<-23.7&&g.P.v[1]>-24.1,'incorrect tuned gravity')")
s = s.replace("assert(g.P.p[1]>115&&g.P.p[1]<115.2,'incorrect ballistic position')", "assert(g.P.p[1]>107.8&&g.P.p[1]<108.1,'incorrect ballistic position')")
s = s.replace('9.81*g.P.p[1]', 'g.constants.G*g.P.p[1]')
s = s.replace("input.x=Math.max(-.9,Math.min(.9,P.p[0]/15+P.v[0]/13));input.y=P.p[1]<45?-.5:0", "input.x=Math.max(-1,Math.min(1,P.p[0]/15+P.v[0]/13));input.y=P.p[1]<48?-.8:0")
s = s.replace("P.p[1]<20&&g.stats.energy>31", "P.p[1]<24&&g.stats.energy>31")
s = s.replace("P.rope.age>.35&&P.v[1]>3", "P.rope.age>.5&&P.v[1]>7")
s = s.replace("air>.22&&(P.v[1]<1||P.p[1]<22)", "air>.10&&(P.v[1]<3||P.p[1]<24)")
extra = r'''
 check('long frames do not run the simulation in slow motion',()=>{let states=[];for(let fps of[5,8,15,60]){fresh();g.setPosition([0,120,48],[0,0,10]);g.clearWorld();for(let i=0;i<fps;i++)g.tick(1/fps);states.push({fps,elapsed:g.stats.elapsed,p:[...g.P.p]})}for(let q of states){assert(Math.abs(q.elapsed-1)<.00001,'lost game time at '+q.fps);assert(distance(q.p,states[3].p)<.0001,'different path at '+q.fps)}return states});
 check('launch traversal speed exceeds the old build without a catch boost',()=>{fresh();assert(g.P.v[2]===46,'incorrect launch speed');const p=[...g.P.p],v=[...g.P.v];g.attach();assert(distance(p,g.P.p)<1e-9&&distance(v,g.P.v)<1e-9,'catch teleported or boosted');g.release();g.clearWorld();g.step(120);assert(g.stats.distance>45,'first second lacks forward progress');return {launchSpeed:46,firstSecondDistance:g.stats.distance,gravity:g.constants.G}});
 check('continuous character has fixed limb lengths and a bounded mesh',()=>{fresh();for(let phase of[0,1,2,3]){g.start();if(phase===1){g.attach();g.step(130)}if(phase===2)g.P.v=[0,-20,40];if(phase===3){g.trick();g.step(24)}g.render();for(let l of g.character.armLengths){assert(Math.abs(l[0]-.307)<.00001&&Math.abs(l[1]-.302)<.00001,'arm stretched')}for(let l of g.character.legLengths){assert(Math.abs(l[0]-.436)<.00001&&Math.abs(l[1]-.433)<.00001,'leg stretched')}assert(g.character.triangles>1500&&g.character.triangles<4000,'character triangle budget');assert(g.stats.glError===0,'mesh WebGL error')}return {triangles:g.character.triangles,arms:g.character.armLengths,legs:g.character.legLengths}});
'''
s = s.replace(' fresh();g.attach();g.step(120);g.render();return results;', extra+'\n fresh();g.attach();g.step(140);g.render();return results;')
s = s.replace("page.screenshot(path=str(OUT/f'{name}-swing-portrait.png'))", """page.screenshot(path=str(OUT/f'{name}-swing-portrait.png'))
            page.evaluate('window.__webswing.start();window.__webswing.P.v=[0,-16,42];window.__webswing.render()')
            page.screenshot(path=str(OUT/f'{name}-freefall-portrait.png'))
            page.evaluate('window.__webswing.start();window.__webswing.trick();window.__webswing.step(24);window.__webswing.render()')
            page.screenshot(path=str(OUT/f'{name}-trick-portrait.png'))""")
s = s.replace("page.screenshot(path=str(OUT/f'{name}-swing-landscape.png'))", """page.screenshot(path=str(OUT/f'{name}-swing-landscape.png'))
            page.evaluate('window.__webswing.start();window.__webswing.P.v=[0,-9,46];window.__webswing.render()')
            page.screenshot(path=str(OUT/f'{name}-freefall-landscape.png'))""")
path.write_text(s)
print('Updated regression checks and preview screenshot states')
