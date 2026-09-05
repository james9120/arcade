// Travel controls are not a targeting cursor. Intent follows the moving character,
// with a short prediction of commanded acceleration, never a left/right anchor lock.
const navigation={turn:0,refresh:0,lastAnchor:null,lastRelease:-10,candidates:0,predictions:0,switches:0};
const tapControl={id:null,down:null,feedback:null,shots:0,rejected:0};
const wallControl={cooldown:0,runs:0,exits:0,elapsed:0};
function resetTraversal(){
 Object.assign(navigation,{turn:0,refresh:0,lastAnchor:null,lastRelease:-10,candidates:0,predictions:0,switches:0});
 Object.assign(tapControl,{id:null,down:null,feedback:null,shots:0,rejected:0});
 Object.assign(wallControl,{cooldown:0,runs:0,exits:0,elapsed:0});P.wall=null;
}
function aimIntent(){
 const f=forward(),right=cross(f,[0,1,0]);
 // A thumb move steers the body first, instead of snapping the next web across the screen.
 const h=unit([P.v[0],0,P.v[2]]),base=len(h)>.5&&dot(h,f)>.25?unit(lerp(f,h,.65)):f;
 const dir=unit(add(base,mul(right,navigation.turn*.28)));
 return{x:0,y:0,active:false,f,right,dir};
}
function surfaceAnchorValid(a,range=106){
 if(!a||!a.b||!a.p.every(Number.isFinite)||!buildings.includes(a.b))return false;
 const b=a.b,p=a.p,d=len(sub(p,P.p));
 if(d<7||d>range||p[1]<6||p[1]>(b.h+.12)||p[1]<(b.base||0)-.12)return false;
 const ex=Math.abs(p[0]-b.x)-b.w/2,ez=Math.abs(p[2]-b.z)-b.d/2;
 const onWall=(Math.abs(ex)<.12&&ez<.12)||(Math.abs(ez)<.12&&ex<.12);
 const onRoof=Math.abs(p[1]-b.h)<.12&&ex<.12&&ez<.12;
 return (onWall||onRoof)&&visibleAnchor(p,b);
}
function anchorScore(a,intent){
 if(!a||!buildings.includes(a.b))return Infinity;
 const d=sub(a.p,P.p),dist=len(d),along=dot(d,intent.dir),side=dot(d,intent.right),speed=Math.hypot(P.v[0],P.v[2]);
 if(dist>104||dist<13||d[1]<10||along<Math.max(4,speed*.13))return Infinity;
 const front=dot(unit([d[0],0,d[2]]),intent.dir);
 if(front<.40||P.rope&&len(sub(a.p,P.rope.a))<10)return Infinity;
 const reach=clamp(speed*.70,21,39),lift=clamp(24+speed*.17+Math.max(0,-P.v[1])*.34,29,49);
 let score=(1-front)*38+Math.abs(along-reach)*.5+Math.abs(d[1]-lift)*.48+Math.abs(side)*.09;
 const bottom=a.p[1]-dist;if(bottom<7)return Infinity;
 score+=Math.max(0,12-bottom)*3.5;
 if(navigation.lastAnchor&&len(sub(a.p,navigation.lastAnchor))<14)score+=15;
 return score;
}
function predictAnchor(a,intent){
 let p=[...P.p],v=[...P.v],L=len(sub(a.p,p)),minY=p[1],clearance=Infinity;
 const nearby=buildings.filter(b=>Math.hypot(b.x-p[0],b.z-p[2])<110),dt=.075;
 // 0.9 seconds of look-ahead ranks candidates. Real motion/collisions remain at 120 Hz.
 for(let i=0;i<12;i++){
  v[1]-=G*dt;let old=p;p=add(p,mul(v,dt));
  if(input.web)L=Math.max(12,L-clamp((60-p[1])/25,0,1)*5*dt);
  let d=sub(p,a.p),dist=len(d);if(dist>L){let n=mul(d,1/dist);p=add(a.p,mul(n,L));let radial=dot(v,n);if(radial>0)v=sub(v,mul(n,radial));}
  minY=Math.min(minY,p[1]);if(p[1]<RADIUS+2)return 10000;
  const delta=sub(p,old),travel=len(delta);if(travel>.001)for(const b of nearby){
   const hit=rayBox(old,mul(delta,1/travel),b,travel,.65);if(hit&&hit.t>1e-4)return 10000;
   if(p[1]<(b.base||0)||p[1]>b.h+1)continue;
   clearance=Math.min(clearance,Math.hypot(Math.max(0,Math.abs(p[0]-b.x)-b.w/2),Math.max(0,Math.abs(p[2]-b.z)-b.d/2)));
  }
 }
 navigation.predictions++;
 const progress=dot(sub(p,P.p),intent.dir),lateral=Math.abs(dot(sub(p,P.p),intent.right));
 return Math.max(0,10-minY)*5+Math.max(0,3.5-clearance)*4+Math.max(0,16-progress)*1.3+lateral*.12;
}
function chooseAnchor(){
 const intent=aimIntent(),speed=Math.hypot(P.v[0],P.v[2]),reach=clamp(speed*.70,21,39),lift=clamp(24+speed*.17+Math.max(0,-P.v[1])*.34,29,49),candidates=[];
 for(const b of buildings){
  if(b.h<P.p[1]+10||Math.hypot(b.x-P.p[0],b.z-P.p[2])>118)continue;
  for(const ahead of[.85,1.2]){
   const aim=add(P.p,mul(intent.dir,reach*ahead));let x=clamp(aim[0],b.x-b.w/2,b.x+b.w/2),z=clamp(aim[2],b.z-b.d/2,b.z+b.d/2);
   if(P.p[0]<b.x-b.w/2)x=b.x-b.w/2-.04;else if(P.p[0]>b.x+b.w/2)x=b.x+b.w/2+.04;else z=P.p[2]<b.z?b.z-b.d/2-.04:b.z+b.d/2+.04;
   const y=clamp(P.p[1]+lift,(b.base||0)+.2,b.h-.2),p=[x,y,z],a={p,b,side:Math.sign(dot(sub(p,P.p),intent.right))||1,bottom:y-len(sub(p,P.p)),x:0,y:0};
   a.score=anchorScore(a,intent);if(Number.isFinite(a.score))candidates.push(a);
  }
 }
 if(target&&buildings.includes(target.b)){const score=anchorScore(target,intent)-5;if(Number.isFinite(score))candidates.push({...target,score,retained:true});}
 candidates.sort((a,b)=>a.score-b.score);navigation.candidates=candidates.length;
 let best=null;for(const a of candidates.slice(0,10)){
  if(!visibleAnchor(a.p,a.b))continue;
  const risk=predictAnchor(a,intent);if(risk>=10000)continue;
  a.score+=risk;if(!best||a.score<best.score)best=a;
 }
 return best;
}
function refreshTarget(){
 const next=chooseAnchor();if(target&&next&&len(sub(target.p,next.p))>2)navigation.switches++;
 target=next;aimControl.refresh=1/10;return target;
}
function targetForCatch(){
 if(target&&Number.isFinite(anchorScore(target,aimIntent()))&&surfaceAnchorValid(target)&&predictAnchor(target,aimIntent())<10000)return target;
 return refreshTarget();
}
// Use the exact last-rendered camera and CSS pixels, not the adaptive drawing-buffer size.
const viewRay={eye:[0,0,0],f:[0,0,1],r:[-1,0,0],u:[0,1,0],tan:1,aspect:1,ready:false};
function pickScreen(clientX,clientY){
 const rect=canvas.getBoundingClientRect();if(!viewRay.ready||rect.width<=0||rect.height<=0)return null;
 const x=(clientX-rect.left)/rect.width*2-1,y=1-(clientY-rect.top)/rect.height*2;
 if(Math.abs(x)>1||Math.abs(y)>1)return null;
 const ray=unit(add(viewRay.f,add(mul(viewRay.r,x*viewRay.tan*viewRay.aspect),mul(viewRay.u,y*viewRay.tan))));
 let nearest=null;
 for(const b of buildings){const hit=rayBox(viewRay.eye,ray,b,1000);if(hit&&hit.t>.10&&len(hit.n)>.5&&(!nearest||hit.t<nearest.t))nearest={...hit,b};}
 if(!nearest)return null;
 const p=add(add(viewRay.eye,mul(ray,nearest.t)),mul(nearest.n,.04)),b=nearest.b;
 return{p,b,n:nearest.n,side:Math.sign(dot(sub(p,P.p),cross(forward(),[0,1,0])))||1,source:'tap'};
}
function fireTap(a,clientX,clientY){
 if(state!=='playing')return false;
 if(!surfaceAnchorValid(a,135)){
  tapControl.rejected++;tapControl.feedback={x:clientX,y:clientY,age:0,ok:false};
  say('OUT OF REACH','TAP A NEARBY BUILDING');return false;
 }
 // Validate before releasing anything. An invalid tap cannot drop a live rope.
 P.rope=null;if(P.wall)exitWall('tap',false);flow.trickQueued=0;
 const ok=attach(a,'tap');if(ok){tapControl.shots++;tapControl.feedback={p:[...a.p],x:clientX,y:clientY,age:0,ok:true};flow.air=0;}
 return ok;
}
function setupSceneTaps(){
 canvas.addEventListener('pointerdown',e=>{
  if(state!=='playing'||tapControl.id!==null||e.pointerType==='mouse'&&e.button!==0)return;
  tapControl.id=e.pointerId;tapControl.down={x:e.clientX,y:e.clientY,time:performance.now(),a:pickScreen(e.clientX,e.clientY),moved:false};capture(canvas,e);
 });
 canvas.addEventListener('pointermove',e=>{if(e.pointerId===tapControl.id&&tapControl.down&&Math.hypot(e.clientX-tapControl.down.x,e.clientY-tapControl.down.y)>14)tapControl.down.moved=true;});
 canvas.addEventListener('pointerup',e=>{
  if(e.pointerId!==tapControl.id)return;const d=tapControl.down;tapControl.id=null;tapControl.down=null;
  if(d&&!d.moved&&performance.now()-d.time<500)fireTap(d.a,d.x,d.y);
 });
 const cancel=e=>{if(e.pointerId===tapControl.id){tapControl.id=null;tapControl.down=null;}};
 canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);
}
function cancelSceneTap(){
 const id=tapControl.id;tapControl.id=null;tapControl.down=null;
 if(id!==null)try{canvas.releasePointerCapture(id)}catch(e){}
}
function nearestRunningWall(p=P.p){
 if(wallControl.cooldown>0||p[1]<RADIUS+2.5||input.dive)return null;
 let best=null;
 for(const b of buildings){
  if(p[1]<(b.base||0)+1.2||p[1]>b.h-.55)continue;
  for(const axis of[0,2])for(const sign of[-1,1]){
   const along=axis===0?2:0,center=axis===0?b.x:b.z,half=(axis===0?b.w:b.d)/2;
   const face=center+sign*half,gap=(p[axis]-face)*sign,otherCenter=along===0?b.x:b.z,otherHalf=(along===0?b.w:b.d)/2;
   if(gap<.39||gap>1.05||Math.abs(p[along]-otherCenter)>otherHalf-.65)continue;
   const n=[0,0,0];n[axis]=sign;const normalSpeed=dot(P.v,n),tangentSpeed=Math.abs(P.v[along]);
   if(tangentSpeed<13||normalSpeed>2||-normalSpeed>Math.min(24,tangentSpeed*.8)||energy<9)continue;
   if(steerValue()*dot(cross(forward(),[0,1,0]),n)>.35)continue;
   if(!best||gap<best.gap)best={b:{...b},axis,along,sign,n,face,gap,direction:Math.sign(P.v[along])||1};
  }
 }
 return best;
}
function enterWall(w){
 if(!w||P.wall)return false;
 P.wall={...w,age:0,phase:0,travel:0};P.rope=null;P.flip=null;flow.air=0;target=null;
 wallControl.runs++;aimControl.refresh=0;say('WALL RUN','PUSH UP TO CLIMB · STEER OUT OR TAP TO LEAVE');haptic(9);return true;
}
function exitWall(reason='edge',jump=false){
 const w=P.wall;if(!w)return;
 P.wall=null;wallControl.cooldown=.75;wallControl.exits++;flow.air=.16;targetTimer=0;aimControl.refresh=0;
 if(jump){P.v=add(P.v,mul(w.n,5));P.v[1]+=3.5;tone(180,480,.11,.035);}
}
function wallForce(dt){
 const w=P.wall;if(!w)return null;
 w.age+=dt;wallControl.elapsed+=dt;w.phase+=dt*clamp(10+Math.abs(P.v[w.along])*.12,11,17);
 const center=w.along===0?w.b.x:w.b.z,half=(w.along===0?w.b.w:w.b.d)/2;
 const away=steerValue()*dot(cross(forward(),[0,1,0]),w.n),gap=(P.p[w.axis]-w.face)*w.sign;
 if(away>.32&&w.age>.12){exitWall('steer',true);return null;}
 if(w.age>2.3||energy<4||P.p[1]<RADIUS+1.5||P.p[1]>w.b.h-.35||P.p[1]<(w.b.base||0)+1||Math.abs(P.p[w.along]-center)>half-.20||gap>1.8||input.dive){exitWall('edge',false);return null;}
 energy=Math.max(0,energy-dt*15);const power=powerValue(),f=[0,0,0];
 f[w.axis]=(clamp((.84-gap)*90-dot(P.v,w.n)*15,-70,70))*w.sign;
 f[w.along]=w.direction*clamp((35+power*12-Math.abs(P.v[w.along]))*2,-14,14);
 f[1]=clamp((power*8-1.5-w.age*1.8-P.v[1])*5,-G,30);
 return f;
}
function drawAimPreview(){
 $('aimTarget').hidden=true;
 const m=tapControl.feedback;if(!m||m.age>.9)return;
 const p=m.p&&project(m.p),x=p?p[0]:m.x,y=p?p[1]:m.y;if(x===undefined||y===undefined)return;
 ctx.save();ctx.globalAlpha=clamp(1-m.age/.9,0,1);ctx.strokeStyle=m.ok?'#d4f6ff':'#ff927f';ctx.lineWidth=1.4;
 ctx.beginPath();ctx.arc(x,y,11+m.age*15,0,TAU);ctx.stroke();
 if(m.ok){ctx.beginPath();ctx.moveTo(x-4,y);ctx.lineTo(x+4,y);ctx.moveTo(x,y-4);ctx.lineTo(x,y+4);ctx.stroke();}ctx.restore();
}
