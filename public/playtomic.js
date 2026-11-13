// Contratto interno: NON descrive endpoint o payload ufficiali Playtomic.
// Sostituire l'adapter soltanto dopo disponibilità del contratto partner.
export class PlaytomicAdapter {
  async listBookings(_clubId, _date) { throw Error('Adapter reale non configurato.'); }
}
export class DemoPlaytomicAdapter extends PlaytomicAdapter {
  async listBookings(clubId,date) {
    return [{id:`demo-in-${clubId}-${date}`,externalId:`demo-${clubId}-${date}`,clubId,date,start:'08:00',duration:60,courtId:null,kind:'match',title:'Partita aperta · demo Playtomic',price:40,status:'confirmed',level:'2.5 – 3.5',notes:'Prenotazione simulata, nessuna chiamata esterna.',source:'playtomic',sync:'demo-imported',players:[{externalId:'demo-guest-'+clubId,email:'ospite@example.invalid',name:'Ospite demo',amount:10,paid:true,method:'online'}]}];
  }
}
