"""Temporary final geometry and pose pass; folded into the shipped HTML."""
from pathlib import Path
path = Path(__file__).resolve().parents[1] / 'games/web-swing/index.html'
s = path.read_text()
needle = 'for(let j=0;j<grid.length-1;j++)for(let k=0;k<sides;k++)for(let q of[grid[j][k],grid[j+1][k],grid[j][k+1],grid[j][k+1],grid[j+1][k],grid[j+1][k+1]])this.vertex(q.p,q.n,q.u,q.v,tile);'
assert needle in s
caps = r'''
  // Close every swept surface. In particular, soles and fingertips must not be
  // hollow tubes when the player dives or the camera sees the feet from behind.
  for(let end of[0,1]){let j=end?rings.length-1:0,n=unit(sub(rings[j].c,rings[end?j-1:1].c));
   for(let k=0;k<sides;k++){
    this.vertex(rings[j].c,n,.5,rings[j].v,tile);
    this.vertex(grid[j][k].p,n,grid[j][k].u,rings[j].v,tile);
    this.vertex(grid[j][k+1].p,n,grid[j][k+1].u,rings[j].v,tile);
   }
  }
'''
s=s.replace(needle,needle+caps)
s=s.replace("else if(s===1)desired=vY>4?[.21,.73,.26]:[.49,.22,.14];", "else if(s===1)desired=vY>4?[.38,.86,.14]:[.70,.20,.20];")
s=s.replace("else desired=vY>4?[-.34,.02,-.24]:[-.29,-.09,-.22];", "else desired=vY>4?[-.29,-.15,-.15]:[-.40,-.09,-.25];")
s=s.replace("ik(shoulder,desired,.307,.302,[s*.7,-.5,-.65])", "ik(shoulder,desired,.307,.302,attached?[s*.3,-.2,-1]:[s*.26,-1,-.22])")
s=s.replace('let dt=Math.min(raw,.06);if(!fatal&&!manual)', 'let dt=Math.min(raw,.25);if(!fatal&&!manual)')
s=s.replace('let next=clamp(renderScale+(fps<42?-.12:fps>57?.04:0),.65,1.5)', 'let next=clamp(renderScale+(fps<25?-.25:fps<42?-.12:fps>57?.04:0),.65,1.5)')
path.write_text(s)
