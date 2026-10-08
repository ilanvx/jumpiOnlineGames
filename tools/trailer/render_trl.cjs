const open=require('./game.cjs');const fs=require('fs');
(async()=>{const FPS=30,a=+process.argv[2],b=+process.argv[3],dir=process.argv[4];fs.mkdirSync(dir,{recursive:true});
  const {b:br,p}=await open('?trailer&render',{w:1280,h:720});const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.waitForFunction(()=>window.__trailer&&window.__trailer.ready,null,{timeout:180000});
  // warm up a little before the first frame
  for(let k=8;k>0;k--)await p.evaluate(x=>__trailer.frame(Math.max(0,x)),a/FPS-k/FPS);
  const t0=Date.now();
  for(let f=a;f<b;f++){await p.evaluate(x=>__trailer.frame(x),f/FPS);
    const file=`${dir}/${String(f).padStart(5,'0')}.jpg`;await p.screenshot({path:file,type:'jpeg',quality:92});
    if(f%60===0)console.log('frame',f,((Date.now()-t0)/(f-a+1)).toFixed(0),'ms/frame');}
  console.log('done',a,b,'errors',errs.slice(0,5));await br.close();})().catch(e=>{console.error(e);process.exit(1);});
