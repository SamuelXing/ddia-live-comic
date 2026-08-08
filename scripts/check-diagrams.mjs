/**
 * Geometry lint for the comic diagrams.
 *
 * SVG text has no auto-layout: a label that outgrows its box just spills, and
 * nothing errors. These bugs are tedious to catch by eye and trivial to catch
 * by measurement, so we render every comic and measure real getBBox() values.
 *
 * Flags: text outside the viewBox, text straddling a box it is not inside,
 * text wider than the circle it sits in, text-on-text overlap, and text struck
 * through by a line (unless an opaque plate or disc is drawn over that line).
 *
 * Usage: start the dev server, then `npm run check:diagrams`.
 * Override the origin with BASE_URL=http://localhost:5175 and the browser
 * binary with CHROME_PATH=/path/to/chrome
 */
import { chromium } from 'playwright-core';
const exe=process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const b=await chromium.launch({executablePath:exe});
const BASE=process.env.BASE_URL||'http://localhost:5173';
const slugs=['storage','replication-leader','replication-lag','replication-quorum','partitioning','transactions','distributed-troubles','consensus'];
const all=[];
for (const s of slugs){
  const p=await b.newPage({viewport:{width:1200,height:1200}});
  await p.goto(BASE+'/read/'+s,{waitUntil:'networkidle'});
  await p.waitForTimeout(250);
  const issues=await p.evaluate(()=>{
    const out=[], P=0.6; // tolerance
    const box=el=>{const b=el.getBBox();return{x:b.x,y:b.y,width:b.width,height:b.height}};
    const inter=(a,b)=>!(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
    const inside=(t,r)=>t.x>=r.x-P&&t.y>=r.y-P&&t.x+t.width<=r.x+r.width+P&&t.y+t.height<=r.y+r.height+P;
    document.querySelectorAll('.gn-diagram svg').forEach((svg,si)=>{
      const [vx,vy,vw,vh]=svg.getAttribute('viewBox').split(/\s+/).map(Number);
      const rects=[...svg.querySelectorAll('rect')].map(box);
      const circles=[...svg.querySelectorAll('circle')].map(c=>({
        cx:+c.getAttribute('cx'),cy:+c.getAttribute('cy'),r:+c.getAttribute('r')}));
      const plates=[...svg.querySelectorAll('rect')].filter(r=>(r.getAttribute('fill')||'none')!=='none').map(box);
      const discs=[...svg.querySelectorAll('circle')].filter(c=>(c.getAttribute('fill')||'none')!=='none')
        .map(c=>({cx:+c.getAttribute('cx'),cy:+c.getAttribute('cy'),r:+c.getAttribute('r')}));
      const texts=[...svg.querySelectorAll('text')].map(t=>({bb:box(t),s:t.textContent.trim().slice(0,26)}));
      texts.forEach(({bb,s:label})=>{
        if(bb.x<vx-P||bb.y<vy-P||bb.x+bb.width>vx+vw+P||bb.y+bb.height>vy+vh+P)
          out.push(`[OUT-OF-FRAME] "${label}"`);
        // straddles a rect it is not fully inside
        rects.forEach(r=>{ if(inter(bb,r)&&!inside(bb,r)) out.push(`[STRADDLES-BOX] "${label}"`); });
        // text centred in a circle must fit inside it
        const cx=bb.x+bb.width/2, cy=bb.y+bb.height/2;
        circles.forEach(c=>{
          const d=Math.hypot(cx-c.cx,cy-c.cy);
          if(d<c.r && bb.width>2*c.r-1) out.push(`[TEXT-WIDER-THAN-CIRCLE] "${label}"`);
        });
      });
      for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++)
        if(inter(texts[i].bb,texts[j].bb)) out.push(`[TEXT-OVERLAP] "${texts[i].s}" x "${texts[j].s}"`);
      svg.querySelectorAll('path,line').forEach(pa=>{
        let L=0; try{L=pa.getTotalLength()}catch{return}; if(!L) return;
        for(let d=0; d<=L; d+=Math.max(L/60,0.4)){
          const pt=pa.getPointAtLength(d);
          const hit=texts.find(t=>pt.x>t.bb.x+1&&pt.x<t.bb.x+t.bb.width-1&&pt.y>t.bb.y+1&&pt.y<t.bb.y+t.bb.height-1);
          if(hit){ const tc={x:hit.bb.x+hit.bb.width/2,y:hit.bb.y+hit.bb.height/2};
            const shielded=plates.some(pl=>inside(hit.bb,pl))
              || discs.some(dc=>Math.hypot(tc.x-dc.cx,tc.y-dc.cy)<dc.r);
            if(!shielded) out.push(`[LINE-THROUGH-TEXT] "${hit.s}"`); break; }
        }
      });
    }); return out;
  });
  [...new Set(issues)].forEach(i=>all.push(`${s} ${i}`));
  await p.close();
}
await b.close();
if(all.length){console.error('Diagram issues:\n'+all.join('\n')+`\n\n${all.length} issue(s).`);process.exit(1)}
console.log('Diagram geometry OK - no issues.')