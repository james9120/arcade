from pathlib import Path
p=Path(__file__).with_name('index.html')
s=p.read_text()

def r(a,b,n):
    global s
    if a not in s:
        raise SystemExit('missing '+n)
    s=s.replace(a,b)

# Extend the secondary-motion state with animation-phase memory.
r("const rag={pitch:0,pitchV:0,roll:0,rollV:0,twist:0,twistV:0,arm:0,armV:0,leg:0,legV:0,head:0,headV:0,lastV:[0,0,0]};",
  "const rag={pitch:0,pitchV:0,roll:0,rollV:0,twist:0,twistV:0,arm:0,armV:0,leg:0,legV:0,head:0,headV:0,lastV:[0,0,0],attach:0,release:0,breath:0};",'rag state')

# Track attachment/release blends so posture transitions have anticipation and follow-through.
r("function ragStep(swing){let dt=1/60,ax=(P.v[0]-rag.lastV[0])/dt,ay=(P.v[1]-rag.lastV[1])/dt,az=(P.v[2]-rag.lastV[2])/dt;",
  "function ragStep(swing){let dt=1/60,ax=(P.v[0]-rag.lastV[0])/dt,ay=(P.v[1]-rag.lastV[1])/dt,az=(P.v[2]-rag.lastV[2])/dt;rag.attach=mix(rag.attach,swing?1:0,1-Math.exp(-dt*(swing?16:10)));rag.release=mix(rag.release,(!swing&&P.v[1]>1)?1:0,1-Math.exp(-dt*7));rag.breath+=dt;",'phase memory')

# Make body root follow velocity and rope direction, not raw acceleration. Keep pelvis as center of mass.
r("let rx=(swing?clamp(P.v[1]/48,-.62,.50):.58-clamp(P.v[1]/38,-.64,.64))+rag.pitch*.34,rz=clamp(-P.v[0]/72,-.34,.34)+rag.roll*.38,ry=P.yaw+rag.twist*.45;",
  "let velPitch=Math.atan2(-P.v[1],Math.max(16,Math.hypot(P.v[0],P.v[2]))),ropePitch=swing?Math.atan2(P.rope.a[1]-P.p[1],Math.max(8,Math.hypot(P.rope.a[0]-P.p[0],P.rope.a[2]-P.p[2]))):0,rx=clamp(velPitch*.72+ropePitch*.18,-.62,.72)+rag.pitch*.18,rz=clamp(-P.v[0]/88,-.27,.27)+rag.roll*.22,ry=P.yaw+rag.twist*.28;",'root velocity posture')

# Slight pelvic translation communicates compression/extension without pitching whole character.
r("let root=transform(P.p,[1.2,1.2,1.2],[rx,ry,rz]);",
  "let compression=swing?clamp((-P.v[1]+8)/48,0,.22):0,root=transform(add(P.p,[0,-compression*.32,0]),[1.2,1.2,1.2],[rx,ry,rz]);",'pelvic compression')

# Never throw both hands onto one web. Only the actual web arm reaches; the other arm counterbalances.
r("if(swing&&(s===swing.side||swing.age<.27)){",
  "if(swing&&s===swing.side){",'single web arm')

