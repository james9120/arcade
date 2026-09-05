from pathlib import Path

p=Path(__file__).with_name('index.html')
s=p.read_text()

def rep(old,new,name):
    global s
    if old not in s:
        raise SystemExit(f'polish patch missing: {name}')
    s=s.replace(old,new)

# Faster baseline and stronger swing drive.
rep("P={p:[0,48,55],v:[0,-1,26]", "P={p:[0,48,55],v:[0,-1,32]", 'initial speed')
rep("P.v=[0,-1,26]", "P.v=[0,-1,32]", 'reset speed')
rep("force[2]+=3.2+up*3.2", "force[2]+=4.8+up*4.4", 'swing drive')
rep("force[2]+=up*1.8", "force[2]+=1.15+up*2.4", 'air carry')
rep("P.v=add(P.v,mul(dir,13))", "P.v=add(P.v,mul(dir,16))", 'zip boost')
rep("if(speed>90)P.v=mul(P.v,90/speed)", "if(speed>102)P.v=mul(P.v,102/speed)", 'speed cap')

# More cinematic speed presentation.
rep("(aspect<1?82:72)+(motion?clamp((len(P.v)-24)*.23,0,10):0)", "(aspect<1?84:73)+(motion?clamp((len(P.v)-22)*.31,0,14):0)", 'dynamic fov')
rep("if(motion&&sp>32)", "if(motion&&sp>27)", 'speed lines threshold')
rep("clamp((sp-32)*.008,0,.23)", "clamp((sp-27)*.010,0,.31)", 'speed lines intensity')

# Replace the stiff free-flight arm pose with velocity-driven skydiving / tuck poses.
old="""}else{elbow=[s*(flip?.63:.77),flip?.06:.15,-.07];wrist=[s*(flip?.26:.80),flip?-.18:-.20,.25]}ball(shoulder"""
new="""}else{let fall=clamp(-P.v[1]/32,0,1),rise=clamp(P.v[1]/28,0,1),bank=clamp(-P.v[0]/35,-1,1),flutter=Math.sin(t*4.6+s)*.07;if(flip){elbow=[s*.63,.06,-.07];wrist=[s*.26,-.18,.25]}else if(fall>.35){elbow=[s*(.48+.18*fall),.34+flutter,.32];wrist=[s*(.28+.14*fall),-.04+flutter,.72]}else if(rise>.2){elbow=[s*(.55+.12*rise),.58+flutter,-.12];wrist=[s*(.30+.10*rise),.82+flutter,.18]}else{elbow=[s*(.57+.13*bank*s),.25+flutter,.30];wrist=[s*(.42+.12*bank*s),-.18+flutter,.62]}}ball(shoulder"""
rep(old,new,'air arms')

old="""let hip=[s*.24,-.47,0],knee=[s*.32,-1.02,swing?(.34+s*.13):.09],foot=[s*.34,-1.6,swing?-.14:-.16];if(flip){knee=[s*.33,-.72,.57];foot=[s*.33,-1.05,.3]}"""
new="""let hip=[s*.24,-.47,0],air=!swing&&!flip,fall=clamp(-P.v[1]/30,0,1),rise=clamp(P.v[1]/26,0,1),kick=Math.sin(t*3.8+s*1.7)*.10,knee=[s*.32,-1.02,swing?(.34+s*.13):.09],foot=[s*.34,-1.6,swing?-.14:-.16];if(flip){knee=[s*.33,-.72,.57];foot=[s*.33,-1.05,.3]}else if(air){knee=[s*(.30+.13*fall),-.78+rise*.12,.40+fall*.25+kick];foot=[s*(.40+.12*fall),-1.20+rise*.18,.16+fall*.42-kick]}"""
rep(old,new,'air legs')

