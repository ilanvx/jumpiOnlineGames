// headless harness: the real game page with the server mocked (fetch) and no socket
const {chromium}=require('/home/claude/.npm-global/lib/node_modules/playwright');const fs=require('fs'),path=require('path');
const PUB='/home/claude/jumpi/public',TH=__dirname+'/three';
module.exports=async function open(query,{w=1100,h=760,init=null}={}){
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p=await b.newPage({viewport:{width:w,height:h}});
  p.on('pageerror',e=>console.log('PAGEERROR',e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))console.log('console:',m.text().slice(0,300));});
  await p.route('**/*',async r=>{const u=new URL(r.request().url());
    if(u.hostname==='cdn.jsdelivr.net'){const f=u.pathname.replace(/^\/npm\/three@0\.160\.0\//,'');const fp=path.join(TH,f);if(fs.existsSync(fp))return r.fulfill({path:fp,contentType:'text/javascript'});return r.abort();}
    if(u.hostname==='fonts.googleapis.com')return r.fulfill({status:200,contentType:'text/css',body:"@font-face{font-family:'Lilita One';src:url(http://jumpi.local/__f/lilita.ttf) format('truetype')}@font-face{font-family:'Fredoka';font-weight:300 700;src:url(http://jumpi.local/__f/fredoka.ttf) format('truetype')}"});
    if(u.hostname==='jumpi.local'&&u.pathname.startsWith('/__f/')){const f=u.pathname.endsWith('lilita.ttf')?__dirname+'/gf/ofl/lilitaone/LilitaOne-Regular.ttf':__dirname+'/gf/ofl/fredoka/Fredoka[wdth,wght].ttf';return r.fulfill({path:f,contentType:'font/ttf'});}
    if(u.hostname==='jumpi.local'){
      if(u.pathname.startsWith('/api/')){const U={id:"u1",username:"tester",coins:500,inventory:[],look:{color:1,hair:1,shirt:1,pants:1,eyes:0,glasses:-1,hat:-1,neck:-1,tag:-1,aura:-1},level:3,xp:10,role:"player"};
        let d={};const q=u.pathname;
        if(process.env.BD)U.hasBirthday=false;
        if(process.env.HB){U.birthdayToday=true;U.hasBirthday=true;}
        if(q==='/api/birthday/claim')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({coins:500,item:"hat:39",hat:"hat:39",user:{...U,coins:1000,inventory:["hat:39"]}})});
        if(q==='/api/inventory/equip')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{...U,coins:1000,inventory:["hat:39"],look:{...U.look,hat:39}}})});
        if(q==='/api/auth/birthday')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{...U,hasBirthday:true}})});
        if(q==='/api/auth/register')return r.fulfill({status:201,contentType:'application/json',body:JSON.stringify({needVerify:true,pending:"p1",email:"il••••@gmail.com",sent:true})});
        if(q==='/api/auth/verify/send')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,email:"il••••@gmail.com",wait:55})});
        if(q==='/api/auth/verify'){const b=JSON.parse(r.request().postData()||"{}");if(b.code!=="123456")return r.fulfill({status:400,contentType:'application/json',body:JSON.stringify({error:"That code isn't right. 4 tries left."})});
          return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({user:{...U,verified:true,mustVerify:false},tab:"t1"})});}
        if(q==='/api/auth/check')d={usernameTaken:false,emailTaken:false,usernameNotAllowed:false};
        else if(q.includes('/auth/me')&&process.env.NOUSER)return r.fulfill({status:401,contentType:'application/json',body:'{"user":null}'});
        else if(q.includes('/auth/me')&&process.env.MV)d={user:{...U,email:"ilan@gmail.com",mustVerify:true}};
        else if(q.includes('/auth/me')||q.includes('/auth/login'))d={user:U};else if(q.includes('/auth/accounts'))d={accounts:[]};
        else if(q==='/api/jobs/start')d={shiftId:"s1",job:"delivery",seconds:240,level:1,pay:21,tip:11,todayEarned:0,dailyCap:800};
        else if(q==='/api/jobs')d={jobs:[{id:"delivery",hired:true,xp:0,level:1,title:"New Rider",from:0,to:3,pay:21,tip:11}],todayEarned:0,dailyCap:800};
        else if(q.includes('/season'))d={season:{id:"s1",name:"G",about:"",colors:["#000","#000","#000"],endsAt:Date.now()+864e5},xp:0,tier:0,claimed:[],rewards:[],tiers:30,tierXp:100,dayXp:0,dayCap:320};
        else if(q.includes('/wheel'))d={nextAt:Date.now()+1e7,now:Date.now()};else if(q.includes('/pets'))d={pets:[],out:""};
        return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(d)});}
      let f=u.pathname==='/play'?'/index.html':u.pathname;const fp=path.join(PUB,decodeURIComponent(f));if(fs.existsSync(fp)&&fs.statSync(fp).isFile())return r.fulfill({path:fp});return r.fulfill({status:404,body:''});}
    return r.abort();});
  if(init)await p.addInitScript(init);
  await p.goto('http://jumpi.local/play'+query);
  return {b,p};};
