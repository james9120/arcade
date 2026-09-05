from pathlib import Path
p=Path(__file__).with_name('web_swing_browser.py')
s=p.read_text()
a="                small.screenshot(path=str(OUT / f'{name}-welcome-{width}.png'))"
assert a in s
s=s.replace(a,"""                bounds = small.evaluate('''()=>{const e=document.querySelector('#welcome h1 span'),r=document.createRange();r.selectNodeContents(e);const title=r.getBoundingClientRect(),button=document.getElementById('start').getBoundingClientRect(),eyebrow=document.querySelector('#welcome .eyebrow').getBoundingClientRect();return {left:title.left,right:title.right,top:eyebrow.top,bottom:button.bottom,width:innerWidth,height:innerHeight}}''')
                check(name, f'welcome title and start button fit {width}x{height} without scrolling', bounds['left']>=0 and bounds['right']<=bounds['width'] and bounds['top']>=0 and bounds['bottom']<=bounds['height'], bounds)
"""+a)
p.write_text(s)
