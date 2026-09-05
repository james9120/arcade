"""Temporary, hash-guarded composer for the self-contained runtime and its regressions."""
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'games/web-swing/index.html'
s=p.read_text()
assert hashlib.sha1(b'blob '+str(len(s.encode())).encode()+b'\0'+s.encode()).hexdigest()=='3fb3474a223cb2f4f23de77dbf733e124c33c80e','Unexpected game baseline'
new=(ROOT/'tests/_natural_traversal.js').read_text()
a=s.index('function aimIntent(){');b=s.index('const flow=',a);s=s[:a]+s[b:]
a=s.index('function anchorScore(');b=s.index('function say(',a);s=s[:a]+new+'\n'+s[b:]
a=s.index('function drawAimPreview(){',s.index('function render('));b=s.index('let hudTimer=',a);s=s[:a]+s[b:]
a=s.index('function attach(){');b=s.index('function release(',a)
s=s[:a]+'''function attach(selection=null,source='auto'){
 if(state!=='playing'||P.rope)return false;
 const a=selection||targetForCatch();if(!a||!surfaceAnchorValid(a,source==='tap'?135:106))return false;
 if(P.wall)exitWall('catch',false);
 P.rope={a:[...a.p],length:len(sub(a.p,P.p)),age:0,tension:0,side:a.side,rate:0,zip:0,source};
 target=null;aimControl.refresh=0;lastSide=a.side;swingCount++;chain=Math.min(9,1+Math.floor(swingCount/3));
 if(trickBank){score+=trickBank*chain;say('CLEAN CATCH','+'+trickBank*chain+' STYLE BANKED');trickBank=0}
 P.flip=null;tone(480,1400,.10,.06);haptic();return true;
}
'''+s[b:]
s=s.replace('P.rope=null;targetTimer=0;flow.air=0;flow.manualRelease=automatic?0:.10;','navigation.lastAnchor=[...r.a];navigation.lastRelease=simTime;P.rope=null;targetTimer=0;flow.air=0;flow.manualRelease=automatic?0:.10;')
s=s.replace("if(state!=='playing'||P.flip)return;if(P.rope)","if(state!=='playing'||P.flip)return;if(P.wall)exitWall('jump',true);if(P.rope)")
s=s.replace("if(state!=='playing'||energy<30||zipCool>0)return;if(!P.rope","if(state!=='playing'||energy<30||zipCool>0)return;if(P.wall)exitWall('zip',true);if(!P.rope")
s=s.replace('HOLD WEB · AIM YOUR NEXT CATCH','PUSH UP · RIDE THE ARC')
s=s.replace("if(state!=='playing'||!input.web||settings.swingMode!=='FLOW')return;",'''if(P.wall)return;
 if(P.rope&&P.rope.source==='tap'){
  const r=P.rope,along=dot(sub(r.a,P.p),unit([P.v[0],0,P.v[2]]));
  if(r.age>.72&&P.v[1]>5&&along<12||r.age>2.6){release(true);flow.releases++;}
  return;
 }
 if(state!=='playing'||!input.web||settings.swingMode!=='FLOW')return;''')
s=s.replace('elapsed+=dt;simTime+=dt;dayTime=','elapsed+=dt;simTime+=dt;navigation.turn=mix(navigation.turn,steerValue(),1-Math.exp(-dt*5));wallControl.cooldown=Math.max(0,wallControl.cooldown-dt);if(tapControl.feedback)tapControl.feedback.age+=dt;dayTime=')
s=s.replace('energy=Math.min(100,energy+dt*7);let sx=','energy=Math.min(100,energy+dt*(P.wall?0:7));if(!P.wall)enterWall(nearestRunningWall());let sx=')
s=s.replace(' }force=add(force,steering);let drag=',' }force=P.wall?(wallForce(dt)||add(force,steering)):add(force,steering);let drag=')
s=s.replace('solveRope(dt);collide(P.prev);animatePhysics','solveRope(dt);collide(P.prev);if(!P.wall)enterWall(nearestRunningWall());animatePhysics')
s=s.replace("if(input.web&&!P.rope&&settings.swingMode!=='FLOW')","if(input.web&&!P.rope&&!P.wall&&settings.swingMode!=='FLOW')")
s=s.replace("wallCool=1.5;say('WALL SKIM','STEER OUT · CATCH A NEW WEB');tone","wallCool=1.5;if(!P.wall)say('WALL CONTACT','STEER ALONG THE WALL OR TAP TO SWING');tone")
s=s.replace('let up=P.rope?unit(lerp','let up=P.wall?unit(add(mul(P.wall.n,.96),[0,.30,0])):P.rope?unit(lerp')
s=s.replace('const aiming=!flip&&!attached&&aimIntent().active&&target&&s===-target.side;','const aiming=false;')
s=s.replace(' const mode=attached?', ''' if(P.wall){
  const phase=P.wall.phase+(s>0?Math.PI:0),plant=Math.max(0,Math.sin(phase));
  arm=[s*.27,.17+Math.sin(phase)*.16,-Math.cos(phase)*.24];
  foot=[s*.13,-.84+plant*.16,Math.cos(phase)*.26];
 }
 const mode=attached?''')
