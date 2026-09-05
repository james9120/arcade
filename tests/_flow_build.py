"""Temporary, base-hash-locked City Flow composer. Runtime remains one HTML file."""
from pathlib import Path
import hashlib
r=Path(__file__).resolve().parent
ROOT=r.parent
p=ROOT/'games/web-swing/index.html'
b=p.read_bytes()
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
assert blob(b)=='058538b71752fd0b64ba15782cbfefefa75839d1','Unexpected game baseline; refusing to overwrite'
s=b.decode()
def rep(a,b):
 global s
 assert a in s,a[:100]
 s=s.replace(a,b)
def section(a,b,c):
 global s
 start=s.index(a);end=s.index(b,start)
 s=s[:start]+c+'\n'+s[end:]
rep('Web / Swing — Thumb Aim','Web / Swing — City Flow') if 'Web / Swing — Thumb Aim' in s else None
rep("quality:'AUTO'}","quality:'AUTO',swingMode:'FLOW'}")
rep("if(['AUTO','HIGH','LOW'].includes(s.quality))settings.quality=s.quality", "if(['AUTO','HIGH','LOW'].includes(s.quality))settings.quality=s.quality;if(['FLOW','MANUAL'].includes(s.swingMode))settings.swingMode=s.swingMode")
rep('props=new Batch(cube,4000)','props=new Batch(cube,6200)')
rep('p:[0,32,48],prev:[0,32,48]','p:[0,42,48],prev:[0,42,48]')
rep('P.p=[0,32,48];','P.p=[0,42,48];')
rep('cam=[0,33.6,40.4],camLook=[0,32.2,53]','cam=[0,43.6,40.4],camLook=[0,42.2,53]')
rep('cam=[0,33.6,40.4];camLook=[0,32.2,53]','cam=[0,43.6,40.4];camLook=[0,42.2,53]')
section('function reelValue(){','function anchorScore',r'''const flow={air:0,catches:0,releases:0,rescues:0,boost:0,manualRelease:0,toast:0,milestone:0};
function powerValue(){return clamp(-input.y+(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),0,1)}
function reelValue(){
 if(keys.has('KeyR'))return 1;
 if(Math.abs(input.reel||0)>.001)return clamp(input.reel,-1,1);
 if(!P.rope)return 0;
 const power=powerValue(),assist=input.web&&P.rope.age>.12?clamp((settings.swingMode==='FLOW'?55:46)-P.p[1],0,30)/30*.80:0;
 return Math.max(power,assist);
}
function setSwingMode(mode){settings.swingMode=mode==='MANUAL'?'MANUAL':'FLOW';flow.air=0;flow.manualRelease=0;save();syncSettings()}
function resetFlow(){Object.assign(flow,{air:0,catches:0,releases:0,rescues:0,boost:0,manualRelease:0,toast:0,milestone:0})}
function flowStep(dt){
 flow.manualRelease=Math.max(0,flow.manualRelease-dt);flow.toast=Math.max(0,flow.toast-dt);
 flow.boost=mix(flow.boost,P.rope?powerValue():0,1-Math.exp(-dt*8));
 if(P.rope)flow.air=0;else flow.air+=dt;
 if(state!=='playing'||!input.web||settings.swingMode!=='FLOW')return;
 if(P.rope){
  const r=P.rope,horizontal=Math.hypot(P.v[0],P.v[2]),intent=aimIntent(),along=dot(sub(r.a,P.p),forward());
  // Release only when a real next facade is reachable and the arc has created lift.
  // Early release remains available simply by lifting the WEB finger.
  const ready=r.age>.55&&P.v[1]>5&&horizontal>18&&along<24;
  const overdue=r.age>1.65&&along<0&&horizontal>16&&P.p[1]>12;
  if((ready||overdue)&&target){release(true);flow.releases++;flow.air=0;}
  else if(P.p[1]<17&&P.v[1]<-5&&r.zip<=0&&energy>=22&&zipCool<=0){
   r.zip=.65;energy-=22;zipCool=2;flow.rescues++;
   if(flow.toast<=0){say('LOW CATCH','ASSISTED REEL · PUSH UP TO CLIMB');flow.toast=5}
  }
 }else{
  // A brief flight phase prevents button hold from immediately catching the same web.
  const fallSoon=P.p[1]<25||P.v[1]<2;
  if(flow.air>.16&&(fallSoon||flow.air>.58)&&flow.manualRelease<=0){
   targetTimer-=dt;if(targetTimer<=0){if(attach())flow.catches++;targetTimer=.08;}
  }
 }
}''')
rep('aimControl.refresh=1/30','aimControl.refresh=1/20')
rep("function release(){if(!P.rope)return;", "function release(automatic=false){if(!P.rope)return;")
rep("score+=50*chain;say('CLEAN RELEASE','KEEP THE MOMENTUM');tone(670,1000,.1,.035)","score+=50*chain;if(!automatic||swingCount%5===0){say('CLEAN RELEASE','KEEP THE MOMENTUM');tone(670,1000,.1,.025)}")
rep('P.rope=null;targetTimer=0;}','P.rope=null;targetTimer=0;flow.air=0;flow.manualRelease=automatic?0:.10;}')
rep('steering=add(steering,mul(tangent,up*3.8))','steering=add(steering,mul(tangent,up*(3.8+powerValue()*10)))')
rep('force=add(force,steering);let drag=',r'''if(settings.swingMode==='FLOW'&&input.web){
  const n=P.rope?unit(sub(P.p,P.rope.a)):null;
  if(P.rope){let drive=mul(f,clamp((44-Math.hypot(P.v[0],P.v[2]))*.45,0,6));drive=sub(drive,mul(n,dot(drive,n)));steering=add(steering,drive);}
  // Centering is only for neutral horizontal input, never fighting a chosen turn.
  if(Math.abs(sx)<.18){const axis=Math.abs(f[2])>=Math.abs(f[0])?0:2,offset=P.p[axis]-Math.round(P.p[axis]/TILE)*TILE;
   if(Math.abs(offset)<ROAD*.55){let guard=[0,0,0];guard[axis]=clamp(-offset*1.8-P.v[axis]*1.6,-24,24);if(n)guard=sub(guard,mul(n,dot(guard,n)));steering=add(steering,guard)}
  }
 }force=add(force,steering);let drag=''')
