import {ensurePdp} from './pdp.js';
import {ensureProPadel} from './pro-padel.js';
export const uid = () => globalThis.crypto.randomUUID();
export function today() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date()); }
export function shiftDate(date, days) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); }
export function minutes(time) { const [h,m] = time.split(':').map(Number); return h*60+m; }
export function timeLabel(value) { return `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`; }
export function euro(value) { return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(value); }
export function received(booking) { return booking.players.reduce((sum,p) => sum + (p.paid ? Number(p.amount) : 0),0); }
export function outstanding(booking) { return Math.max(0, booking.price - received(booking)); }
export function validateBooking(candidate, bookings, courts) {
  if (!courts.some(c=>c.id===candidate.courtId)) throw Error('Seleziona un campo valido.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate.date) || Number.isNaN(Date.parse(candidate.date)) || new Date(candidate.date).toISOString().slice(0,10)!==candidate.date) throw Error('Data non valida.');
  if (!/^(?:[01]\d|2[0-3]):(?:00|30)$/.test(candidate.start) || minutes(candidate.start) < 8*60 || minutes(candidate.start)+candidate.duration > 24*60) throw Error('Gli orari disponibili sono dalle 08:00 alle 24:00, ogni 30 minuti.');
  if (![60,90,120].includes(candidate.duration)) throw Error('Durata non valida.');
  if (!Number.isFinite(candidate.price) || candidate.price < 0) throw Error('Importo non valido.');
  if (candidate.players.length > 4 || candidate.players.some(p=>!p.name.trim() || !Number.isFinite(p.amount) || p.amount<0 || !['online','club'].includes(p.method))) throw Error('Inserisci da zero a quattro giocatori con quote valide.');
  if (candidate.players.reduce((s,p)=>s+p.amount,0)>candidate.price+0.001) throw Error('La somma delle quote supera il prezzo della prenotazione.');
  if (candidate.kind === 'block' && candidate.price !== 0) throw Error('Un blocco campo deve avere importo zero.');
  const start = minutes(candidate.start), end = start+candidate.duration;
  if (bookings.some(b=>b.id!==candidate.id && b.status!=='cancelled' && b.clubId===candidate.clubId && b.courtId===candidate.courtId && b.date===candidate.date && start < minutes(b.start)+b.duration && end > minutes(b.start))) throw Error('Il campo è già occupato in questa fascia oraria.');
  return candidate;
}
export function createSeed() {
  const date=today();
  const clubs=[
    { id:'aurora', name:'Aurora Padel Club', city:'Roma', initials:'AP', primary:'#192f2b', accent:'#d5fb67', canvas:'#f4f5ef', logo:'', loginLogo:'', courts:[{id:'a1',name:'Arena 01',type:'Panoramico · Indoor'},{id:'a2',name:'Arena 02',type:'Panoramico · Indoor'},{id:'a3',name:'Garden 03',type:'Outdoor'},{id:'a4',name:'Garden 04',type:'Outdoor'}] },
    { id:'riviera', name:'Riviera Padel', city:'Ostia', initials:'RP', primary:'#253950', accent:'#8eddf2', canvas:'#f1f4f7', logo:'', loginLogo:'', courts:[{id:'r1',name:'Blue 01',type:'Indoor'},{id:'r2',name:'Blue 02',type:'Outdoor'}] }
  ];
  const members=['Luca Moretti','Giulia Rossi','Marco Bianchi','Sara Conti','Andrea Ricci','Chiara Romano','Davide Greco','Elena Gallo'].map((name,i)=>({id:`m${i}`,clubId:'aurora',name,phone:`+39 333 000 ${String(1000+i)}`,level:['3.5','4.0','3.0','4.5'][i%4],certificate:shiftDate(date,i===1?-5:20+i*15),notes:'',package: i<3?'Pacchetto 10 ingressi':'Nessuno',credits:i<3?7-i:0}));
  const specs=[['a1','09:00',90,4,'lesson'],['a2','10:00',90,4,'match'],['a3','11:00',90,3,'match'],['a1','13:00',90,4,'match'],['a2','14:00',90,2,'match'],['a4','15:30',90,4,'match'],['a1','16:30',90,3,'match'],['a2','17:00',90,4,'match'],['a3','18:00',90,2,'match'],['a4','18:00',90,4,'match'],['a1','19:00',90,4,'match'],['a2','20:00',90,3,'match'],['a3','20:30',90,4,'match'],['a4','21:00',90,4,'match']];
  const bookings=specs.map(([courtId,start,duration,count,kind],i)=>({id:`b${i}`,clubId:'aurora',courtId,date,start,duration,kind,title:kind==='lesson'?'Lezione con Martina':'Partita amichevole',price:60,status:'confirmed',level:'3.0 – 4.0',notes:'',source:i%3?'club':'playtomic',externalId:i%3?null:`demo-ext-${i}`,sync:i%3?'local':'demo-imported',players:Array.from({length:count},(_,j)=>({name:members[(i+j)%members.length].name,amount:15,paid:i%3===0||j===0,method:i%3===0?'online':'club'}))}));
  for(const c of clubs){c.courts.forEach((court,index)=>court.name='Campo '+(index+1));while(c.courts.length<6)c.courts.push({id:c.id+'-court-'+(c.courts.length+1),name:'Campo '+(c.courts.length+1),type:''});}
  const result={version:1,clubs,members,bookings,expenses:[],events:[{id:'ev1',clubId:'aurora',title:'Americano del venerdì',date:shiftDate(date,7),time:'19:00',capacity:16,participants:[],fee:25}],staff:[{id:'s1',clubId:'aurora',name:'Martina De Luca',role:'Maestro',phone:'+39 333 000 2000'}],queue:[]};
  ensurePdp(result);
  ensureProPadel(result);
  return result;
}
export function addBooking(state, booking) {
  const club=state.clubs.find(c=>c.id===booking.clubId);
  if(!club) throw Error('Circolo non valido.');
  validateBooking(booking,state.bookings,club.courts);
  const existing=state.bookings.findIndex(b=>b.id===booking.id);
  if(existing<0) state.bookings.push(booking); else state.bookings[existing]=booking;
  return booking;
}