s=s.replace('pitch=r?0:dive?','pitch=P.wall?.12:r?0:dive?')
s=s.replace('rig.bank=mix(rig.bank,-steerValue()*.24,k)','rig.bank=mix(rig.bank,P.wall?0:-steerValue()*.24,k)')
s=s.replace('if(P.rope)P.rope.a=sub(P.rope.a,shift);if(target)','if(P.rope)P.rope.a=sub(P.rope.a,shift);if(P.wall){P.wall.b.x-=shift[0];P.wall.b.z-=shift[2];P.wall.face-=shift[P.wall.axis];}if(navigation.lastAnchor)navigation.lastAnchor=sub(navigation.lastAnchor,shift);if(tapControl.feedback?.p)tapControl.feedback.p=sub(tapControl.feedback.p,shift);cancelSceneTap();if(target)')
s=s.replace('function clearInput(){','function clearInput(){cancelSceneTap();')
s=s.replace('function reset(){clearInput();','function reset(){clearInput();resetTraversal();')
s=s.replace("state='dead';P.p[1]=RADIUS;P.rope=null;","state='dead';P.p[1]=RADIUS;P.rope=null;P.wall=null;")
s=s.replace('vu=cross(vr,vf);heroGeometry();','vu=cross(vr,vf);Object.assign(viewRay,{eye:[...cam],f:vf,r:vr,u:vu,tan:Math.tan(fov*Math.PI/360),aspect:width/height,ready:true});heroGeometry();')
s=s.replace(' // Sweep the camera arm',' if(P.wall){desired=add(desired,mul(P.wall.n,.65));focus=add(focus,mul(P.wall.n,.2));}\n // Sweep the camera arm')
s=s.replace("refreshTarget();if(input.web&&!P.rope&&(settings.swingMode!=='FLOW'||flow.air>.16))attach();",'')
s=s.replace("aimControl.active=false;refreshTarget();$('knob')","aimControl.active=false;$('knob')")
s=s.replace("flow.manualRelease=0;if(!P.rope&&!attach())say('NO ANCHOR THERE','MOVE THE LEFT STICK · KEEP WEB HELD')","flow.manualRelease=0;if(P.wall)exitWall('jump',true);if(!P.rope&&!attach())say('LOOKING FOR A CATCH','KEEP MOVING · HOLD WEB')")
s=s.replace('flow.manualRelease=0;attach()}',"flow.manualRelease=0;if(P.wall)exitWall('jump',true);attach()}")
s=s.replace("if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))refreshTarget();",'')
s=s.replace("if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&state==='playing')refreshTarget();",'')
s=s.replace('let fpsTime=0,fpsFrames=0,previewTimer=0;','setupSceneTaps();\nlet fpsTime=0,fpsFrames=0,previewTimer=0;')
s=s.replace('Web / Swing — City Flow','Web / Swing — Natural Flow')
s=s.replace('CITY FLOW / LIVING STREETS','NATURAL FLOW / AUTO WEB')
s=s.replace('AIM / POWER','STEER / POWER').replace('AIM + POWER','STEER + POWER')
s=s.replace('Left stick aims the next web. Hold WEB to catch; release to fly.','Hold WEB for auto swings. Steer with the stick or tap a building.')
s=s.replace('Aim the next web. Left or right picks a side; up or down changes anchor height.','Steer left or right. Push up for power. Tap the city to choose a web attachment.')
s=s.replace('<b>Left/right</b> aims. <b>Up</b> builds speed and height.','<b>Left/right</b> steers. <b>Up</b> builds speed and height.')
s=s.replace('Choose <b>Manual</b> in Pause for full control.','<b>Tap a building</b> to swing there. Skim walls to run.')
s=s.replace('WASD / arrows aim','WASD / arrows steer')
s=s.replace("'HOLD WEB · AIM LEFT / RIGHT · PUSH UP FOR POWER'","'HOLD WEB · STEER & POWER · TAP A BUILDING'")
s=s.replace("'AIM THE NEXT WEB'","'RIDE THE ARC'").replace("'AIM WITH LEFT STICK'","'AUTO CATCH'")
s=s.replace("'Keep WEB held. Left / right aims; push up to accelerate and climb.'","'Auto web is on. Steer left / right; push up for power.'")
s=s.replace("'Aim the next cyan target. Push up to power through the arc.'","'Push up for power. Tap a building to choose a specific catch.'")
s=s.replace("'Hold WEB to chain swings. Aim left/right; push up for power.'","'Hold WEB for auto swings. Tap a building for one targeted swing.'")
s=s.replace("'Left / right aims. Up powers the swing. ZIP gives a stronger pull.'","'Steer and power with the stick. Tap a building to swing there.'")
s=s.replace("$('hint').textContent=risk>.4?","$('hint').textContent=P.wall?'Wall running. Push up to climb; steer away or tap to leave.':risk>.4?")
s=s.replace("$('webLabel').textContent=settings.swingMode","$('webLabel').textContent=P.wall?'LEAP':settings.swingMode")
s=s.replace("$('webSub').textContent=settings.swingMode","$('webSub').textContent=P.wall?'JUMP & CATCH':P.rope?.source==='tap'?'TAP SWING':settings.swingMode")
s=s.replace('character:characterTelemetry,flow,rig,life,','character:characterTelemetry,flow,rig,life,navigation,wallControl,tapControl,pickScreen,fireTap,surfaceAnchorValid,predictAnchor,nearestRunningWall,enterWall,exitWall,')
s=s.replace('setPosition(p,v=[0,0,30]){P.p=','setPosition(p,v=[0,0,30]){P.wall=null;P.p=')
s=s.replace('if((ready||overdue)&&target)','if((ready||overdue)&&(target||P.p[1]>38))')
s=s.replace("settings.swingMode==='FLOW'&&input.web&&Math.abs(steerValue())<.18","settings.swingMode==='FLOW'&&input.web&&!P.wall&&P.rope?.source!=='tap'&&Math.abs(steerValue())<.18")
s=s.replace("if(settings.swingMode==='FLOW'&&input.web){","if(settings.swingMode==='FLOW'&&input.web&&!P.wall&&P.rope?.source!=='tap'){")
p.write_text(s)
# Only obsolete cursor expectations are removed; existing physics, city, animation,
# long-route and layout checks remain. The new suite covers movement-only controls.
checks=ROOT/'tests/web_swing_flow_checks.js'
t=checks.read_text()
t='\n'.join(line for line in t.splitlines() if "check('camera-relative left and right choose real facade anchors'" not in line and "check('up and down still guide the next anchor height'" not in line)+'\n'
checks.write_text(t)
runner=ROOT/'tests/web_swing_browser.py'
t=runner.read_text()
t=t.replace("SUITE = (ROOT / 'tests/web_swing_flow_checks.js').read_text()","SUITE = (ROOT / 'tests/web_swing_flow_checks.js').read_text()\nNATURAL_SUITE = (ROOT / 'tests/web_swing_natural_checks.js').read_text()")
t=t.replace('for item in page.evaluate(SUITE):','for item in page.evaluate(SUITE) + page.evaluate(NATURAL_SUITE):')
# Insert extra real touch, gesture ownership, orientation and wall-render checks.
extra=(ROOT/'tests/_natural_browser_extra.py').read_text()
needle="            page.screenshot(path=str(OUT / f'{name}-swing-portrait.png'))"
assert needle in t
t=t.replace(needle,needle+'\n'+extra,1)
runner.write_text(t)
print('Natural Flow composed:',len(s),'characters')