rep('wanted=r.zip>0?-20:reel>0?-reel*8:-reel*8','wanted=r.zip>0?-20:reel>0?-reel*(8+powerValue()*4):-reel*8')
rep('if(input.web&&!P.rope){targetTimer-=dt;if(targetTimer<=0){attach();targetTimer=.16}}',"flowStep(dt);if(input.web&&!P.rope&&settings.swingMode!=='FLOW'){targetTimer-=dt;if(targetTimer<=0){attach();targetTimer=.10}}")
rep("clearInput();state='playing';","clearInput();resetFlow();resetRig();resetLife();state='playing';")
rep('input.web=true;if(!attach())say(',"input.web=true;flow.air=.6;flow.manualRelease=0;if(!P.rope&&!attach())say(")
rep("if(e.code==='Space'){input.web=true;attach()}","if(e.code==='Space'){input.web=true;flow.air=.6;flow.manualRelease=0;attach()}")
rep("if(input.web&&!P.rope)attach();", "if(input.web&&!P.rope&&(settings.swingMode!=='FLOW'||flow.air>.16))attach();")
rep('<button id="quality">Graphics', '<button id="swingMode">Swing controls <span id="swingModeLabel">FLOW · ASSISTED</span></button><button id="quality">Graphics')
rep("function syncSettings(){", "function syncSettings(){$('swingModeLabel').textContent=settings.swingMode==='FLOW'?'FLOW · ASSISTED':'MANUAL';$('modeBadge').textContent=settings.swingMode==='FLOW'?'FLOW ASSIST':'MANUAL';")
rep("$('start').onclick=reset;","$('swingMode').onclick=()=>setSwingMode(settings.swingMode==='FLOW'?'MANUAL':'FLOW');$('start').onclick=reset;")
rep('<div class="readout">','<div id="modeBadge">FLOW ASSIST</div><div id="powerHint">↑ POWER SWING</div><div class="readout">')
rep('LEFT STICK / AIM','AIM + POWER') if 'LEFT STICK / AIM' in s else None
rep('<label>AIM NEXT WEB</label>','<label>AIM / ↑ POWER</label>') if '<label>AIM NEXT WEB</label>' in s else None
s=s.replace('Left thumb aims the next web.','Left thumb aims; push up to reel and build speed.')
s=s.replace('Left stick aims your next web. Hold WEB to catch; release to fly.','Hold WEB to chain swings. Aim left/right; push up for power.')
s=s.replace('Left / right picks a side. Up / down sets web height. ZIP pulls you up.','Left / right aims. Up powers the swing. ZIP gives a stronger pull.')
s=s.replace('Aim your next web with the left stick. Use ZIP to gain height, and release while rising.','Hold WEB for assisted chaining. Push up to gain speed and height. Manual controls are in Pause.')
s=s.replace("say('AIM YOUR NEXT SWING','LEFT STICK TO AIM · HOLD WEB TO CATCH')","say('FIND YOUR FLOW','HOLD WEB · AIM LEFT / RIGHT · PUSH UP FOR POWER')")
s=s.replace("$('webLabel').textContent=P.rope?'RELEASE':'WEB';","$('webLabel').textContent=settings.swingMode==='FLOW'&&input.web?'FLOW':P.rope?'RELEASE':'WEB';")
s=s.replace("$('webSub').textContent=rising?'RISING · LET GO':P.rope?'AIM THE NEXT WEB':target?'HOLD TO CATCH':'AIM WITH LEFT STICK';","$('webSub').textContent=settings.swingMode==='FLOW'&&input.web?(flow.boost>.15?'POWER SWING':'HOLD TO CHAIN'):rising?'RISING · LET GO':P.rope?'AIM THE NEXT WEB':target?'HOLD TO CATCH':'AIM WITH LEFT STICK';$('powerHint').style.opacity=P.rope&&flow.boost>.12?'1':'0';$('powerHint').textContent='↑ POWER SWING '+Math.round(flow.boost*100)+'%';$('pad').classList.toggle('powered',!!P.rope&&flow.boost>.12);")
s=s.replace("rising?'Release now. Let the arc carry you into the next swing.':P.rope?'Aim the next cyan target with the left stick. Release, then catch.'","settings.swingMode==='FLOW'&&input.web?'Keep WEB held. Left / right aims; push up to accelerate and climb.':rising?'Release now. Let the arc carry you into the next swing.':P.rope?'Aim the next cyan target. Push up to power through the arc.'")
s=s.replace('</style>',r'''#modeBadge{position:absolute;left:22px;top:calc(max(18px,env(safe-area-inset-top)) + 121px);font-size:7px;letter-spacing:1.3px;color:#8fe4ee;background:#0d29317d;border:1px solid #76d7e22a;padding:5px 7px;border-radius:3px}#powerHint{position:absolute;left:50%;bottom:calc(176px + var(--safe));transform:translateX(-50%);font-size:9px;letter-spacing:1.5px;color:#a8f1f5;opacity:0;transition:opacity .18s;white-space:nowrap;text-shadow:0 1px 8px #000}.pad.powered{border-color:#a9f2f6;background:radial-gradient(circle,#b1f6fa1a,#11203550);box-shadow:0 0 18px #84e5f329}.pad.powered .knob{background:#b5f0f950}#toast{top:25%}#toast b{font-size:22px}@media(max-height:520px){#modeBadge{top:111px;left:22px;font-size:6px;padding:4px 6px}#powerHint{bottom:60px;font-size:8px}}
</style>''')
a=s.index('<div class="lesson">');b=s.index('</div><button class="primary" id="start">',a)
s=s[:a]+'''<div class="lesson"><b>Hold WEB</b> to chain swings automatically.<br><b>Left / right</b> aims. <b>Push up</b> to build speed and climb.<br>Let go to fly. <b>TRICK</b> in the air; <b>ZIP</b> for a strong pull.<br>Prefer full control? Choose <b>Manual</b> in Pause.''' +s[b:]
s=s.replace('THUMB AIM / NEXT WEB','CITY FLOW / LIVING STREETS')
rep('function animatePhysics(dt,oldV){','function animatePhysics(dt,oldV){P.pose.prevUp=[...P.pose.up];')
rep('*(1-Math.exp(-dt*8));}', '*(1-Math.exp(-dt*8));updateRig(dt);}')
rep('character:characterTelemetry,constants:', 'character:characterTelemetry,flow,rig,life,setSwingMode,powerValue,constants:')
rep('get buildings(){return buildings}', 'get agents(){return{cars,walkers,cyclists}},get buildings(){return buildings}')
rep('render(){render(0,1)}','render(dt=0,alpha=1){render(dt,alpha)}')
pos=s.index('function animatePhysics(');s=s[:pos]+(r/'_flow_animation.js').read_text()+'\n'+s[pos:]
start=s.index(' const r=P.rope,flip=P.flip,pose=P.pose',s.index('function heroGeometry'))
end=s.index(' hero.profile(root,',start)
s=s[:start]+''' const r=P.rope,flip=P.flip,pose=P.pose,vY=P.v[1],dive=input.dive||keys.has('ShiftLeft')||keys.has('ShiftRight');
 drawRig=interpolatedRig(renderAlpha);const up=unit(lerp(pose.prevUp||pose.up,pose.up,renderAlpha)),root=rigRoot(drawP,up,drawRig.pitch,drawRig.bank,drawRig.spin,drawRig.twist);
'''+s[end:]
start=s.index('  const attached=r&&s===-r.side,aiming=',s.index('function heroGeometry'))
end=s.index('  const arm=ik(',start)
s=s[:start]+'''  const goals=limbGoals(s,root),attached=goals.attached,aiming=goals.aiming,shoulder=[s*.217,.411,0],desired=drawRig.arms[s>0?1:0];
'''+s[end:]
start=s.index('  const hip=[s*.104,-.23,0];let footTarget;',s.index('function heroGeometry'))
end=s.index('  const leg=ik(',start)
s=s[:start]+'''  const hip=[s*.104,-.23,0],footTarget=drawRig.feet[s>0?1:0];
'''+s[end:]
rep("let curled=mode==='grip'||mode==='shoot'&&(i===1||i===2),curl=curled?1:mode==='relaxed'?.36:.08;","let curl=drawRig.curves[side>0?1:0][i];")
rep('let Z=unit(cross(X,Y));\n const m=mm(root,basis(wrist,X,Y,Z))','X=unit(sub(drawRig.handX[side>0?1:0],mul(Y,dot(drawRig.handX[side>0?1:0],Y))));let Z=unit(cross(X,Y));\n const m=mm(root,basis(wrist,X,Y,Z))')
start=s.index(" const thumb=mode==='grip'?");end=s.index('\n hero.tube(m,thumb',start)
s=s[:start]+''' const tucked=[[side*-.047,.035,.012],[side*-.074,.066,.036],[side*-.049,.104,.048],[side*-.018,.112,.050]],open=[[side*-.045,.033,.009],[side*-.077,.057,.012],[side*-.097,.083,.016],[side*-.104,.112,.026]];
 const thumb=open.map((v,j)=>lerp(v,tucked[j],drawRig.curves[side>0?1:0][4]));'''+s[end:]
