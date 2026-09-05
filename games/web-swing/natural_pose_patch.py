from pathlib import Path
p=Path(__file__).with_name('index.html')
s=p.read_text()

def r(a,b,n):
    global s
    if a not in s:
        raise SystemExit('missing '+n)
    s=s.replace(a,b)

r("let pr=spring(rag.pitch,rag.pitchV,clamp(-ay/55,-.34,.42)+ropePull*.30,22,8,dt);",
  "let pr=spring(rag.pitch,rag.pitchV,clamp(-ay/95,-.16,.20)+ropePull*.11,15,9.5,dt);",'pitch damping')
r("let rr=spring(rag.roll,rag.rollV,clamp(-ax/46,-.46,.46),20,7,dt);",
  "let rr=spring(rag.roll,rag.rollV,clamp(-ax/88,-.20,.20),14,9,dt);",'roll damping')
r("let tr=spring(rag.twist,rag.twistV,clamp(-P.v[0]/75,-.16,.16)+(swing?swing.side*.05:0),15,6,dt);",
  "let tr=spring(rag.twist,rag.twistV,clamp(-P.v[0]/120,-.08,.08)+(swing?swing.side*.022:0),12,8.5,dt);",'twist damping')
r("let ar=spring(rag.arm,rag.armV,clamp((Math.abs(ax)+Math.abs(ay)+Math.abs(az))/78,0,.62),17,5.5,dt);",
  "let ar=spring(rag.arm,rag.armV,clamp((Math.abs(ax)+Math.abs(ay)+Math.abs(az))/105,0,.40),15,7.2,dt);",'arm damping')
r("let lr=spring(rag.leg,rag.legV,clamp(-P.v[1]/34,-.30,.66)+ropePull*.24,15,5,dt);",
  "let lr=spring(rag.leg,rag.legV,clamp(-P.v[1]/30,-.24,.78)+ropePull*.30,18,6,dt);",'leg emphasis')
r("let hr=spring(rag.head,rag.headV,clamp(-ax/110,-.12,.12),13,5,dt);",
  "let hr=spring(rag.head,rag.headV,clamp(-ax/220,-.045,.045),18,10,dt);",'head damping')
r("let rx=(swing?clamp(P.v[1]/42,-.78,.62):.72-clamp(P.v[1]/32,-.85,.85))+rag.pitch,rz=clamp(-P.v[0]/55,-.55,.55)+rag.roll,ry=P.yaw+rag.twist;",
  "let rx=(swing?clamp(P.v[1]/48,-.62,.50):.58-clamp(P.v[1]/38,-.64,.64))+rag.pitch*.34,rz=clamp(-P.v[0]/72,-.34,.34)+rag.roll*.38,ry=P.yaw+rag.twist*.45;",'root balance')
r("ball([rag.head*.12,.94,.03],[.22,.26,.25],red,3);ball([rag.head*.22,1.27,.035+Math.abs(rag.head)*.08],[.49,.64,.49],red,3);",
  "ball([rag.head*.035,.94,.01],[.22,.26,.25],red,3);ball([rag.head*.07,1.27,.025+Math.abs(rag.head)*.025],[.49,.64,.49],red,3);",'head posture')
r("let fall=clamp(-P.v[1]/32,0,1),rise=clamp(P.v[1]/28,0,1),bank=clamp(-P.v[0]/35,-1,1),flutter=Math.sin(t*4.6+s)*.07,lag=rag.arm*(.55+.25*Math.sin(t*3+s));",
  "let fall=clamp(-P.v[1]/34,0,1),rise=clamp(P.v[1]/30,0,1),bank=clamp(-P.v[0]/42,-1,1),flutter=Math.sin(t*4.2+s)*.035,lag=rag.arm*(.32+.12*Math.sin(t*3+s));",'free arm naturalize')
r("knee=[s*.32,-1.02+trail*.10,.34+s*.13+trail*.38];foot=[s*.34,-1.60+trail*.12,-.14+trail*.58]",
  "knee=[s*.32,-1.02+trail*.08,.28+s*.11+trail*.48];foot=[s*.34,-1.60+trail*.10,-.10+trail*.74]",'swing leg trail')
r("knee=[s*(.30+.13*fall+drag*.10),-.78+rise*.12+drag*.06,.40+fall*.25+kick+drag*.35];foot=[s*(.40+.12*fall+drag*.16),-1.20+rise*.18+drag*.09,.16+fall*.42-kick+drag*.62]",
  "knee=[s*(.30+.11*fall+drag*.08),-.82+rise*.10+drag*.05,.34+fall*.22+kick+drag*.44];foot=[s*(.38+.10*fall+drag*.12),-1.30+rise*.14+drag*.07,.10+fall*.38-kick+drag*.82]",'air leg balance')

p.write_text(s)
print('NATURAL_POSE_OK')