# Replace the free/off arm solver with phase-aware, asymmetric athletic motion.
old="""}else{let fall=clamp(-P.v[1]/34,0,1),rise=clamp(P.v[1]/30,0,1),bank=clamp(-P.v[0]/42,-1,1),flutter=Math.sin(t*4.2+s)*.035,lag=rag.arm*(.32+.12*Math.sin(t*3+s));if(flip){elbow=[s*.63,.06,-.07];wrist=[s*.26,-.18,.25]}else if(fall>.35){elbow=[s*(.48+.18*fall+lag*.2),.34+flutter-lag*.12,.32+lag*.42];wrist=[s*(.28+.14*fall+lag*.28),-.04+flutter-lag*.2,.72+lag*.58]}else if(rise>.2){elbow=[s*(.55+.12*rise+lag*.16),.58+flutter-lag*.08,-.12+lag*.26];wrist=[s*(.30+.10*rise+lag*.22),.82+flutter-lag*.14,.18+lag*.38]}else{elbow=[s*(.57+.13*bank*s+lag*.18),.25+flutter-lag*.10,.30+lag*.32];wrist=[s*(.42+.12*bank*s+lag*.26),-.18+flutter-lag*.16,.62+lag*.50]}}ball(shoulder"""
new="""}else{let fall=clamp(-P.v[1]/36,0,1),rise=clamp(P.v[1]/32,0,1),bank=clamp(-P.v[0]/48,-1,1),lag=rag.arm*.22,phase=Math.sin(t*2.8+s*1.7),off=swing&&s!==swing.side;if(flip){elbow=[s*.63,.06,-.07];wrist=[s*.26,-.18,.25]}else if(off){let pull=clamp((P.rope.tension||0)/900,0,1),sweep=.34+.20*pull;elbow=[s*(.60+sweep*.12),.18-pull*.10,.28+sweep*.32];wrist=[s*(.82+sweep*.10),-.10-pull*.12,.52+sweep*.44]}else if(fall>.30){let spread=.42+.20*fall;elbow=[s*(.58+spread*.22),.22+phase*.025,.38+lag];wrist=[s*(.82+spread*.18),-.06+phase*.035,.72+fall*.18+lag*.9]}else if(rise>.18){elbow=[s*(.52+.12*rise),.48+rise*.18,-.04];wrist=[s*(.68+.10*rise),.70+rise*.16,.18+lag*.45]}else{elbow=[s*(.58+.10*bank*s),.20+phase*.025,.30+lag*.45];wrist=[s*(.76+.10*bank*s),-.10+phase*.035,.56+lag*.70]}}ball(shoulder"""
r(old,new,'athletic arm solver')

# Replace the lower-body section with staggered knees/feet, compression under tension, and freefall spread.
old="""let hip=[s*.24,-.47,0],air=!swing&&!flip,fall=clamp(-P.v[1]/30,0,1),rise=clamp(P.v[1]/26,0,1),kick=Math.sin(t*3.8+s*1.7)*.10,knee=[s*.32,-1.02,swing?(.34+s*.13):.09],foot=[s*.34,-1.6,swing?-.14:-.16];if(flip){knee=[s*.33,-.72,.57];foot=[s*.33,-1.05,.3]}else if(air){let drag=rag.leg;knee=[s*(.30+.11*fall+drag*.08),-.82+rise*.10+drag*.05,.34+fall*.22+kick+drag*.44];foot=[s*(.38+.10*fall+drag*.12),-1.30+rise*.14+drag*.07,.10+fall*.38-kick+drag*.82]}else if(swing){let trail=rag.leg;knee=[s*.32,-1.02+trail*.08,.28+s*.11+trail*.48];foot=[s*.34,-1.60+trail*.10,-.10+trail*.74]}"""
new="""let hip=[s*.24,-.47,0],air=!swing&&!flip,fall=clamp(-P.v[1]/34,0,1),rise=clamp(P.v[1]/30,0,1),stride=Math.sin(t*3.1+s*1.9)*.12,knee=[s*.32,-1.02,.09],foot=[s*.34,-1.6,-.16];if(flip){knee=[s*.33,-.72,.57];foot=[s*.33,-1.05,.3]}else if(air){let drag=rag.leg,spread=.22+fall*.22;knee=[s*(.31+spread*.22),-.82+rise*.08+drag*.03,.30+fall*.26+s*stride+drag*.36];foot=[s*(.40+spread*.28),-1.29+rise*.10,.08+fall*.44-s*stride+drag*.58]}else if(swing){let trail=rag.leg,pull=clamp((P.rope.tension||0)/950,0,1),lead=s===swing.side?1:-1;knee=[s*(.30+.05*pull),-.91+pull*.12,.22+trail*.35+lead*.13];foot=[s*(.35+.06*pull),-1.45+pull*.22,-.04+trail*.56+lead*.20]}"""
r(old,new,'lower body solver')

# Head should subtly look along travel/rope instead of bobbing mechanically.
r("ball([rag.head*.035,.94,.01],[.22,.26,.25],red,3);ball([rag.head*.07,1.27,.025+Math.abs(rag.head)*.025],[.49,.64,.49],red,3);",
  "let gaze=swing?clamp((P.rope.a[0]-P.p[0])/75,-.08,.08):clamp(P.v[0]/95,-.07,.07);ball([gaze*.16,.94,.01],[.22,.26,.25],red,3);ball([gaze*.30,1.27,.03],[.49,.64,.49],red,3);",'head gaze')

p.write_text(s)
print('MOTION_OVERHAUL_OK')