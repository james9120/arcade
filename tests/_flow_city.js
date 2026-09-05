// Bounded living-city simulation. Traffic and pedestrians run at 30Hz; their poses
// interpolate at render rate. No background timers, network assets or unbounded spawns.
const life={acc:0,turns:0,busStops:0,reactions:0,waiters:0,ticks:0,hornAt:0,ambient:0};
let cyclists=[];
function resetLife(){Object.assign(life,{acc:0,turns:0,busStops:0,reactions:0,waiters:0,ticks:0,hornAt:0,ambient:0});cyclists=[];}
function carPoint(c){return c.turn?c.turn.p:[c.axis===2?c.street+c.lane:c.pos,0,c.axis===2?c.pos:c.street+c.lane];}
function axisDirection(axis,sign){return axis===2?[0,0,sign]:[sign,0,0];}
function cubic(p0,p1,p2,p3,t){let u=1-t;return add(add(mul(p0,u*u*u),mul(p1,3*u*u*t)),add(mul(p2,3*u*t*t),mul(p3,t*t*t)));}
function populate(){
 basePopulate();const r=rng(seed+931);
 for(let i=72;i<84;i++){const c=cars[i-72];cars.push({...c,pos:c.pos+37+i*.7,seed:r(),speed:9,want:11});}
 for(let i=120;i<156;i++){const w=walkers[i-120];walkers.push({...w,pos:w.pos+9+i*.25,offset:.6+r()*2.2,phase:r()*TAU});}
 cars.forEach((c,i)=>{
  c.id=i;c.lane=(c.axis===2?-c.sign:c.sign)*Math.abs(c.lane);c.type=i%23===0?'ambulance':c.bus?'bus':i%11===0?'delivery':c.col[0]>.9?'taxi':'car';
  if(c.type==='ambulance')c.col=[.80,.81,.77];if(c.type==='delivery')c.col=[.29,.35,.37];
  c.turn=null;c.turnDecision=null;c.hold=0;c.stopKey=null;c.yaw=Math.atan2(c.axis===0?c.sign:0,c.axis===2?c.sign:0);c.prevYaw=c.yaw;
  c.from=c.to=[...carPoint(c)];c.stationary=0;
 });
 walkers.forEach((w,i)=>{w.id=i;w.react=0;w.reactCool=0;w.move=1;w.type=i%13===0?'phone':i%11===0?'runner':i%9===0?'bag':'walk';if(w.type==='runner')w.speed*=1.6;w.prevPos=w.pos;w.prevPhase=w.phase;});
 for(let i=0;i<10;i++){const axis=i%2?2:0,sign=i%3?1:-1;cyclists.push({id:i,axis,sign,street:Math.round(P.p[axis===2?0:2]/TILE)*TILE+(i%3-1)*TILE,pos:P.p[axis]-190+r()*460,speed:4.5+r()*2.4,phase:r()*TAU,col:i%2?[.64,.39,.15]:[.16,.39,.48]});}
}
function agents(dt){
 if(state==='paused'||state==='dead')return;
 life.acc+=dt;
 while(life.acc>=1/30-1e-10){life.acc-=1/30;cityStep(1/30);}
}
function cityStep(dt){
 life.ticks++;life.waiters=0;
 const lanes=new Map(),occupied=new Map();
 for(const c of cars){
  c.from=[...carPoint(c)];c.prevYaw=c.yaw;
  if(!c.turn){const key=c.axis+','+c.street+','+c.lane;if(!lanes.has(key))lanes.set(key,[]);lanes.get(key).push(c);}
  const p=carPoint(c),ix=Math.round(p[0]/TILE),iz=Math.round(p[2]/TILE);
  if(Math.abs(p[0]-ix*TILE)<21&&Math.abs(p[2]-iz*TILE)<21){const k=ix+','+iz;if(!occupied.has(k))occupied.set(k,new Set());occupied.get(k).add(c.turn?'turn':c.axis);}
 }
 const leaders=new Map();for(const list of lanes.values()){list.sort((a,b)=>a.pos*a.sign-b.pos*b.sign);for(let i=0;i<list.length-1;i++)leaders.set(list[i].id,list[i+1]);}
 for(const c of cars){
  if(c.turn){
   const t=c.turn;t.t=Math.min(1,t.t+dt/t.duration);t.p=cubic(t.a,t.b,t.c,t.d,t.t);
   const ahead=cubic(t.a,t.b,t.c,t.d,Math.min(1,t.t+.015)),delta=sub(ahead,t.p);
   if(len(delta)>.001)c.yaw=Math.atan2(delta[0],delta[2]);
   if(t.t>=1){c.axis=t.axis;c.sign=t.sign;c.street=t.street;c.pos=t.d[c.axis];c.lane=t.lane;c.yaw=Math.atan2(c.axis===0?c.sign:0,c.axis===2?c.sign:0);c.turn=null;life.turns++;}
  }else{
   const u=c.pos*c.sign,junction=(Math.floor((u+19)/TILE)+1)*TILE,stop=junction-22,gap=stop-u;
   const cx=c.axis===2?c.street:c.sign*junction,cz=c.axis===2?c.sign*junction:c.street,k=Math.round(cx/TILE)+','+Math.round(cz/TILE);
   const occup=occupied.get(k),blocked=occup&&(occup.has(c.axis===2?0:2)||occup.has('turn'));
   const green=signal(c.street,c.sign*junction,c.axis)&&!blocked;
   let desired=c.want;
   if(!green&&gap>=-.5&&gap<45)desired=Math.min(desired,Math.sqrt(Math.max(0,2*3.8*(gap-.5))));
   const lead=leaders.get(c.id);if(lead){const g=(lead.pos-c.pos)*c.sign,spacing=lead.bus||c.bus?12:6.5;desired=Math.min(desired,Math.max(0,g-spacing)*.9);}
   const globalBlock=Math.floor((c.pos+(c.axis===2?origin[1]:origin[0])*TILE)*c.sign/TILE),local=mod(u,TILE);
   if(c.type==='bus'&&c.stopKey!==globalBlock&&local>78&&local<88){c.stopKey=globalBlock;c.hold=2.4;life.busStops++;}
   if(c.hold>0){c.hold-=dt;desired=0;}
   c.speed+=clamp(desired-c.speed,-8*dt,2.5*dt);
   c.stationary=c.speed<.5?c.stationary+dt:0;
   if(green&&gap>=-.6&&gap<c.speed*dt+.05&&hash(c.id*127+globalBlock*17)>.69){
    const f=axisDirection(c.axis,c.sign),nf=cross(f,[0,1,0]),axis=c.axis===2?0:2,sign=nf[axis],lane=(axis===2?-sign:sign)*Math.abs(c.lane),center=[cx,0,cz];
    const a=[...carPoint(c)],d=add(add(center,mul(nf,22)),mul(cross(nf,[0,1,0]),Math.abs(lane))),b=add(a,mul(f,13)),cc=sub(d,mul(nf,13));
    c.turn={a,b,c:cc,d,p:a,t:0,axis,sign,lane,street:center[axis===2?0:2],duration:Math.max(1.3,len(sub(d,a))*1.18/Math.max(7,c.speed))};
   }else c.pos+=c.speed*c.sign*dt;
  }
  let p=carPoint(c);
  if(Math.hypot(p[0]-P.p[0],p[2]-P.p[2])>460){
   c.turn=null;c.pos=P.p[c.axis]+(c.sign>0?-310:310);c.street=Math.round(P.p[c.axis===2?0:2]/TILE)*TILE+(Math.floor(c.seed*5)-2)*TILE;c.from=[...carPoint(c)];c.yaw=Math.atan2(c.axis===0?c.sign:0,c.axis===2?c.sign:0);c.prevYaw=c.yaw;
  }
  c.to=[...carPoint(c)];
 }
 for(const w of walkers){
  w.prevPos=w.pos;w.prevPhase=w.phase;w.reactCool=Math.max(0,w.reactCool-dt);w.react=Math.max(0,w.react-dt);
  const sign=Math.sign(w.speed),u=w.pos*sign,junction=(Math.floor((u+19)/TILE)+1)*TILE,gap=junction-21-u,green=signal(w.street,sign*junction,w.axis);
  let moving=!(gap>=-.1&&gap<.75&&!green);
  if(w.type==='phone'&&mod(simTime+w.id*.93,23)<3&&Math.abs(mod(w.pos+72,TILE)-72)>26)moving=false;
  const px=w.axis===2?w.street+w.side*(18.4+w.offset):w.pos,pz=w.axis===2?w.pos:w.street+w.side*(18.4+w.offset);
  if(P.p[1]<30&&Math.hypot(px-P.p[0],pz-P.p[2])<20&&w.reactCool<=0){w.react=1.7;w.reactCool=9;life.reactions++;}
  if(moving){w.pos+=w.speed*dt;w.phase+=dt*Math.abs(w.speed)*4.5;}else life.waiters++;
  w.move=mix(w.move,moving?1:0,1-Math.exp(-dt*10));
  if(Math.abs(w.pos-P.p[w.axis])>340||Math.abs(w.street-P.p[w.axis===2?0:2])>350){w.pos=P.p[w.axis]+(w.speed>0?-285:285);w.street=Math.round(P.p[w.axis===2?0:2]/TILE)*TILE+(Math.floor(w.offset*1.6)-2)*TILE;w.prevPos=w.pos;}
 }
 for(const b of cyclists){
  b.prevPos=b.pos;const u=b.pos*b.sign,j=(Math.floor((u+19)/TILE)+1)*TILE,gap=j-21-u,green=signal(b.street,j*b.sign,b.axis);
  if(!(gap>=-.1&&gap<1&&!green)){b.pos+=b.speed*b.sign*dt;b.phase+=dt*b.speed;}
  if(Math.abs(b.pos-P.p[b.axis])>320){b.pos=P.p[b.axis]-b.sign*285;b.street=Math.round(P.p[b.axis===2?0:2]/TILE)*TILE;b.prevPos=b.pos;}
 }
}
function cityDecor(block,box){
 const x=block.ix*TILE,z=block.iz*TILE,f=block.family;
 // Curbside kiosks, cafe seating, subway mouths and construction bays give each block a role.
 if(f===0||f===3){
  box([x+21.5,1.0,z+61],[1.7,1.6,3.1],[.58,.60,.57]);box([x+21.5,2.15,z+61],[2.4,.2,3.8],[.70,.16,.12]);
  box([x+21.5,2.75,z+61],[.1,1.1,.1],[.5,.5,.48]);box([x+21.5,3.12,z+61],[3.7,.13,4.4],[.92,.64,.18]);
  box([x+20.5,1.55,z+61],[.08,.8,2.7],[1,1,1],6,0,7);
 }
 if(f===1){
  for(let k=0;k<3;k++){let p=[x+23,0,z+54+k*7];box(add(p,[0,.85,0]),[1.6,.13,1.6],[.33,.22,.14]);box(add(p,[0,.4,0]),[.14,.8,.14],[.2,.23,.22]);for(let s of[-1,1]){box(add(p,[0,.43,s*1.1]),[.8,.13,.7],[.30,.35,.32]);box(add(p,[0,.8,s*1.4]),[.8,.65,.12],[.30,.35,.32]);}}
 }
 if(f===2){
  box([x+21.8,.26,z+47],[3.7,.05,7],[.065,.08,.08]);for(let side of[-1,1]){box([x+21.8+side*1.9,.9,z+47],[.12,1.5,7.3],[.13,.27,.20]);box([x+21.8+side*1.9,1.7,z+44],[.18,3.3,.18],[.11,.27,.18]);box([x+21.8+side*1.9,3.35,z+44],[.53,.53,.53],[.54,.80,.40],4);}
  box([x+21.8,2.65,z+44],[3.7,.9,.16],[1,1,1],6,0,8);
 }
 if(f===4){for(let k=0;k<7;k++){box([x+23,.34,z+91+k*2.1],[.45,.65,.45],[.83,.32,.10]);box([x+23,.45,z+91+k*2.1],[.47,.12,.47],[.9,.85,.73]);}for(let k=0;k<3;k++){box([x+25,1,z+95+k*3.4],[1,1.5,2.7],[.71,.52,.18]);}}
}
function pedestrianGeometry(w,t){
 const along=mix(w.prevPos??w.pos,w.pos,t),x=w.axis===2?w.street+w.side*(18.4+w.offset):along,z=w.axis===2?along:w.street+w.side*(18.4+w.offset);
 if(Math.hypot(x-drawP[0],z-drawP[2])>190)return;
 const yaw=w.axis===2?(w.speed>0?0:Math.PI):(w.speed>0?Math.PI/2:-Math.PI/2),phase=mix(w.prevPhase??w.phase,w.phase,t),stride=Math.sin(phase)*.25*w.move,bob=Math.abs(Math.sin(phase))*.038*w.move;
 const m=transform([x,bob,z],[1,1,1],[0,yaw,0]),put=(p,s,c,k=0)=>props.put(mm(m,transform(p,s)),c,k),seg=(a,b,width,c)=>props.put(mm(m,segment(a,b,width)),c);
 put([0,1.13,0],[.39,.61,.25],w.col);foliage.put(mm(m,transform([0,1.61,.02],[.26,.31,.25],[w.react>0?-.30:0,0,0])),[.57,.39,.28]);
 for(let s of[-1,1]){
  const hip=[s*.12,.88,0],knee=[s*.13,.49,s*stride*.6],foot=[s*.13,.09,s*stride];seg(hip,knee,.14,[.12,.16,.21]);seg(knee,foot,.12,[.12,.16,.21]);put(add(foot,[0,-.01,.04]),[.14,.12,.26],[.08,.10,.12]);
  const shoulder=[s*.24,1.36,0],raised=w.react>0&&s===1,phone=w.type==='phone'&&s===1,hand=raised?[.26,1.98,.17]:phone?[.19,1.40,.29]:[s*.25,.88,-s*stride],elbow=raised?[.36,1.63,.06]:phone?[.34,1.02,.20]:[s*.30,1.10,-s*stride*.5];
  seg(shoulder,elbow,.11,w.col);seg(elbow,hand,.095,w.col);foliage.put(mm(m,transform(hand,[.09,.12,.10])),[.57,.39,.28]);
  if(phone)put(add(hand,[0,.035,.025]),[.08,.14,.025],[.08,.14,.18],5);
  if(w.type==='bag'&&s===-1)put(add(hand,[0,-.22,0]),[.25,.32,.18],[.57,.39,.18]);
 }
}
function cityLifeGeometry(){
 const t=clamp(life.acc*30,0,1);
 for(const c of cars){
  const p=lerp(c.from,c.to,t);if(Math.hypot(p[0]-drawP[0],p[2]-drawP[2])>220)continue;
  const yaw=c.prevYaw+angleDelta(c.prevYaw,c.yaw)*t,m=transform(p,[1,1,1],[0,yaw,0]),put=(p,s,col,k=0)=>props.put(mm(m,transform(p,s)),col,k);
  // Side mirrors, trunk/hood planes and license plates break up the basic vehicle boxes.
  put([0,.57,-2.24],[.48,.19,.035],[.84,.76,.39]);put([0,1.27,1.39],[1.80,.16,1.23],c.col,5);for(let s of[-1,1])put([s*1.0,1.45,.70],[.23,.18,.25],c.col,5);
  if(c.type==='ambulance'){
   put([0,1.88,-.42],[1.96,1.86,3.42],[.83,.85,.81]);put([0,1.67,-.43],[2.01,.28,3.5],[.72,.11,.10]);
   for(let s of[-1,1]){put([s*1.015,2.22,-.40],[.015,.66,.18],[.74,.10,.11]);put([s*1.016,2.22,-.40],[.015,.18,.66],[.74,.10,.11]);put([s*.64,2.91,.64],[.48,.18,.23],Math.sin(simTime*8+s*2)>0?[.95,.10,.07]:[.2,.045,.04],4);}
  }else if(c.type==='delivery'){put([0,1.79,-.56],[1.94,1.64,3.2],c.col,5);put([0,1.80,-2.18],[1.69,1.40,.04],[.53,.55,.52]);}
 }
 for(const b of cyclists){
  const along=mix(b.prevPos??b.pos,b.pos,t),lane=(b.axis===2?-b.sign:b.sign)*14.2,x=b.axis===2?b.street+lane:along,z=b.axis===2?along:b.street+lane;
  if(Math.hypot(x-drawP[0],z-drawP[2])>180)continue;
  const yaw=b.axis===2?(b.sign>0?0:Math.PI):(b.sign>0?Math.PI/2:-Math.PI/2),m=transform([x,0,z],[1,1,1],[0,yaw,0]),seg=(a,b,w,c)=>props.put(mm(m,segment(a,b,w)),c);
  for(let q of[-1,1]){foliage.put(mm(m,transform([0,.36,q*.65],[.09,.70,.70])),[.065,.07,.07]);foliage.put(mm(m,transform([0,.36,q*.65],[.095,.54,.54])),[.41,.46,.45]);}
  const frame=[[0,.4,-.65],[0,.86,-.20],[0,.39,.05],[0,.90,.51],[0,.4,.65]];for(let i=0;i<frame.length-1;i++)seg(frame[i],frame[i+1],.055,b.col);seg(frame[1],frame[3],.055,b.col);seg(frame[0],frame[2],.04,b.col);
  seg([0,.94,-.12],[0,1.39,.23],.26,b.col);foliage.put(mm(m,transform([0,1.62,.32],[.27,.28,.26])),[.65,.45,.3]);
  for(let side of[-1,1]){const pedal=[side*.13,.48+Math.sin(b.phase+side*Math.PI/2)*.13,.05+Math.cos(b.phase+side*Math.PI/2)*.13];seg([side*.12,.95,-.13],[side*.16,.76,.13],.13,[.12,.18,.23]);seg([side*.16,.76,.13],pedal,.11,[.12,.18,.23]);seg([side*.13,1.33,.22],[side*.21,1.03,.57],.105,b.col);}
 }
 // Small flocks above the roof line: locally seeded, continuous across world rebases.
 const cellX=Math.floor((drawP[0]+origin[0]*TILE)/TILE),cellZ=Math.floor((drawP[2]+origin[1]*TILE)/TILE);
 for(let g=-1;g<=1;g++)for(let i=0;i<5;i++){
  const worldX=(cellX+g)*TILE+Math.sin(simTime*.17+g)*32,worldZ=(cellZ+1)*TILE+40+Math.cos(simTime*.17+g)*48;
  const p=[worldX-origin[0]*TILE+i*2,72+Math.sin(simTime*.7+i)*1.2,worldZ-origin[1]*TILE+i*3],flap=Math.sin(simTime*9+i)*.4;
  props.put(segment(add(p,[-.9,flap,0]),p,.075),[.12,.17,.20]);props.put(segment(p,add(p,[.9,flap,0]),.075),[.12,.17,.20]);
 }
}
