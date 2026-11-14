import {importReservation,deskAction} from '../public/operations.js';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createSeed,today,addBooking} from '../public/domain.js';
import {ensureProPadel} from '../public/pro-padel.js';
import {DemoPlaytomicAdapter} from '../public/playtomic.js';
import {account} from '../public/desk-domain.js';

const env=process.env;
const db=new DatabaseSync(env.DESK_DB||'desk.sqlite');
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY,revision INTEGER NOT NULL, payload TEXT NOT NULL)');
db.prepare('INSERT OR IGNORE INTO workspace VALUES(1,0,?)').run(JSON.stringify(createSeed()));
const read=()=>{
  const row=db.prepare('SELECT revision,payload FROM workspace WHERE id=1').get();
  const state=JSON.parse(row.payload);
  ensureProPadel(state);
  return {revision:row.revision,state};
};
function save(state,revision){
  const updated=db.prepare('UPDATE workspace SET payload=?,revision=revision+1 WHERE id=1 AND revision=?').run(JSON.stringify(state),revision);
  if(!updated.changes)throw Object.assign(Error('Dati aggiornati da un’altra postazione. Ricarica e ripeti.'),{status:409});
  return revision+1;
}
async function sync(){
  const {state,revision}=read();let changed=false;
  for(const club of state.clubs){
    const incoming=await new DemoPlaytomicAdapter().listBookings(club.id,today());
    for(const booking of incoming){
      const before=JSON.stringify(state);importReservation(state,club,booking);changed ||= before!==JSON.stringify(state);
    }
  }
  if(changed)save(state,revision);
}
setInterval(()=>sync().catch(e=>console.error(e.message)),Math.max(1,Number(env.SYNC_MINUTES)||5)*60000).unref();
const live=Boolean(env.WA_TOKEN&&env.WA_SECRET&&env.WA_VERIFY&&env.WA_PHONE_ID&&env.WA_TEMPLATE&&env.WA_VERSION);
async function deliver(searchId,clubId){
  if(!live)return;
  const {state}=read(),s=state.searches?.find(x=>x.bookingId===searchId&&x.clubId===clubId);
  if(!s||s.winner)return;
  const booking=state.bookings.find(b=>b.id===searchId&&b.clubId===clubId);
  for(const id of s.ids){
    const current=read(),search=current.state.searches.find(x=>x.bookingId===searchId&&x.clubId===clubId);
    if(search.winner)break;
    const member=current.state.members.find(m=>m.id===id&&m.clubId===clubId);
    if(!member?.whatsappConsent||!member.phone||search.delivery?.[id])continue;
    search.delivery||={};search.delivery[id]='in invio';save(current.state,current.revision);
    let status='errore';
    try{const r=await fetch('https://graph.facebook.com/'+env.WA_VERSION+'/'+env.WA_PHONE_ID+'/messages',{method:'POST',headers:{Authorization:'Bearer '+env.WA_TOKEN,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:member.phone.replace(/\D/g,''),type:'template',template:{name:env.WA_TEMPLATE,language:{code:'it'},components:[{type:'body',parameters:[{type:'text',text:member.name},{type:'text',text:booking.start}]},{type:'button',sub_type:'quick_reply',index:'0',parameters:[{type:'payload',payload:searchId}]}]}})});status=r.ok?'inviato':'errore'}catch{}
    const latest=read();latest.state.searches.find(x=>x.bookingId===searchId&&x.clubId===clubId).delivery[id]=status;save(latest.state,latest.revision);
  }
}
const assets=new Set(['index.html','style.css','icon.svg','app.js','domain.js','playtomic.js','desk-domain.js','operations.js','inventory.js','pdp.js','pdp-logo.js','pro-padel.js','pro-padel-logo.png']);
const types={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml'};
createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 try{
  if(u.pathname==='/webhook'&&req.method==='GET'){if(!env.WA_VERIFY||env.WA_VERIFY!==u.searchParams.get('hub.verify_token'))return json(403,{});return res.end(u.searchParams.get('hub.challenge'))}
  const users=JSON.parse(env.DESK_USERS||'[]');
  if(env.DESK_PASSWORD)users.push({username:'desk',password:env.DESK_PASSWORD,role:'owner'});
  const principal=users.length?users.find(user=>user.password&&req.headers.authorization==='Basic '+Buffer.from(user.username+':'+user.password).toString('base64')):{role:'owner'};
  if(u.pathname.startsWith('/api/tournaments/')){
    const token=decodeURIComponent(u.pathname.split('/').pop()),data=read(),event=data.state.events.find(e=>e.token===token);
    if(!event)return json(404,{error:'Torneo non trovato'});
    if(req.method==='GET'){const club=data.state.clubs.find(c=>c.id===event.clubId);return json(200,{title:event.title,description:event.description,date:event.date,time:event.time,fee:event.fee,prize:event.prize,capacity:event.capacity,count:event.participants.length,club:{primary:club.primary,accent:club.accent,canvas:club.canvas}})}
    if(req.method!=='POST')return json(405,{});
    if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{});
    let body='';for await(const chunk of req){body+=chunk;if(body.length>4000)return json(413,{})}
    const input=JSON.parse(body),name=String(input.name||'').trim(),phone=String(input.phone||'').replace(/\D/g,'');
    if(!name||name.length>160||phone.length<8||phone.length>15||!input.consent)return json(400,{error:'Controlla nome, telefono e consenso'});
    event.registrations||=[];
    if(event.registrations.some(r=>r.phone===phone))return json(409,{error:'Numero già iscritto'});
    if(event.participants.length>=event.capacity)return json(409,{error:'Torneo completo'});
    event.participants.push(name);event.registrations.push({name,phone,created:new Date().toISOString()});
    save(data.state,data.revision);return json(200,{ok:true});
  }
  if(u.pathname!=='/webhook'&&!principal){res.writeHead(401,{'WWW-Authenticate':'Basic realm="PadelDesk"'});return res.end()}
  const scoped=()=>{const data=read();if(principal.role!=='owner'){for(const [key,value] of Object.entries(data.state))if(Array.isArray(value))data.state[key]=value.filter(x=>(key==='clubs'?x.id:x.clubId)===principal.clubId)}return {...data,live,role:principal.role}};
  if(req.method==='GET'&&u.pathname==='/api/desk')return json(200,scoped());
  if(req.method==='GET'){const name=u.pathname==='/'?'index.html':u.pathname.slice(1);if(!assets.has(name))return json(404,{});const body=await readFile(new URL('../public/'+name,import.meta.url));res.writeHead(200,{'Content-Type':name.endsWith('.png')?'image/png':types[name.split('.').pop()]+'; charset=utf-8'});return res.end(body)}
  if(req.method!=='POST')return json(405,{});
  const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>12000000)return json(413,{});chunks.push(chunk)}const raw=Buffer.concat(chunks);
  if(u.pathname==='/webhook'){
    const sig=Buffer.from(req.headers['x-hub-signature-256']||''),expected=Buffer.from('sha256='+createHmac('sha256',env.WA_SECRET||'').update(raw).digest('hex'));
    if(!live||sig.length!==expected.length||!timingSafeEqual(sig,expected))return json(403,{});
    const {state,revision}=read();let changed=false;
    for(const entry of JSON.parse(raw).entry||[])for(const change of entry.changes||[])for(const msg of change.value.messages||[]){
      if(!msg.button?.payload&&msg.text?.body?.trim().toUpperCase()!=='PRENOTO')continue;
      const matches=(state.searches||[]).filter(s=>!s.winner&&(!msg.button?.payload||msg.button.payload===s.bookingId)).flatMap(s=>state.members.filter(m=>m.clubId===s.clubId&&s.ids.includes(m.id)&&m.phone?.replace(/\D/g,'')===msg.from).map(m=>({s,m})));
      if(matches.length===1){matches[0].s.winner=matches[0].m.id;changed=true}
    }
    if(changed)save(state,revision);return json(200,{ok:true});
  }
  if(!req.headers['content-type']?.startsWith('application/json'))return json(415,{});
  const p=JSON.parse(raw);
  if(u.pathname.startsWith('/api/action/')){
    if(principal.role!=='owner'&&principal.clubId!==p.clubId)return json(403,{});
    const data=read();if(data.revision!==p.revision)return json(409,{error:'Aggiorna la pagina: dati modificati'});
    const op=u.pathname.slice('/api/action/'.length);deskAction(data.state,p.clubId,op,p,live);save(data.state,data.revision);
    if(op==='search')await deliver(p.bookingId,p.clubId);return json(200,scoped());
  }
  if(u.pathname==='/api/desk'){
    const data=read();if(data.revision!==p.revision)return json(409,{});
    for(const key of ['clubs','members','bookings','events','staff','expenses']){
      if(key==='clubs'&&principal.role!=='owner')continue;
      const incoming=p.state[key];if(!Array.isArray(incoming))throw Error('Formato non valido');
      for(const x of incoming){
        const tenant=key==='clubs'?x.id:x.clubId,old=data.state[key].find(y=>y.id===x.id);
        if(principal.role!=='owner'&&(tenant!==principal.clubId||(old&&(key==='clubs'?old.id:old.clubId)!==principal.clubId)))return json(403,{});
        if(key==='members')x.balance=old?.balance||0;
        if(key==='bookings'&&old?.source==='playtomic'){Object.assign(x,old);continue}
        if(key==='bookings')for(const player of x.players){const prior=old?.players.find(y=>y.memberId&&y.memberId===player.memberId||y.name===player.name);Object.assign(player,{paid:prior?.paid||false,deskMethod:prior?.deskMethod});}
        if(old)Object.assign(old,x);else data.state[key].push(x);
      }
    }
    return json(200,{revision:save(data.state,data.revision)})
  }
  
  json(404,{});
 }catch(e){json(e.status||400,{error:e.message})}
}).listen(Number(env.PORT||3100),(env.DESK_PASSWORD||env.DESK_USERS)?'0.0.0.0':'127.0.0.1');
