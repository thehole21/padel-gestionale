import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createSeed,today,addBooking} from '../public/domain.js';
import {DemoPlaytomicAdapter} from '../public/playtomic.js';
import {account} from '../public/desk-domain.js';

const env=process.env;
const db=new DatabaseSync(env.DESK_DB||'desk.sqlite');
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY,revision INTEGER NOT NULL, payload TEXT NOT NULL)');
db.prepare('INSERT OR IGNORE INTO workspace VALUES(1,0,?)').run(JSON.stringify(createSeed()));
const read=()=>{const r=db.prepare('SELECT revision,payload FROM workspace WHERE id=1').get();return {revision:r.revision,state:JSON.parse(r.payload)}};
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
      if(state.bookings.some(b=>b.clubId===club.id&&b.externalId===booking.externalId))continue;
      booking.courtId=club.courts[0]?.id;
      try{addBooking(state,booking)}catch{continue}
      booking.players.forEach(p=>account(state,club.id,p));changed=true;
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
const assets=new Set(['index.html','style.css','icon.svg','app.js','domain.js','playtomic.js','desk-domain.js']);
const types={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml'};
createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 try{
  if(u.pathname==='/webhook'&&req.method==='GET'){if(!env.WA_VERIFY||env.WA_VERIFY!==u.searchParams.get('hub.verify_token'))return json(403,{});return res.end(u.searchParams.get('hub.challenge'))}
  if(u.pathname!=='/webhook'&&env.DESK_PASSWORD&&req.headers.authorization!=='Basic '+Buffer.from('desk:'+env.DESK_PASSWORD).toString('base64')){res.writeHead(401,{'WWW-Authenticate':'Basic realm="PadelDesk"'});return res.end()}
  if(req.method==='GET'&&u.pathname==='/api/desk'){return json(200,{...read(),live})}
  if(req.method==='GET'){const name=u.pathname==='/'?'index.html':u.pathname.slice(1);if(!assets.has(name))return json(404,{});const body=await readFile(new URL('../public/'+name,import.meta.url));res.writeHead(200,{'Content-Type':types[name.split('.').pop()]+'; charset=utf-8'});return res.end(body)}
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
  if(u.pathname==='/api/desk'){return json(200,{revision:save(p.state,p.revision)})}
  if(u.pathname==='/api/invites'){await deliver(p.bookingId,p.clubId);return json(200,read())}
  json(404,{});
 }catch(e){json(e.status||400,{error:e.message})}
}).listen(Number(env.PORT||3100),env.DESK_PASSWORD?'0.0.0.0':'127.0.0.1');
