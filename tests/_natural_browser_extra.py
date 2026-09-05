            # Real browser-dispatched touch on the canvas, not a direct game function call.
            render(page)
            scene_point = page.evaluate('''()=>{const g=__webswing;for(let y=.28;y<.58;y+=.05)for(let x=.10;x<.9;x+=.07){const px=innerWidth*x,py=innerHeight*y,a=g.pickScreen(px,py);if(a&&g.surfaceAnchorValid(a,135)&&document.elementFromPoint(px,py)?.id==='world')return{x:px,y:py,p:a.p}}return null}''')
            check(name, 'a visible tappable facade is available', scene_point is not None, scene_point)
            if scene_point:
                page.touchscreen.tap(scene_point['x'], scene_point['y'])
                tapped = page.evaluate('({source:__webswing.P.rope?.source,anchor:__webswing.P.rope?.a,shots:__webswing.tapControl.shots})')
                error = sum((a-b)**2 for a,b in zip(tapped.get('anchor') or [999,999,999], scene_point['p']))**.5
                check(name, 'actual touchscreen tap fires at the visible point', tapped.get('source') == 'tap' and error < .001, tapped)
                page.evaluate('window.__webswing.step(12);window.__webswing.render()')
                page.screenshot(path=str(OUT / f'{name}-tap-swing-portrait.png'))
            gestures = page.evaluate('''()=>{
              const g=__webswing;g.start();g.render();const canvas=document.getElementById('world'),pad=document.getElementById('pad'),web=document.getElementById('web'),r=pad.getBoundingClientRect();
              let q=null;for(let y=.28;y<.58&&!q;y+=.05)for(let x=.10;x<.9;x+=.07){const a=g.pickScreen(innerWidth*x,innerHeight*y);if(a&&g.surfaceAnchorValid(a,135)){q={x:innerWidth*x,y:innerHeight*y};break}}
              if(!q)return{valid:false};const event=(name,id,x,y)=>new PointerEvent(name,{pointerId:id,pointerType:'touch',bubbles:true,clientX:x,clientY:y});
              pad.dispatchEvent(event('pointerdown',601,r.left+r.width*.72,r.top+r.height*.22));
              web.dispatchEvent(event('pointerdown',602,0,0));
              canvas.dispatchEvent(event('pointerdown',603,q.x,q.y));canvas.dispatchEvent(event('pointerup',603,q.x,q.y));
              const independent=g.input.x>.2&&g.input.web&&g.P.rope?.source==='tap';
              const shots=g.tapControl.shots;
              canvas.dispatchEvent(event('pointerdown',604,q.x,q.y));canvas.dispatchEvent(event('pointermove',604,q.x+30,q.y));canvas.dispatchEvent(event('pointerup',604,q.x+30,q.y));
              const dragSuppressed=g.tapControl.shots===shots;
              canvas.dispatchEvent(event('pointerdown',605,q.x,q.y));canvas.dispatchEvent(event('pointercancel',605,q.x,q.y));
              const cancelled=g.tapControl.id===null&&g.input.web&&g.P.rope?.source==='tap';
              pad.dispatchEvent(event('pointercancel',601,0,0));const padIndependent=g.input.x===0&&g.input.web;
              web.dispatchEvent(event('pointercancel',602,0,0));
              return{valid:true,independent,dragSuppressed,cancelled,padIndependent,allReleased:!g.input.web&&!g.P.rope};
            }''')
            check(name, 'scene taps coexist with stick and WEB pointer ownership', all(gestures.values()), gestures)
            wall_fixture = "const g=window.__webswing;g.setSwingMode('MANUAL');const b=g.buildings.find(b=>!b.base&&b.x>20&&b.x<100&&b.z>25&&b.z<70);g.setPosition([b.x-b.w/2-.70,25,b.z-b.d/2+2],[.8,0,26]);g.step(36)"
            render(page, wall_fixture)
            check(name, 'wall-running draws an active blended pose', page.evaluate('!!window.__webswing.P.wall && window.__webswing.stats.glError===0'))
            page.screenshot(path=str(OUT / f'{name}-wall-run-portrait.png'))
            rotate(page, 844, 390)
            render(page, wall_fixture)
            page.screenshot(path=str(OUT / f'{name}-wall-run-landscape.png'))
            render(page)
            landscape = page.evaluate('''()=>{const g=__webswing;for(let y=.20;y<.68;y+=.08)for(let x=.10;x<.90;x+=.08){const a=g.pickScreen(innerWidth*x,innerHeight*y);if(a&&g.surfaceAnchorValid(a,135)){const p=g.project(a.p);return{error:Math.hypot(p[0]-innerWidth*x,p[1]-innerHeight*y)}}}return null}''')
            check(name, 'tap rays remain aligned after phone rotation', landscape is not None and landscape['error'] < 1.2, landscape)
            rotate(page, 390, 844)
            render(page)
