"""Second pass from reviewed browser captures: stable lights, distance LOD and compact UI."""
from pathlib import Path
r=Path(__file__).resolve().parent
p=r.parent/'games/web-swing/index.html'
s=p.read_text()
assert 'farBlocks=new Map' not in s
s=s.replace('keys=new Set(),blocks=new Map();','keys=new Set(),blocks=new Map(),farBlocks=new Map();')
s=s.replace('if(Math.abs(b.ix-ix)>2||Math.abs(b.iz-iz)>2)blocks.delete(k);','if(Math.abs(b.ix-ix)>2||Math.abs(b.iz-iz)>2){farBlocks.set(k,b);blocks.delete(k);}')
s=s.replace('if(!blocks.has(k))blocks.set(k,makeBlock(x,z))','if(!blocks.has(k)){blocks.set(k,farBlocks.get(k)||makeBlock(x,z));farBlocks.delete(k)}')
a=s.index(' // Distant silhouettes fill');b=s.index('for(let b of blocks.values()){buildings.push',a)
s=s[:a]+''' // Distance LOD uses the exact same seeded footprints and heights as near chunks.
 const farWanted=new Set();
 for(let dx=-4;dx<=4;dx++)for(let dz=-4;dz<=4;dz++){
  if(Math.abs(dx)<=2&&Math.abs(dz)<=2)continue;
  const gx=ix+dx,gz=iz+dz,k=gx+','+gz;farWanted.add(k);
  let chunk=farBlocks.get(k);if(!chunk){chunk=makeBlock(gx,gz);farBlocks.set(k,chunk)}
  for(const b of chunk.bs){const base=b.base||0;city.box([b.x,(base+b.h)/2,b.z],[b.w,b.h-base,b.d],b.col,1,b.seed,b.style)}
 }
 for(const k of farBlocks.keys())if(!farWanted.has(k))farBlocks.delete(k);
 '''+s[b:]
s=s.replace("blocks.clear();centerKey='';", "blocks.clear();farBlocks.clear();centerKey='';")
s=s.replace('chunks:blocks.size,cars:', 'chunks:blocks.size,distantChunks:farBlocks.size,cars:')
# Interpolating per-instance seeds introduces subpixel noise before a high-frequency
# hash; explicitly flat data also keeps sign-atlas tile indices and window styles stable.
s=s.replace('out vec4 vCol,vData,vShadow;', 'flat out vec4 vCol,vData;out vec4 vShadow;')
s=s.replace('in vec4 vCol,vData,vShadow;', 'flat in vec4 vCol,vData;in vec4 vShadow;')
s=s.replace('float seed=h(floor(grid)+vData.y);', 'float seed=h(floor(grid)+floor(vData.y));')
a=s.index('<div class="lesson">');b=s.index('</div><button class="primary" id="start">',a)
s=s[:a]+'''<div class="lesson"><b>Hold WEB</b> to chain swings.<br><b>Left/right</b> aims. <b>Up</b> builds speed and height.<br><b>Release</b> to fly. <b>TRICK</b> for style. <b>ZIP</b> to pull.<br>Choose <b>Manual</b> in Pause for full control.'''+s[b:]
s=s.replace('AIM / YOUR NEXT SWING','CITY FLOW / LIVING STREETS')
s=s.replace('</style>','''h1{font-size:clamp(42px,14vw,84px);letter-spacing:-.065em}.card{margin-top:auto;margin-bottom:auto}@media(max-height:650px) and (max-width:600px){.panel{padding:20px 24px}.foot{display:none}h1{margin:18px 0}.line{margin:14px 0}.primary{margin-top:18px}.lesson{font-size:10px;line-height:1.8}}@media(max-height:520px){h1{font-size:52px;margin:12px 0}.foot{display:none}.line{margin:8px 0}.lesson{font-size:10px;line-height:1.7}}
</style>''')
p.write_text(s)
checks=r/'web_swing_flow_checks.js'
t=checks.read_text();marker=' fresh();g.input.web=true;g.attach();g.step(105);g.render();return results;'
assert marker in t
extra=''' check('powered and varied-input Flow survives additional 45-second routes',()=>{const routes=[];for(const name of ['all-up','pulse-up','alternating-aim','queued-tricks']){fresh();g.input.web=true;g.attach();let low=100,high=0;for(let i=0;i<5400&&g.state==='playing';i++){const t=i/120;g.input.y=name==='all-up'?-1:name==='pulse-up'&&t%4<1?-.7:0;if(name==='alternating-aim')g.input.x=t%8<1?(Math.floor(t/8)%2?.55:-.55):0;if(name==='queued-tricks'&&i%800===500)g.trick();g.step();low=Math.min(low,g.P.p[1]);high=Math.max(high,g.P.p[1]);}assert(g.state==='playing'&&g.stats.elapsed>44.99,name+' crashed');routes.push({name,seconds:g.stats.elapsed,distance:g.stats.distance,low,high,swings:g.stats.swingCount})}return routes});
 check('near and distant city detail levels remain bounded',()=>{fresh();let peak=0;for(let i=0;i<24;i++){g.setPosition([i%3*144,65,48+i*144]);assert(g.stats.chunks===25&&g.stats.distantChunks===56,'LOD cache grew');assert(g.stats.overflows===0,'LOD overflow');peak=Math.max(peak,g.stats.instances)}return{near:25,distant:56,peakInstances:peak}});
 check('render-interpolated controller survives a full minute of powered traversal',()=>{fresh();g.input.web=true;g.attach();for(let i=0;i<720&&g.state==='playing';i++){g.input.y=i%48<12?-.65:0;g.step(10);if(i%12===0)g.render(1,.5)}assert(g.state==='playing'&&g.stats.elapsed>59.99,'rendered controller crashed');assert(g.stats.overflows===0&&g.stats.glError===0,'render errors');return{seconds:g.stats.elapsed,distance:g.stats.distance,swings:g.stats.swingCount}});
'''
t=t.replace(marker,extra+marker);checks.write_text(t)
