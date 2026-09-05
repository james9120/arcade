"""Temporary preview builder. Produces the single-file candidate in the CI workspace."""
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'games/web-swing/index.html'
s = path.read_text()
assert 'G=9.81' in s, 'Preview requires the reviewed momentum baseline'
character = r'''
/* Original swept-surface character. Continuous limbs, no joint spheres. */
function makeSuitAtlas(){
 const c=document.createElement('canvas');c.width=c.height=1024;
 const x=c.getContext('2d'),S=256;
 function tile(id,base,web=true){
  const ox=(id%4)*S,oy=Math.floor(id/4)*S;
  x.save();x.translate(ox,oy);x.beginPath();x.rect(0,0,S,S);x.clip();
  x.fillStyle=base;x.fillRect(0,0,S,S);
  if(web){x.strokeStyle='#370f19';x.lineWidth=1.05;
   for(let i=0;i<=12;i++){x.beginPath();x.moveTo(i*S/12,0);x.lineTo(i*S/12,S);x.stroke()}
   for(let j=-1;j<12;j++){x.beginPath();for(let i=0;i<=192;i++){let u=i*S/192,y=j*24+5*Math.cos(u/S*Math.PI*24);i?x.lineTo(u,y):x.moveTo(u,y)}x.stroke()}}
 }
 function finish(){x.restore()}
 function polygon(points,fill){x.fillStyle=fill;x.beginPath();points.forEach((p,i)=>i?x.lineTo(...p):x.moveTo(...p));x.closePath();x.fill()}
 function spider(cx,cy,size,color){x.save();x.translate(cx,cy);x.scale(size,size);x.strokeStyle=x.fillStyle=color;x.lineCap='round';x.lineJoin='round';x.lineWidth=.075;x.beginPath();x.ellipse(0,.07,.11,.22,0,0,TAU);x.fill();x.beginPath();x.ellipse(0,-.19,.095,.095,0,0,TAU);x.fill();for(let s of[-1,1])for(let j=0;j<4;j++){x.beginPath();x.moveTo(s*.045,-.19+j*.095);x.lineTo(s*(.25+j*.015),-.46+j*.24);x.lineTo(s*(.38+j*.015),-.68+j*.43);x.stroke()}x.restore()}
 tile(0,'#bc1834');
 for(let cx of[64,192])polygon([[cx-18,48],[cx-14,95],[cx-11,170],[cx-23,256],[cx+23,256],[cx+11,170],[cx+14,95],[cx+18,48]],'#122847');
 x.fillStyle='#122847';x.fillRect(0,222,256,34);x.fillStyle='#af1631';x.fillRect(0,216,256,8);
 spider(128,96,55,'#e5e9e6');spider(0,89,33,'#111b2a');spider(256,89,33,'#111b2a');finish();
 tile(1,'#c91d39');
 for(let s of[-1,1]){let lens=[[11,89],[51,66],[51,100],[33,119],[13,112]].map(([u,v])=>[128+s*u,v]);polygon(lens,'#10141d');lens=[[16,92],[46,77],[45,98],[31,112],[18,107]].map(([u,v])=>[128+s*u,v]);polygon(lens,'#e5edf0')}
 finish();
 tile(2,'#c31a36');x.fillStyle='#112644';x.fillRect(0,44,256,103);
 for(let cx of[56,200]){x.fillStyle='#a91a31';x.fillRect(cx-9,44,18,103)}
 x.strokeStyle='#294460';x.lineWidth=1.5;for(let xx of[84,172]){x.beginPath();x.moveTo(xx,45);x.lineTo(xx,146);x.stroke()}finish();
 tile(3,'#b61a34');x.fillStyle='#142b4a';x.fillRect(0,0,256,153);
 x.strokeStyle='#29415d';x.lineWidth=2;for(let xx of[55,201]){x.beginPath();x.moveTo(xx,0);x.lineTo(xx+9,150);x.stroke()}finish();
 tile(4,'#bc1b35');finish();tile(5,'#b51a32');x.fillStyle='#13233a';x.fillRect(0,207,256,49);finish();
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);gl.generateMipmap(gl.TEXTURE_2D);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return t;
}
const suitAtlas=makeSuitAtlas();
class CharacterSurface extends Batch{
 constructor(){super([],1);this.surface=new Float32Array(22000*8);this.cursor=0;this.triangles=0;
  gl.bindBuffer(gl.ARRAY_BUFFER,this.geo);gl.bufferData(gl.ARRAY_BUFFER,this.surface.byteLength,gl.DYNAMIC_DRAW)}
 begin(){this.cursor=0;this.reset()}
 vertex(p,n,u,v,tile){let a=this.surface,i=this.cursor;
  if(i+8>a.length)throw Error('Character vertex budget exceeded');
  a[i]=p[0];a[i+1]=p[1];a[i+2]=p[2];a[i+3]=n[0];a[i+4]=n[1];a[i+5]=n[2];
  a[i+6]=(tile%4+.012+u*.976)/4;a[i+7]=1-(Math.floor(tile/4)+.012+v*.976)/4;this.cursor=i+8;
 }
 rings(rings,tile,sides=16,seam=0){
  const grid=[];for(let j=0;j<rings.length;j++){const r=rings[j],row=[];
   for(let k=0;k<=sides;k++){let u=k/sides,theta=u*TAU+seam,p=add(r.c,add(mul(r.x,Math.sin(theta)),mul(r.z,Math.cos(theta))));row.push({p,u,v:r.v})}grid.push(row)}
  for(let j=0;j<grid.length;j++)for(let k=0;k<=sides;k++){
   let u=k%sides,du=sub(grid[j][(u+1)%sides].p,grid[j][(u+sides-1)%sides].p),dv=sub(grid[Math.min(j+1,grid.length-1)][k].p,grid[Math.max(0,j-1)][k].p);
   grid[j][k].n=unit(cross(du,dv));
  }
  for(let j=0;j<grid.length-1;j++)for(let k=0;k<sides;k++)for(let q of[grid[j][k],grid[j+1][k],grid[j][k+1],grid[j][k+1],grid[j+1][k],grid[j+1][k+1]])this.vertex(q.p,q.n,q.u,q.v,tile);
 }
 profile(root,rows,tile,sides=24,seam=0){
  const X=[root[0],root[1],root[2]],Z=[root[8],root[9],root[10]],min=rows[0][0],span=rows[rows.length-1][0]-min;
  this.rings(rows.map(([y,rx,rz,cz=0])=>({c:point(root,[0,y,cz]),x:mul(X,rx),z:mul(Z,rz),v:1-(y-min)/span})),tile,sides,seam);
 }
 tube(root,points,radii,tile,sides=12){
  let centers=points.map(p=>point(root,p)),rings=[],previousX=null;
  for(let j=0;j<centers.length;j++){let tangent=unit(sub(centers[Math.min(j+1,centers.length-1)],centers[Math.max(0,j-1)]));
   let guide=[root[8],root[9],root[10]],X=unit(cross(tangent,guide));if(len(X)<.1)X=unit(cross(tangent,[root[0],root[1],root[2]]));
   if(previousX&&dot(previousX,X)<0)X=mul(X,-1);previousX=X;let Z=unit(cross(X,tangent));
   rings.push({c:centers[j],x:mul(X,radii[j]),z:mul(Z,radii[j]*.91),v:j/(centers.length-1)});
  }this.rings(rings,tile,sides);
 }
 finish(){this.vertices=this.cursor/8;this.triangles=this.vertices/3;gl.bindBuffer(gl.ARRAY_BUFFER,this.geo);gl.bufferSubData(gl.ARRAY_BUFFER,0,this.surface.subarray(0,this.cursor));this.put(identity(),[1,1,1],9);super.upload()}
}
function limbCenters(a,j,b){return[lerp(a,j,-.065),a,lerp(a,j,.20),lerp(a,j,.48),lerp(a,j,.78),lerp(a,j,.95),j,lerp(j,b,.08),lerp(j,b,.26),lerp(j,b,.50),lerp(j,b,.75),b,lerp(j,b,1.025)]}
function ik(a,target,l1,l2,pole){let dir=unit(sub(target,a)),d=clamp(len(sub(target,a)),Math.abs(l1-l2)+.003,l1+l2-.003),end=add(a,mul(dir,d)),bend=sub(pole,mul(dir,dot(pole,dir)));if(len(bend)<.001)bend=cross(dir,[1,0,0]);let t=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-t*t));return{joint:add(a,add(mul(dir,t),mul(unit(bend),h))),end}}
const characterTelemetry={armLengths:[],legLengths:[],hand:null,triangles:0};
function heroGeometry(){
 hero.begin();webs.reset();eyes.reset();
 const r=P.rope,flip=P.flip,pose=P.pose,vY=P.v[1],speed=Math.hypot(P.v[0],P.v[2]),dive=input.dive||keys.has('ShiftLeft')||keys.has('ShiftRight'),f=[Math.sin(P.yaw),0,Math.cos(P.yaw)];
 let up=pose.up,z=unit(sub(f,mul(up,dot(f,up))));if(len(z)<.1)z=f;let x=unit(cross(up,z)),root=basis(drawP,x,up,z);
 if(!r){let falling=clamp(-vY/28,0,1),rising=clamp(vY/28,0,1),pitch=dive?2.65:.42+falling*.90-rising*.38+pose.lean*.35;
  root=mm(root,transform([0,0,0],[1,1,1],[pitch,0,-steerValue()*.24]));
 }
 if(flip){let q=clamp(flip.t/flip.duration,0,1),t=q*q*(3-2*q);root=mm(root,transform([0,0,0],[1,1,1],[-t*TAU,flip.cork?t*TAU*flip.dir:0,flip.cork?Math.sin(q*Math.PI)*.38:0]))}
 hero.profile(root,[[-.285,.082,.083],[-.25,.140,.106],[-.19,.163,.119],[-.12,.157,.114],[-.045,.133,.104],[.025,.123,.101],[.12,.151,.114],[.22,.188,.135],[.32,.213,.138],[.39,.215,.129],[.435,.196,.111],[.47,.123,.085],[.50,.068,.064],[.535,.061,.061]],0,28);
 let neck=mm(root,transform([0,.51,.012],[1,1,1],[-clamp((r?.14:-vY*.005),-.15,.30),clamp(steerValue()*.18,-.2,.2),0]));
 hero.profile(neck,[[0,.061,.061],[.045,.061,.064],[.065,.064,.075,.022],[.09,.078,.087,.017],[.13,.091,.101,.008],[.18,.096,.106,0],[.225,.085,.095,-.007],[.265,.053,.068,-.009],[.283,.004,.008,-.006]],1,28,Math.PI);
 characterTelemetry.armLengths=[];characterTelemetry.legLengths=[];let hand=null;
 for(let s of[-1,1]){
  const attached=r&&s===-r.side,shoulder=[s*.217,.411,0];let desired;
  if(attached){let local=unit(localVector(root,sub(r.a,point(root,shoulder))));desired=add(shoulder,mul(local,.602))}
  else if(flip)desired=[s*.16,.09,.28];
  else if(dive)desired=[s*.25,-.17,-.12];
  else if(r)desired=[s*.33,-.045,-.19-clamp(pose.lag,-.2,.3)*.3];
  else if(s===1)desired=vY>4?[.21,.73,.26]:[.49,.22,.14];
  else desired=vY>4?[-.34,.02,-.24]:[-.29,-.09,-.22];
  const arm=ik(shoulder,desired,.307,.302,[s*.7,-.5,-.65]),elbow=arm.joint,wrist=arm.end;
  hero.tube(root,limbCenters(shoulder,elbow,wrist),[.066,.086,.088,.085,.071,.060,.059,.063,.073,.071,.056,.046,.043],2);
  const handAxis=unit(sub(wrist,elbow)),handEnd=add(wrist,mul(handAxis,.117));
  hero.tube(root,[wrist,add(wrist,mul(handAxis,.025)),add(wrist,mul(handAxis,.069)),handEnd],[.044,.050,.047,.032],4,10);
  let thumbStart=add(wrist,[s*.031,-.002,.010]),thumbEnd=add(thumbStart,add(mul(handAxis,.075),[-s*.016,0,.018]));
  hero.tube(root,[thumbStart,lerp(thumbStart,thumbEnd,.5),thumbEnd],[.023,.022,.012],4,8);
  if(attached)hand=point(root,add(wrist,mul(handAxis,.025)));
  characterTelemetry.armLengths.push([len(sub(elbow,shoulder)),len(sub(wrist,elbow))]);
  const hip=[s*.104,-.23,0];let footTarget;
  if(flip)footTarget=[s*.15,-.62,.29];
  else if(dive)footTarget=[s*.12,-1.09,-.045];
  else if(r){let lead=s===-r.side;footTarget=[s*(lead?.14:.17),lead?-.995:-1.04,lead?-.31:-.17-clamp(pose.lag,-.1,.35)*.35]}
  else if(s===1)footTarget=[.17,vY>2?-.89:-1.045,-.28];
  else footTarget=[-.19,vY>2?-1.015:-.91,-.30-clamp(-vY/40,0,.25)];
  const leg=ik(hip,footTarget,.436,.433,[s*.1,0,1]),knee=leg.joint,ankle=leg.end;
  hero.tube(root,limbCenters(hip,knee,ankle),[.089,.094,.109,.106,.084,.066,.064,.068,.078,.073,.057,.043,.040],3,14);
  const footRoot=mm(root,transform(add(ankle,[0,-.024,.046]),[1,1,1],[.10,0,0]));
  hero.profile(footRoot,[[-.064,.054,.080,.015],[-.054,.062,.120,.028],[-.026,.060,.121,.028],[.006,.052,.107,.023],[.041,.043,.055,-.024],[.068,.038,.041,-.034]],5,16);
  characterTelemetry.legLengths.push([len(sub(knee,hip)),len(sub(ankle,knee))]);
 }
 hero.finish();characterTelemetry.hand=hand;characterTelemetry.triangles=hero.triangles;
 if(r&&hand){let slack=Math.max(0,r.length-len(sub(r.a,P.p))),end=lerp(hand,r.a,clamp(r.age/.05,0,1)),last=hand;
  for(let i=1;i<=16;i++){let t=i/16,p=lerp(hand,end,t);p[1]-=Math.sin(t*Math.PI)*slack*.35;webs.put(segment(last,p,.019),[.91,.96,.98],7);last=p}webs.box(end,[.085,.085,.085],[.93,.98,1],7);
 }webs.upload();
}
'''
s=s.replace('Web / Swing — Momentum','Web / Swing — Velocity')
s=s.replace('MOMENTUM / REBUILT','VELOCITY / CHARACTER & PACE')
s=s.replace('SI units. 120 Hz simulation; unilateral, inextensible rope; energy supplied only by','Game-space metres. Consistent, gameplay-tuned gravity. 120 Hz simulation; energy supplied by')
s=s.replace('STEP=1/120,G=9.81,TILE=144,ROAD=34,RADIUS=.92','STEP=1/120,G=24,TILE=144,ROAD=34,RADIUS=1.04')
s=s.replace('uniform sampler2D uDepth,uAtlas;','uniform sampler2D uDepth,uAtlas,uSuit;')
s=s.replace('}else if(k>7.5&&k<8.5){spec=.12;e=c*(.11+uNight*.26);}','}else if(k>7.5&&k<8.5){spec=.12;e=c*(.11+uNight*.26);\n}else if(k>8.5&&k<9.5){c=texture(uSuit,vUV).rgb;spec=.10;e=c*(.065+uNight*.24);}')
s=s.replace(',hero=new Batch(sphereGeometry(20,14),150)','')
a=s.index('function eyeGeometry()');b=s.index('function lighting()',a)
s=s[:a]+character+'\nconst hero=new CharacterSurface(),eyes=new Batch([],1);\n'+s[b:]
s=s.replace('gl.uniform1i(U.uAtlas,1);city.draw();','gl.uniform1i(U.uAtlas,1);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,suitAtlas);gl.uniform1i(U.uSuit,2);city.draw();')
s=s.replace('p:[0,36,48],prev:[0,36,48],v:[0,-3,32]','p:[0,32,48],prev:[0,32,48],v:[0,-5,46]')
s=s.replace('P.p=[0,36,48];P.prev=[...P.p];P.v=[0,-3,32]','P.p=[0,32,48];P.prev=[...P.p];P.v=[0,-5,46]')
s=s.replace('cam=[0,39,38],camLook=[0,36,53]','cam=[0,33.6,40.4],camLook=[0,32.2,53]')
s=s.replace('cam=[0,39.1,38.7];camLook=[0,36.55,52.2]','cam=[0,33.6,40.4];camLook=[0,32.2,53]')
s=s.replace('wanted=r.zip>0?-15:reel>0?-reel*5:-reel*6','wanted=r.zip>0?-20:reel>0?-reel*8:-reel*8')
s=s.replace('wanted-r.rate,-28*dt,28*dt','wanted-r.rate,-42*dt,42*dt')
s=s.replace('P.rope?7.5:2.4','P.rope?11:4.2')
s=s.replace('mul(tangent,up*2.0)','mul(tangent,up*3.8)')
s=s.replace('drag=dive?.00012:.00040','drag=dive?.00008:.00022')
s=s.replace('lift=clamp(21+speed*.26+Math.max(0,-P.v[1])*.5,24,47)','lift=clamp(19+speed*.20+Math.max(0,-P.v[1])*.45,25,43)')
s=s.replace('reach=clamp(speed*.70,16,34)','reach=clamp(speed*.61,18,32)')
s=s.replace('duration:.80','duration:.64')
s=s.replace('dt*8));let h=Math.hypot','dt*13));let h=Math.hypot')
s=s.replace('dt*6));}','dt*8));}')
s=s.replace('back=settings.motion?9.3+clamp((sp-28)*.05,0,1.9):10','back=settings.motion?7.6+clamp((sp-40)*.018,0,.9):8.2')
s=s.replace('mul(f,-back),[0,3.1,0]','mul(f,-back),[0,1.55,0]')
s=s.replace('mul(f,4.2),[0,.55+clamp(P.v[1]*.018,-.4,.4),0]','mul(f,5.0),[0,.18+clamp(P.v[1]*.010,-.25,.25),0]')
s=s.replace('(width<height?66:62)+(settings.motion?clamp((sp-25)*.16,0,6):0)','(width<height?66:64)+(settings.motion?clamp((sp-38)*.17,0,7):0)')
s=s.replace('dt*11):desired','dt*16):desired').replace('dt*9):focus','dt*13):focus')
s=s.replace('accumulator+=Math.min(dt,.10);let steps=0;while(accumulator>=STEP&&steps<12)','accumulator+=Math.min(dt,.25);let steps=0;while(accumulator+1e-10>=STEP&&steps<30)')
s=s.replace('constants:{STEP,G,TILE,RADIUS}','character:characterTelemetry,constants:{STEP,G,TILE,RADIUS}')
path.write_text(s)
print('Prepared velocity preview:',len(s),'characters')
