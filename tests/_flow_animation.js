// Animation is advanced by the fixed simulation clock and interpolated for rendering.
// Target blending happens BEFORE two-bone IK, so smoothing cannot stretch a limb.
const rig={initialized:false,pitch:0,bank:0,spin:0,twist:0,baseSpin:0,token:null,arms:[],feet:[],curves:[],handX:[],prev:null};
let drawRig=null,renderAlpha=1;
function resetRig(){Object.assign(rig,{initialized:false,pitch:0,bank:0,spin:0,twist:0,baseSpin:0,token:null,arms:[],feet:[],curves:[],handX:[],prev:null});drawRig=null;}
function copyRig(){return{pitch:rig.pitch,bank:rig.bank,spin:rig.spin,twist:rig.twist,arms:rig.arms.map(p=>[...p]),feet:rig.feet.map(p=>[...p]),curves:rig.curves.map(p=>[...p]),handX:rig.handX.map(p=>[...p])};}
function rigRoot(pos,up,pitch,bank,spin,twist){
 const f=[Math.sin(P.yaw),0,Math.cos(P.yaw)];let z=unit(sub(f,mul(up,dot(f,up))));if(len(z)<.1)z=f;
 const root=basis(pos,unit(cross(up,z)),up,z);
 return mm(root,transform([0,0,0],[1,1,1],[pitch-spin,twist,bank]));
}
function limbGoals(s,root){
 const r=P.rope,flip=P.flip,vY=P.v[1],dive=input.dive||keys.has('ShiftLeft')||keys.has('ShiftRight'),shoulder=[s*.217,.411,0],attached=r&&s===-r.side;
 const aiming=!flip&&!attached&&aimIntent().active&&target&&s===-target.side;
 let arm,foot;
 if(attached||aiming){const a=attached?r.a:target.p,d=unit(localVector(root,sub(a,point(root,shoulder))));arm=add(shoulder,mul(d,attached?.602:.586));}
 else if(flip)arm=[s*.16,.09,.28];
 else if(dive)arm=[s*.25,-.17,-.12];
 else if(r)arm=[s*.34,-.02,-.17-clamp(P.pose.lag,-.2,.3)*.3];
 else if(s===1)arm=vY>4?[.35,.76,.23]:[.53,.16,.14];
 else arm=vY>4?[-.31,-.09,-.19]:[-.39,-.035,-.24];
 if(flip)foot=[s*.15,-.62,.29];
 else if(dive)foot=[s*.12,-1.09,-.045];
 else if(r){let lead=s===-r.side,tuck=clamp(r.tension/100,0,1);foot=[s*(lead?.14:.17),(lead?-.995:-1.04)+tuck*.075,lead?-.31:-.17-clamp(P.pose.lag,-.1,.35)*.35];}
 else if(s===1)foot=[.17,vY>2?-.89:-1.045,-.28];
 else foot=[-.19,vY>2?-1.015:-.91,-.30-clamp(-vY/40,0,.25)];
 const mode=attached?(r.age<.18?'shoot':'grip'):aiming?'shoot':flip||dive?'relaxed':'open';
 const curves=[0,1,2,3].map(i=>mode==='grip'||mode==='shoot'&&(i===1||i===2)?1:mode==='relaxed'?.36:.08);curves.push(mode==='grip'?1:0);
 return{arm,foot,mode,curves,attached,aiming};
}
function updateRig(dt){
 const cold=!rig.initialized,r=P.rope,vY=P.v[1],dive=input.dive||keys.has('ShiftLeft')||keys.has('ShiftRight');
 if(!cold)rig.prev=copyRig();
 const k=cold?1:1-Math.exp(-dt*13),pitch=r?0:dive?2.65:.34+clamp(-vY/28,0,1)*.90-clamp(vY/28,0,1)*.38+P.pose.lean*.35;
 rig.pitch=mix(rig.pitch,pitch,k);rig.bank=mix(rig.bank,-steerValue()*.24,k);
 if(P.flip){
  if(rig.token!==P.flip){rig.baseSpin=Math.round(rig.spin/TAU)*TAU;rig.token=P.flip;}
  const q=clamp(P.flip.t/P.flip.duration,0,1),ease=q*q*(3-2*q);
  rig.spin=rig.baseSpin+ease*TAU;rig.twist=P.flip.cork?ease*TAU*P.flip.dir:0;
 }else{
  // An interrupted trick resolves toward the nearest equivalent pose, never a hard reset.
  rig.spin=mix(rig.spin,Math.round(rig.spin/TAU)*TAU,k);rig.twist=mix(rig.twist,Math.round(rig.twist/TAU)*TAU,k);rig.token=null;
 }
 const root=rigRoot(P.p,P.pose.up,rig.pitch,rig.bank,rig.spin,rig.twist);
 for(let i=0;i<2;i++){
  const s=i?1:-1,g=limbGoals(s,root),blend=cold?1:1-Math.exp(-dt*(g.attached?19:12));
  rig.arms[i]=cold?g.arm:lerp(rig.arms[i],g.arm,blend);rig.feet[i]=cold?g.foot:lerp(rig.feet[i],g.foot,k);
  rig.curves[i]=cold?g.curves:rig.curves[i].map((v,j)=>mix(v,g.curves[j],k));
  const shoulder=[s*.217,.411,0],a=ik(shoulder,rig.arms[i],.307,.302,g.attached?[s*.3,-.2,-1]:[s*.26,-1,-.22]),Y=unit(sub(a.end,a.joint));
  let X=unit(cross(Y,[0,0,1]));if(len(X)<.1)X=unit(cross(Y,[0,1,0]));
  if(!cold&&dot(X,rig.handX[i])<0)X=mul(X,-1);
  if(!cold)X=lerp(rig.handX[i],X,k);rig.handX[i]=unit(sub(X,mul(Y,dot(X,Y))));
 }
 rig.initialized=true;if(cold)rig.prev=copyRig();
}
function interpolatedRig(alpha){
 if(!rig.initialized)updateRig(0);const p=rig.prev||rig;
 const o={};for(let key of['pitch','bank','spin','twist'])o[key]=mix(p[key],rig[key],alpha);
 for(let key of['arms','feet','handX'])o[key]=rig[key].map((v,i)=>lerp(p[key][i],v,alpha));
 o.curves=rig.curves.map((v,i)=>v.map((n,j)=>mix(p.curves[i][j],n,alpha)));return o;
}