rep("function render(dt,alpha=1){drawP=", "function render(dt,alpha=1){renderAlpha=clamp(alpha,0,1);drawP=")
rep('P.pose={lean:0,leanV:0,lag:0,lagV:0,up:[0,1,0]};','P.pose={lean:0,leanV:0,lag:0,lagV:0,up:[0,1,0],prevUp:[0,1,0]};')
rep("cameraYaw+=clamp(angleDelta(cameraYaw,yawTarget),-.8,.8)*(1-Math.exp(-dt*2.5))", "cameraYaw+=clamp(angleDelta(cameraYaw,yawTarget),-1.2,1.2)*(1-Math.exp(-dt*4.2))")
rep('function populate(){','function basePopulate(){')
start=s.index('function agents(dt)');end=s.index('function agentGeometry()',start)
s=s[:start]+(r/'_flow_city.js').read_text()+'\n'+s[end:]
rep(' return{ix,iz,family,bs,decos};',' cityDecor({ix,iz,family},box);return{ix,iz,family,bs,decos};')
start=s.index(' for(let w of walkers){let x=',s.index('function agentGeometry'))
end=s.index('\n for(let b of blocks.values())',start)
s=s[:start]+' for(const w of walkers)pedestrianGeometry(w,clamp(life.acc*30,0,1));'+s[end:]
start=s.index('for(let c of cars){let x=',s.index('function agentGeometry'))
end=s.index(',put=(p,s,col,k=0)',start)
s=s[:start]+'''for(let c of cars){let cp=lerp(c.from,c.to,clamp(life.acc*30,0,1)),x=cp[0],z=cp[2];if(Math.hypot(x-drawP[0],z-drawP[2])>220)continue;let yaw=c.prevYaw+angleDelta(c.prevYaw,c.yaw)*clamp(life.acc*30,0,1),m=transform([x,0,z],[1,1,1],[0,yaw,0])'''+s[end:]
rep('}props.upload();foliage.upload();}', '}cityLifeGeometry();props.upload();foliage.upload();}')
rep('for(let c of cars){c.street-=', "for(let c of cars){c.from=sub(c.from,shift);c.to=sub(c.to,shift);if(c.turn){for(const k of['a','b','c','d','p'])c.turn[k]=sub(c.turn[k],shift);c.turn.street-=shift[c.turn.axis===2?0:2]}c.street-=")
rep("blocks.clear();centerKey='';ensureCity(true);target=null;}","for(let b of cyclists){b.street-=shift[b.axis===2?0:2];b.pos-=shift[b.axis];if(b.prevPos!==undefined)b.prevPos-=shift[b.axis]}blocks.clear();centerKey='';ensureCity(true);target=null;}")
rep('w.pos-=shift[w.axis]}','w.pos-=shift[w.axis];w.prevPos-=shift[w.axis]}')
rep('vec3(.46,.52,.60)','vec3(.36,.43,.54)')
rep('length(vPos-uEye)/365.','length(vPos-uEye)/435.')
rep('fog=[mix(.039,.64,day),mix(.067,.62,day),mix(.125,.57,day)]','fog=[mix(.027,.57,day),mix(.05,.65,day),mix(.10,.76,day)]')
rep('pedestrians:walkers.length,instances:', 'pedestrians:walkers.length,cyclists:cyclists.length,turns:life.turns,busStops:life.busStops,reactions:life.reactions,instances:')
s=s.replace("function forward(){let h=", "function forward(){if(settings.swingMode==='FLOW'&&input.web&&Math.abs(steerValue())<.18)return flow.axis===0?[flow.sign,0,0]:[0,0,flow.sign];let h=")
s=s.replace('const flow={air:', 'const flow={axis:2,sign:1,turnIntent:0,air:')
s=s.replace('Object.assign(flow,{air:', 'Object.assign(flow,{axis:2,sign:1,turnIntent:0,air:')
s=s.replace("if(state!=='playing'||!input.web||settings.swingMode!=='FLOW')return;", "if(state!=='playing'||!input.web||settings.swingMode!=='FLOW')return;\n if(Math.abs(steerValue())>.28){flow.turnIntent+=dt;if(flow.turnIntent>.20){flow.axis=Math.abs(P.v[0])>Math.abs(P.v[2])?0:2;flow.sign=Math.sign(P.v[flow.axis])||1;}}else flow.turnIntent=0;")
s=s.replace("settings.swingMode==='FLOW'?55:46","settings.swingMode==='FLOW'?67:46").replace("const ready=r.age>.55&&P.v[1]>5&&horizontal>18&&along<24;","const ready=r.age>.55&&P.v[1]>(P.p[1]<34?10:5+powerValue()*5)&&horizontal>18&&along<24;")
s=s.replace('if(Math.abs(offset)<ROAD*.55)','if(Math.abs(offset)<TILE*.35)').replace('clamp(-offset*1.8-P.v[axis]*1.6,-24,24)','clamp(-offset*3.0-P.v[axis]*2.4,-60,60)')
rep('uniform mat4 uVP,uShadow;out vec3','uniform mat4 uVP,uShadow;uniform float uTime;out vec3')
rep('vec4 p=iM*vec4(aPos,1.);vPos=', 'vec4 p=iM*vec4(aPos,1.);if(iData.x>9.5&&iData.x<10.5){p.x+=sin(uTime*1.8+iM[3].z*.07)*(.5+aPos.y)*.16;p.z+=cos(uTime*1.3+iM[3].x*.1)*(.5+aPos.y)*.11;}vPos=')
rep('float k=vData.x,spec=.03;','float k=vData.x,spec=.03;\nif(k>11.5&&k<12.5){vec2 p=(vUV-.5)*2.;float r=dot(p,p);float alpha=exp(-r*3.5)*smoothstep(1.,.3,r)*vData.y;if(alpha<.003)discard;vec3 tint=vCol.rgb;tint=tint/(tint+vec3(.58));color=vec4(pow(tint,vec3(.9)),alpha);return;}')
rep('foliage.box(p,[3.3,4.8,3.3],[.17,.28,.16])','foliage.box(p,[3.3,4.8,3.3],[.17,.28,.16],10)')
rep('foliage.box(add(p,[.6,1,.3]),[2.9,3.8,3.1],[.23,.34,.19])','foliage.box(add(p,[.6,1,.3]),[2.9,3.8,3.1],[.23,.34,.19],10)')
pos=s.index('function render(dt,alpha=1)');s=s[:pos]+(r/'_flow_atmosphere.js').read_text()+'\n'+s[pos:]
rep('heroGeometry();agentGeometry();','heroGeometry();agentGeometry();atmosphereGeometry(vr,vu);')
rep('eyes.draw();webs.draw();overlay(dt);','eyes.draw();webs.draw();gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);mist.draw();gl.depthMask(true);gl.disable(gl.BLEND);overlay(dt);')
rep('let audio=null,master=null,windGain=null,windFilter=null;','let audio=null,master=null,windGain=null,windFilter=null,trafficGain=null,siren=null,sirenGain=null,sirenPan=null;')
rep('windGain.connect(master);n.start()', "windGain.connect(master);const trafficFilter=audio.createBiquadFilter();trafficFilter.type='lowpass';trafficFilter.frequency.value=180;trafficGain=audio.createGain();trafficGain.gain.value=0;n.connect(trafficFilter);trafficFilter.connect(trafficGain);trafficGain.connect(master);siren=audio.createOscillator();siren.type='sine';sirenGain=audio.createGain();sirenGain.gain.value=0;siren.connect(sirenGain);if(audio.createStereoPanner){sirenPan=audio.createStereoPanner();sirenGain.connect(sirenPan);sirenPan.connect(master)}else sirenGain.connect(master);siren.start();n.start()")
rep("if(!fatal&&!manual){if(state==='playing')","if(!fatal&&!manual){audioScene(dt);if(state==='playing')")
rep('if(windGain&&audio)windGain.gain.setTargetAtTime(0,audio.currentTime,.08)', 'if(windGain&&audio)windGain.gain.setTargetAtTime(0,audio.currentTime,.08);audioScene(0)')
rep("function doTrick(){if(state!=='playing'||P.rope||P.flip)return;","function doTrick(){if(state!=='playing'||P.flip)return;if(P.rope){flow.trickQueued=3;say('TRICK QUEUED','RELEASE INTO THE NEXT AIR GAP');return;}")
rep('const flow={axis:', 'const flow={trickQueued:0,axis:')
rep('Object.assign(flow,{axis:', 'Object.assign(flow,{trickQueued:0,axis:')
rep("if(P.rope)flow.air=0;else flow.air+=dt;", "if(P.rope)flow.air=0;else flow.air+=dt;flow.trickQueued=Math.max(0,flow.trickQueued-dt);if(!P.rope&&flow.air>.04&&flow.trickQueued>0&&P.p[1]>18){flow.trickQueued=0;doTrick();}")
rep('if(flow.air>.16&&(fallSoon||flow.air>.58)&&flow.manualRelease<=0)', 'if(flow.air>.16&&(fallSoon||flow.air>.58)&&(!P.flip||P.p[1]<17)&&flow.manualRelease<=0)')
rep("$('trick').disabled=!!P.rope||!!P.flip;", "$('trick').disabled=!!P.flip;$('trick').textContent=flow.trickQueued>0?'↻ QUEUED':'↻ TRICK';")
rep('webs.overflows,glError:', 'webs.overflows+mist.overflows,glError:')
s=s.replace('The left stick chooses the NEXT facade attachment. It never moves a live rope.','The left stick chooses the NEXT facade attachment. Up also powers the live reel, without moving its anchor.')
s=s.replace('Left stick aims the next web. Up and down choose attachment height; left and right choose the building side.','Left and right aim the next web. Push up to choose a higher anchor and power the current swing.')
s=s.replace('Thumb Aim','City Flow').replace('THUMB AIM','CITY FLOW')
s=s.replace('<label>AIM NEXT</label>','<label>AIM / ↑ POWER</label>')
s=s.replace('<label>AIM NEXT WEB</label>','<label>AIM / ↑ POWER</label>')
s=s.replace('smoothstep(1.,.3,r)','(1.-smoothstep(.3,1.,r))')
p.write_text(s)
print('Built City Flow',blob(p.read_bytes()))
