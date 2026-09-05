from pathlib import Path
p=Path(__file__).with_name('index.html')
s=p.read_text()

def rep(a,b,name):
    global s
    if a not in s:
        raise SystemExit('missing '+name)
    s=s.replace(a,b)

rep("P.p[1]+clamp(42+Math.max(0,-P.v[1])*.3,38,62)","P.p[1]+clamp(26+Math.max(0,-P.v[1])*.18,22,40)",'lower anchors')
rep("P.rope={a:[...target.p],length:len(sub(target.p,P.p)),age:0,tension:0,side:target.side}","P.rope={a:[...target.p],length:clamp(len(sub(target.p,P.p))*.84,20,88),age:0,tension:0,side:target.side}",'shorter web')
rep("let force=[-sx*(P.rope?11:8.5),-16.8,0]","let force=[-sx*(P.rope?12.5:9.5),-26.0,0]",'gravity')
rep("if(P.rope){force[2]+=4.2+up*4.0;P.rope.age+=dt}else{airTime+=dt;force[2]+=.55+up*1.5;if(dive){force[1]-=13.5;force[2]+=2.7;}if(P.v[1]>0)force[1]-=4.2;}","if(P.rope){force[2]+=2.6+up*2.8;P.rope.age+=dt}else{airTime+=dt;force[2]+=.10+up*.45;if(dive){force[1]-=18.0;force[2]+=1.8;}if(P.v[1]>0)force[1]-=7.5;}",'remove float assist')
rep("let r=P.rope,reel=up*9.5;if(dive)reel=-5;r.length=clamp(r.length-reel*dt,18,125)","let r=P.rope,reel=up*15.5;if(dive)reel=-3;r.length=clamp(r.length-reel*dt,16,92)",'reel')
rep("P.v=add(P.v,mul(tangent,1.35*dt));","P.v=add(P.v,mul(tangent,(4.8+Math.min(8,Math.max(0,-P.v[1])*.22))*dt));",'bottom acceleration')
rep("if(r.length>=125&&dist>130)release();","if(r.length>=92&&dist>98)release();",'rope max')
rep("clamp(-ay/90,-.18,.22)+ropePull*.12","clamp(-ay/55,-.34,.42)+ropePull*.30",'rag pitch')
rep("clamp(-ax/75,-.28,.28)","clamp(-ax/46,-.46,.46)",'rag roll')
rep("clamp((Math.abs(ax)+Math.abs(ay)+Math.abs(az))/120,0,.34)","clamp((Math.abs(ax)+Math.abs(ay)+Math.abs(az))/78,0,.62)",'rag arm')
rep("clamp(-P.v[1]/48,-.18,.42)+ropePull*.10","clamp(-P.v[1]/34,-.30,.66)+ropePull*.24",'rag leg')
rep("let desired=[P.p[0]-P.v[0]*.16,P.p[1]+5.5,P.p[2]-15-Math.min(6,len(P.v)*.05)]","let desired=[P.p[0]-P.v[0]*.13,P.p[1]+3.8,P.p[2]-12-Math.min(8,len(P.v)*.075)]",'camera proximity')
rep("addEventListener('blur',pause);", "", 'remove blur pause')
rep("P.v=[0,-1,32]","P.v=[0,-3,36]",'reset launch')
rep("const P={p:[0,48,55],v:[0,-1,32]","const P={p:[0,48,55],v:[0,-3,36]",'initial launch')
p.write_text(s)
print('HEAVY_PASS_OK')
# trigger-v2