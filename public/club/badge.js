/* The level badge (the same drawing as the game's, index.html drawLevelBadge): a new shape and colours every 10 levels. */
import { RANKS, rankOf } from "/shared/levels.js";
function badgePath(x,shape){x.beginPath();
  const poly=(n,r,rot=0)=>{for(let i=0;i<n;i++){const a=rot+i/n*Math.PI*2;i?x.lineTo(Math.cos(a)*r,Math.sin(a)*r):x.moveTo(Math.cos(a)*r,Math.sin(a)*r);}x.closePath();};
  if(shape==="rounded")x.roundRect(-42,-42,84,84,22);
  else if(shape==="hexagon")poly(6,48,Math.PI/6);
  else if(shape==="star"){for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?31:52;i?x.lineTo(Math.cos(a)*r,Math.sin(a)*r+4):x.moveTo(Math.cos(a)*r,Math.sin(a)*r+4);}x.closePath();}
  else if(shape==="shield"||shape==="flame"){x.moveTo(-40,-40);x.quadraticCurveTo(0,-50,40,-40);x.lineTo(40,4);x.quadraticCurveTo(36,34,0,50);x.quadraticCurveTo(-36,34,-40,4);x.closePath();}
  else if(shape==="diamond")poly(4,52,-Math.PI/2);
  else if(shape==="gem")poly(8,48,Math.PI/8);
  else x.arc(0,shape==="crown"?6:0,shape==="wings"||shape==="crown"?38:44,0,Math.PI*2);}
function drawLevelBadge(x,lv,cx,cy,size){const R=RANKS[rankOf(lv)];x.save();x.translate(cx,cy);x.scale(size/112,size/112);x.lineJoin="round";x.lineCap="round";
  x.strokeStyle="#000";x.lineWidth=7;
  // decorations behind the badge
  if(R.shape==="wings"){x.fillStyle="#fff";[-1,1].forEach(sd=>{x.beginPath();x.moveTo(sd*26,-14);x.quadraticCurveTo(sd*62,-36,sd*58,-4);x.quadraticCurveTo(sd*56,14,sd*30,18);x.closePath();x.fill();x.stroke();});}
  if(R.shape==="flame"){x.fillStyle="#ffb21f";x.beginPath();x.moveTo(-30,-38);x.quadraticCurveTo(-34,-58,-18,-62);x.quadraticCurveTo(-14,-50,-6,-48);x.quadraticCurveTo(-4,-70,10,-72);x.quadraticCurveTo(6,-56,18,-50);x.quadraticCurveTo(28,-62,34,-54);x.quadraticCurveTo(30,-44,30,-38);x.closePath();x.fill();x.stroke();}
  if(R.shape==="crown"){x.fillStyle="#ffd23a";x.beginPath();x.moveTo(-34,-22);x.lineTo(-40,-58);x.lineTo(-18,-40);x.lineTo(0,-64);x.lineTo(18,-40);x.lineTo(40,-58);x.lineTo(34,-22);x.closePath();x.fill();x.stroke();
    x.fillStyle="#ff4f6b";[[-40,-58],[0,-64],[40,-58]].forEach(([a,b])=>{x.beginPath();x.arc(a,b,6,0,7);x.fill();x.stroke();});}
  let g;
  if(R.rainbow){g=x.createLinearGradient(-50,-50,50,50);["#ff5a5a","#ffb21f","#ffe14d","#2fd36b","#1fb6ff","#9b5cff"].forEach((c,i)=>g.addColorStop(i/5,c));}
  else{g=x.createLinearGradient(0,-50,0,50);g.addColorStop(0,"#fff");g.addColorStop(.18,R.c);g.addColorStop(1,R.e);}
  badgePath(x,R.shape);x.fillStyle=g;x.fill();x.stroke();
  // a shine and the number
  x.save();badgePath(x,R.shape);x.clip();x.fillStyle="rgba(255,255,255,.28)";x.beginPath();x.ellipse(-12,-30,30,14,-.4,0,7);x.fill();x.restore();
  const t=String(lv),fs=t.length>1?44:50;x.font=`400 ${fs}px "HeeboDisplay","Lilita One","HeeboHe","Fredoka",sans-serif`;x.textAlign="center";x.textBaseline="middle";
  const ty=(R.shape==="star"?10:R.shape==="crown"?10:4);x.lineWidth=10;x.strokeStyle="#000";x.strokeText(t,0,ty);x.fillStyle="#fff";x.fillText(t,0,ty);
  x.restore();}
const _urls = new Map();
export function levelBadgeURL(lv, px = 96) { const k = lv + ":" + px; if (_urls.has(k)) return _urls.get(k);
  const c = document.createElement("canvas"); c.width = c.height = px; drawLevelBadge(c.getContext("2d"), lv, px / 2, px / 2 + px * .06, px * .9); const u = c.toDataURL(); _urls.set(k, u); return u; }
