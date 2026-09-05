from pathlib import Path
p=Path(__file__).with_name('index.html')
s=p.read_text()
repls={
"let force=[-sx*(P.rope?11:8.5),-9.81,0]":"let force=[-sx*(P.rope?11:8.5),-16.8,0]",
"if(P.rope){force[2]+=4.8+up*4.4;P.rope.age+=dt}else{airTime+=dt;force[2]+=1.15+up*2.4;if(dive){force[1]-=10.4;force[2]+=3.5;}}":"if(P.rope){force[2]+=4.2+up*4.0;P.rope.age+=dt}else{airTime+=dt;force[2]+=.55+up*1.5;if(dive){force[1]-=13.5;force[2]+=2.7;}if(P.v[1]>0)force[1]-=4.2;}",
"P.v=mul(P.v,Math.exp(-.010*dt))":"P.v=mul(P.v,Math.exp(-.016*dt))",
"let n=mul(d,1/dist);P.p=sub(P.p,mul(n,dist-r.length));let radial=dot(P.v,n),constraintSpeed=reel>0?-reel:0;if(radial>constraintSpeed){P.v=sub(P.v,mul(n,radial-constraintSpeed));r.tension=Math.max(0,radial-constraintSpeed)/dt;}":"let n=mul(d,1/dist);P.p=sub(P.p,mul(n,dist-r.length));let radial=dot(P.v,n),constraintSpeed=reel>0?-reel:0;if(radial>constraintSpeed){P.v=sub(P.v,mul(n,radial-constraintSpeed));r.tension=Math.max(0,radial-constraintSpeed)/dt;}let tangent=unit(sub(P.v,mul(n,dot(P.v,n))));P.v=add(P.v,mul(tangent,1.35*dt));",
"if(P.v[1]>3&&speed>20)":"if(P.v[1]>4.5&&speed>24)",
"let rx=swing?clamp(P.v[1]/50,-.65,.55):.6-clamp(P.v[1]/38,-.7,.7)":"let rx=swing?clamp(P.v[1]/42,-.78,.62):.72-clamp(P.v[1]/32,-.85,.85)"
}
for a,b in repls.items():
    if a not in s: raise SystemExit('missing patch string: '+a[:80])
    s=s.replace(a,b)
p.write_text(s)
print('Applied grounded Spider-Man weight pass')