# Add architectural families: setbacks, glass crowns, rooftop water towers, billboard frames, canopies.
needle="""buildings.push(b);city.box([b.x,b.h/2+.4,b.z],[b.w,b.h,b.d],b.col,1,b.seed);city.box([b.x,b.h+.8,b.z],[b.w+1.0,1.3,b.d+1.0],trim);"""
insert="""buildings.push(b);city.box([b.x,b.h/2+.4,b.z],[b.w,b.h,b.d],b.col,1,b.seed);let family=Math.floor(b.seed*10)%5;if(family===0&&b.h>90){city.box([b.x,b.h*.72,b.z],[b.w*.82,b.h*.42,b.d*.84],mul(b.col,1.08),1,b.seed+3);city.box([b.x,b.h*.94,b.z],[b.w*.61,b.h*.16,b.d*.63],mul(b.col,.92),1,b.seed+6)}else if(family===1&&b.h>105){city.box([b.x,b.h+8,b.z],[b.w*.72,16,b.d*.74],[.16,.25,.31],1,b.seed+8);city.box([b.x,b.h+17,b.z],[b.w*.55,2,b.d*.56],[.28,.34,.37],5)}else if(family===2){for(let aw of[-1,1])city.box([b.x+aw*b.w*.31,5.4,b.z-b.d*.5-.8],[b.w*.28,.32,1.6],aw>0?[.50,.12,.10]:[.10,.24,.34],5)}else if(family===3&&b.h<145){city.box([b.x+5,b.h+4,b.z-4],[5.5,6,5.5],[.31,.21,.14],5);city.box([b.x+5,b.h+7.4,b.z-4],[6,.45,6],[.18,.20,.21],5);for(let leg of[-1,1])city.box([b.x+5+leg*2,b.h+1.2,b.z-4],[.24,2.5,.24],trim,5)}else if(family===4&&b.h>100){city.box([b.x,b.h*.62,b.z-b.d*.5-.6],[b.w*.86,10,.45],[1,1,1],6,0,Math.floor(b.seed*16));city.box([b.x-b.w*.42,b.h*.62,b.z-b.d*.5-.25],[.22,13,.22],trim,5);city.box([b.x+b.w*.42,b.h*.62,b.z-b.d*.5-.25],[.22,13,.22],trim,5)}city.box([b.x,b.h+.8,b.z],[b.w+1.0,1.3,b.d+1.0],trim);"""
rep(needle,insert,'building families')

# Street greenery, planters, bus shelters, kiosks and hydrants. Cubic foliage fits the stylized renderer and stays cheap.
needle="""for(let side of[-1,1]){city.box([bx+side*18,3.7,bz+18],[.18,7.4,.18],trim);"""
insert="""for(let ti=0;ti<4;ti++){let tz=bz+38+ti*31,side=ti%2?1:-1,tx=bx+side*23.7;city.box([tx,.48,tz],[2.6,.65,2.6],[.25,.20,.15],5);city.box([tx,2.6,tz],[.38,4.2,.38],[.24,.16,.09],5);city.box([tx,5.1,tz],[3.8,3.5,3.8],ti%3===0?[.11,.30,.16]:[.14,.36,.19],8);city.box([tx+1.0,6.2,tz-.4],[2.7,2.5,2.8],[.18,.42,.22],8)}city.box([bx+23.3,1.7,bz+96],[.18,3.1,5.8],[.27,.31,.34],5);city.box([bx+22.7,3.2,bz+96],[1.4,.16,6.0],[.34,.40,.44],5);city.box([bx+22.55,1.9,bz+96],[.12,2.3,5.1],[.18,.30,.37],5);city.box([bx-22.4,.75,bz+70],[1.0,1.5,1.0],[.65,.10,.06],5);for(let side of[-1,1]){city.box([bx+side*18,3.7,bz+18],[.18,7.4,.18],trim);"""
rep(needle,insert,'street variety')

# Denser roof silhouettes: HVAC, ducts, tanks and antennas.
needle="""for(let i=0;i<3;i++)city.box([b.x-7+i*6,b.h+1.9,b.z+2],[3.4,2.5,4.5],[.35,.4,.43],5);"""
insert="""for(let i=0;i<3;i++)city.box([b.x-7+i*6,b.h+1.9,b.z+2],[3.4,2.5,4.5],[.35,.4,.43],5);if(b.seed>.55){city.box([b.x-5,b.h+3.6,b.z+7],[7.5,.65,.65],[.31,.34,.36],5);city.box([b.x-8.3,b.h+3.6,b.z+4],[.65,.65,6.5],[.31,.34,.36],5)}if(b.seed<.22){city.box([b.x+6,b.h+5.5,b.z+5],[4.8,4.8,4.8],[.23,.28,.31],5);city.box([b.x+6,b.h+8.3,b.z+5],[5.2,.35,5.2],[.42,.46,.47],5)}"""
rep(needle,insert,'roof detail')

p.write_text(s)
print('Web Swing world/animation polish applied')
