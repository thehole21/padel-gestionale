import {addBooking,today} from './domain.js';
import {account,record,candidates} from './desk-domain.js';

export function importReservation(state,club,incoming){
  if(incoming.clubId!==club.id || !incoming.externalId)throw Error('Prenotazione senza identità del circolo');
  const previous=state.bookings.find(b=>b.clubId===club.id&&b.externalId===incoming.externalId);
  const next={...incoming,id:previous?.id||incoming.id,courtId:incoming.courtId||club.courts[0].id};
  next.players=incoming.players.map(p=>{
    if(!p.externalId)throw Error('ID giocatore Playtomic mancante');
    const old=previous?.players.find(x=>x.externalId===p.externalId);
    return old?.deskMethod?{...p,paid:old.paid,deskMethod:old.deskMethod,amount:old.amount,method:old.method}: {...p};
  });
  addBooking(state,next);
  for(const player of next.players){const member=account(state,club.id,player);member.name=player.name;if(player.email)member.email=player.email;}
  return next;
}
export function deskAction(state,clubId,operation,p,live=false){
  const club=state.clubs.find(c=>c.id===clubId);
  if(!club)throw Error('Circolo non disponibile');
  const shifts=state.shifts||=[];let shift=shifts.find(s=>s.clubId===clubId&&!s.closed);
  if(operation==='open'){if(shift)throw Error('Turno già aperto');shifts.push({id:crypto.randomUUID(),clubId,opened:new Date().toISOString()});return;}
  if(operation==='close'){if(!shift)throw Error('Nessun turno aperto');shift.closed=new Date().toISOString();return;}
  const booking=state.bookings.find(b=>b.clubId===clubId&&b.id===p.bookingId&&b.status!=='cancelled');
  if(operation==='reply'){
    const search=state.searches?.find(s=>s.clubId===clubId&&s.bookingId===p.bookingId);
    if(live||!search||search.winner||!search.ids.includes(p.memberId))throw Error('Risposta non disponibile');
    search.winner=p.memberId;return;
  }
  if(operation==='search'){
    if(!booking||booking.kind!=='match'||booking.players.length>=4)throw Error('Partita non disponibile');
    if(!Number.isFinite(p.min)||!Number.isFinite(p.max)||p.min>p.max)throw Error('Livelli non validi');
    const searches=state.searches||=[];if(searches.some(s=>s.clubId===clubId&&s.bookingId===booking.id))throw Error('Ricerca già presente');
    const ids=candidates(state,booking,p.min,p.max).filter(m=>!live||(m.whatsappConsent&&m.phone)).map(m=>m.id);
    if(!ids.length)throw Error('Nessun candidato compatibile');
    searches.push({clubId,bookingId:booking.id,ids,winner:null});return;
  }
  if(!shift)throw Error('Apri un turno in Cassa e pagamenti');
  if(operation==='payment'){
    const player=booking?.players[p.index];if(!player)throw Error('Quota non trovata');
    record(state,booking,player,p.method,today());state.ledger.at(-1).shiftId=shift.id;return;
  }
  if(operation==='topup'){
    const m=state.members.find(x=>x.clubId===clubId&&x.id===p.memberId);
    if(!m||!Number.isSafeInteger(p.cents)||p.cents<=0)throw Error('Ricarica non valida');
    m.balance=(m.balance||0)+p.cents;(state.ledger||=[]).push({id:crypto.randomUUID(),clubId,memberId:m.id,cents:p.cents,method:'topup',date:today(),shiftId:shift.id});return;
  }
  throw Error('Operazione sconosciuta');
}
