from pathlib import Path
p=Path(__file__).with_name('index.html')
s=p.read_text()

def rep(a,b,name):
    global s
    if a not in s: raise SystemExit('missing '+name)
    s=s.replace(a,b)

rep("let cam=[0,54,38],camLook=[0,48,65],VP=identity(),lightVP=identity(),width=1,height=1,dpr=1,day=.5,night=.5,sun=[.5,.4,.6],fog=[.55,.47,.40],clockAccum=0,frame=0,fpsTime=0,fpsFrames=0;",
"let cam=[0,54,38],camLook=[0,48,65],VP=identity(),lightVP=identity(),width=1,height=1,dpr=1,day=.5,night=.5,sun=[.5,.4,.6],fog=[.55,.47,.40],clockAccum=0,frame=0,fpsTime=0,fpsFrames=0;const rag={pitch:0,pitchV:0,roll:0,rollV:0,twist:0,twistV:0,arm:0,armV:0,leg:0,legV:0,head:0,headV:0,lastV:[0,0,0]};function spring(cur,vel,target,k=18,d=7,dt=1/60){vel+=(target-cur)*k*dt;vel*=Math.exp(-d*dt);cur+=vel*dt;return[cur,vel]}function ragStep(swing){let dt=1/60,ax=(P.v[0]-rag.lastV[0])/dt,ay=(P.v[1]-rag.lastV[1])/dt,az=(P.v[2]-rag.lastV[2])/dt;rag.lastV=[...P.v];let ropePull=0;if(swing){let d=unit(sub(swing.a,P.p));ropePull=clamp(dot([ax,ay+16.8,az],d)/45,-1,1)}let pr=spring(rag.pitch,rag.pitchV,clamp(-ay/90,-.18,.22)+ropePull*.12,22,8,dt);rag.pitch=pr[0];rag.pitchV=pr[1];let rr=spring(rag.roll,rag.rollV,clamp(-ax/75,-.28,.28),20,7,dt);rag.roll=rr[0];rag.rollV=rr[1];let tr=spring(rag.twist,rag.twistV,clamp(-P.v[0]/75,-.16,.16)+(swing?swing.side*.05:0),15,6,dt);rag.twist=tr[0];rag.twistV=tr[1];let ar=spring(rag.arm,rag.armV,clamp((Math.abs(ax)+Math.abs(ay)+Math.abs(az))/120,0,.34),17,5.5,dt);rag.arm=ar[0];rag.armV=ar[1];let lr=spring(rag.leg,rag.legV,clamp(-P.v[1]/48,-.18,.42)+ropePull*.10,15,5,dt);rag.leg=lr[0];rag.legV=lr[1];let hr=spring(rag.head,rag.headV,clamp(-ax/110,-.12,.12),13,5,dt);rag.head=hr[0];rag.headV=hr[1]}", 'rag state')

old="function heroGeometry(){hero.reset();webs.reset();let sp=len(P.v),swing=P.rope,flip=P.flip,t=simTime,bodyYaw=Math.atan2(P.v[0],Math.max(6,P.v[2]));P.yaw=mix(P.yaw,bodyYaw,.09);let rx=swing?clamp(P.v[1]/42,-.78,.62):.72-clamp(P.v[1]/32,-.85,.85),rz=clamp(-P.v[0]/55,-.55,.55),ry=P.yaw;"
new="function heroGeometry(){hero.reset();webs.reset();let sp=len(P.v),swing=P.rope,flip=P.flip,t=simTime,bodyYaw=Math.atan2(P.v[0],Math.max(6,P.v[2]));P.yaw=mix(P.yaw,bodyYaw,.09);ragStep(swing);let rx=(swing?clamp(P.v[1]/42,-.78,.62):.72-clamp(P.v[1]/32,-.85,.85))+rag.pitch,rz=clamp(-P.v[0]/55,-.55,.55)+rag.roll,ry=P.yaw+rag.twist;"
rep(old,new,'hero root')

rep("ball([0,.94,0],[.22,.26,.25],red,3);ball([0,1.27,.035],[.49,.64,.49],red,3);",
"ball([rag.head*.12,.94,.03],[.22,.26,.25],red,3);ball([rag.head*.22,1.27,.035+Math.abs(rag.head)*.08],[.49,.64,.49],red,3);",'head lag')

old="""}else{let fall=clamp(-P.v[1]/32,0,1),rise=clamp(P.v[1]/28,0,1),bank=clamp(-P.v[0]/35,-1,1),flutter=Math.sin(t*4.6+s)*.07;if(flip){elbow=[s*.63,.06,-.07];wrist=[s*.26,-.18,.25]}else if(fall>.35){elbow=[s*(.48+.18*fall),.34+flutter,.32];wrist=[s*(.28+.14*fall),-.04+flutter,.72]}else if(rise>.2){elbow=[s*(.55+.12*rise),.58+flutter,-.12];wrist=[s*(.30+.10*rise),.82+flutter,.18]}else{elbow=[s*(.57+.13*bank*s),.25+flutter,.30];wrist=[s*(.42+.12*bank*s),-.18+flutter,.62]}}ball(shoulder"""
new="""}else{let fall=clamp(-P.v[1]/32,0,1),rise=clamp(P.v[1]/28,0,1),bank=clamp(-P.v[0]/35,-1,1),flutter=Math.sin(t*4.6+s)*.07,lag=rag.arm*(.55+.25*Math.sin(t*3+s));if(flip){elbow=[s*.63,.06,-.07];wrist=[s*.26,-.18,.25]}else if(fall>.35){elbow=[s*(.48+.18*fall+lag*.2),.34+flutter-lag*.12,.32+lag*.42];wrist=[s*(.28+.14*fall+lag*.28),-.04+flutter-lag*.2,.72+lag*.58]}else if(rise>.2){elbow=[s*(.55+.12*rise+lag*.16),.58+flutter-lag*.08,-.12+lag*.26];wrist=[s*(.30+.10*rise+lag*.22),.82+flutter-lag*.14,.18+lag*.38]}else{elbow=[s*(.57+.13*bank*s+lag*.18),.25+flutter-lag*.10,.30+lag*.32];wrist=[s*(.42+.12*bank*s+lag*.26),-.18+flutter-lag*.16,.62+lag*.50]}}ball(shoulder"""
rep(old,new,'arm secondary')

old="""else if(air){knee=[s*(.30+.13*fall),-.78+rise*.12,.40+fall*.25+kick];foot=[s*(.40+.12*fall),-1.20+rise*.18,.16+fall*.42-kick]}"""
new="""else if(air){let drag=rag.leg;knee=[s*(.30+.13*fall+drag*.10),-.78+rise*.12+drag*.06,.40+fall*.25+kick+drag*.35];foot=[s*(.40+.12*fall+drag*.16),-1.20+rise*.18+drag*.09,.16+fall*.42-kick+drag*.62]}else if(swing){let trail=rag.leg;knee=[s*.32,-1.02+trail*.10,.34+s*.13+trail*.38];foot=[s*.34,-1.60+trail*.12,-.14+trail*.58]}"""
rep(old,new,'leg secondary')

p.write_text(s)
print('Applied controlled ragdoll dynamics')
