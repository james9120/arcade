const mist=new Batch([-0.5,-0.5,0,0,0,1,0,0, .5,-.5,0,0,0,1,1,0, .5,.5,0,0,0,1,1,1, -.5,-.5,0,0,0,1,0,0, .5,.5,0,0,0,1,1,1, -.5,.5,0,0,0,1,0,1],256);
function atmosphereGeometry(right,up){
 mist.reset();const entries=[];
 for(const b of blocks.values()){
  if(b.family%2)continue;const x=b.ix*TILE+14,z=b.iz*TILE+62;
  if(Math.hypot(x-drawP[0],z-drawP[2])>200)continue;
  for(let j=0;j<5;j++){const q=mod(simTime*.20+j*.2+b.ix*.13,1),p=[x+q*2+Math.sin(simTime*.4+j)*.2,.5+q*8,z+q*.8],size=1.25+q*3.6;
   entries.push({p,size,opacity:Math.sin(q*Math.PI)*.16,col:day>.4?[.70,.77,.83]:[.26,.34,.45]});}
 }
 entries.sort((a,b)=>len(sub(b.p,cam))-len(sub(a.p,cam)));
 for(const e of entries)mist.put(basis(e.p,mul(right,e.size),mul(up,e.size*1.4),unit(cross(right,up))),e.col,12,e.opacity,0);
 if(night>.1)for(const c of cars){
  const p=lerp(c.from,c.to,clamp(life.acc*30,0,1));if(Math.hypot(p[0]-drawP[0],p[2]-drawP[2])>160)continue;
  const f=[Math.sin(c.yaw),0,Math.cos(c.yaw)],x=cross(f,[0,1,0]),center=add(p,mul(f,6));center[1]=.027;
  mist.put(basis(center,mul(x,3.5),mul(f,9),[0,1,0]),[.95,.82,.50],12,.23*night,1);
 }
 mist.upload();
}
function audioScene(dt){
 if(!audio||!master)return;const running=state==='playing',t=audio.currentTime;
 if(trafficGain)trafficGain.gain.setTargetAtTime(running?.12*Math.exp(-Math.max(0,P.p[1]-4)/65):0,t,.25);
 if(!running){if(sirenGain)sirenGain.gain.setTargetAtTime(0,t,.2);return;}
 let closest=null,best=190;
 for(const c of cars){const d=len(sub(carPoint(c),P.p));if(c.type==='ambulance'&&d<best){best=d;closest=c;}}
 if(sirenGain){sirenGain.gain.setTargetAtTime(closest?.014*(1-best/190):0,t,.18);if(closest){siren.frequency.setTargetAtTime(620+220*Math.sin(simTime*2.2),t,.06);if(sirenPan){const r=cross(forward(),[0,1,0]);sirenPan.pan.setTargetAtTime(clamp(dot(unit(sub(carPoint(closest),P.p)),r),-.85,.85),t,.1);}}}
 life.hornAt-=dt;
 if(life.hornAt<=0&&settings.sound){const c=cars.find(c=>c.stationary>2&&len(sub(carPoint(c),P.p))<90);if(c)tone(290,270,.22,.018,'triangle');life.hornAt=5+hash(Math.floor(simTime))*6;}
}
