// Contratto interno: NON descrive endpoint o payload ufficiali Playtomic.
// Sostituire l'adapter soltanto dopo disponibilità del contratto partner.
export class PlaytomicAdapter {
  async listBookings(_clubId, _date) { throw Error('Adapter reale non configurato.'); }
  async upsertBooking(_booking, _idempotencyKey) { throw Error('Adapter reale non configurato.'); }
  async cancelBooking(_externalId, _idempotencyKey) { throw Error('Adapter reale non configurato.'); }
}
export class DemoPlaytomicAdapter extends PlaytomicAdapter {
  async listBookings(clubId,date) {
    return [{id:`demo-in-${clubId}-${date}`,externalId:`demo-${clubId}-${date}`,clubId,date,start:'08:00',duration:60,courtId:null,kind:'match',title:'Partita aperta · demo Playtomic',price:40,status:'confirmed',level:'2.5 – 3.5',notes:'Prenotazione simulata, nessuna chiamata esterna.',source:'playtomic',sync:'demo-imported',players:[{name:'Ospite demo',amount:10,paid:true,method:'online'}]}];
  }
  async upsertBooking(booking,key) { return {externalId:booking.externalId||`demo-${key}`,status:'demo-sent'}; }
  async cancelBooking(externalId,_key) { return {externalId,status:'demo-cancelled'}; }
}
export function enqueue(state,booking,operation='upsert') {
  // Una nuova modifica sostituisce soltanto i job non ancora eseguiti per la stessa partita.
  state.queue=state.queue.filter(j=>!(j.clubId===booking.clubId&&j.bookingId===booking.id&&['pending','error'].includes(j.status)));
  const job={id:crypto.randomUUID(),clubId:booking.clubId,bookingId:booking.id,operation,status:'pending',attempts:0,createdAt:new Date().toISOString(),error:null};
  state.queue.push(job); booking.sync='pending'; return job;
}
export async function runQueue(state,clubId,adapter=new DemoPlaytomicAdapter()) {
  for (const job of state.queue.filter(j=>j.clubId===clubId&&['pending','error'].includes(j.status))) {
    const booking=state.bookings.find(b=>b.id===job.bookingId&&b.clubId===clubId);
    job.attempts++;
    try {
      if(!booking) throw Error('Prenotazione non trovata.');
      const result=job.operation==='cancel'?await adapter.cancelBooking(booking.externalId,job.id):await adapter.upsertBooking(booking,job.id);
      booking.externalId=result.externalId; booking.sync=result.status; job.status='demo-completed'; job.error=null;
    } catch(e) { job.status='error'; job.error=e.message; if(booking) booking.sync='error'; }
  }
}
