export function account(state, clubId, player) {
  const people = state.members.filter(m => m.clubId === clubId);
  let member = people.find(m => m.id === player.memberId || (player.externalId && m.externalId === player.externalId));
  if (!member) {
    const matches = people.filter(m => m.name.trim().toLocaleLowerCase() === player.name.trim().toLocaleLowerCase());
    if (matches.length === 1) member = matches[0];
  }
  if (!member) {
    member = {id:crypto.randomUUID(), clubId, name:player.name, level:'', credits:0, phone:'', package:'Nessuno'};
    state.members.push(member);
  }
  player.memberId = member.id;
  if (player.externalId) member.externalId = player.externalId;
  return member;
}
export function outstandingDebt(state, id) {
  return (state.ledger || []).filter(t => t.memberId === id && t.method === 'debt' && !t.settled).reduce((sum,t) => sum+t.cents,0);
}
export function record(state, booking, player, method, date) {
  const member = account(state,booking.clubId,player);
  const cents = Math.round(player.amount*100);
  if (!['cash','pos','credit','debt','online'].includes(method) || !(cents>0) || player.paid) throw Error('Quota già pagata o importo non valido.');
  const ledger = state.ledger ||= [];
  const debt = ledger.find(t=>t.bookingId===booking.id && t.memberId===member.id && t.method==='debt' && !t.settled);
  if (debt && method==='debt') throw Error('Insoluto già registrato.');
  if (method==='credit' && (member.balance||0)<cents) throw Error('Credito in euro insufficiente.');
  if (method==='credit') member.balance-=cents;
  if (debt) debt.settled=true;
  ledger.push({id:crypto.randomUUID(),clubId:booking.clubId,bookingId:booking.id,memberId:member.id,cents,method,date});
  player.paid=method!=='debt';
  player.method=method==='online'?'online':'club';
  player.deskMethod=method;
}
export function candidates(state,b,min,max) {
  const hour=Number(b.start.slice(0,2));
  return state.members.filter(m=>m.clubId===b.clubId && m.level && Number(m.level)>=min && Number(m.level)<=max &&
    !b.players.some(p=>p.memberId===m.id || p.name===m.name) &&
    (m.preferredHour===hour || state.bookings.some(h=>h.clubId===b.clubId && h.date<=b.date && h.status!=='cancelled' && Number(h.start.slice(0,2))===hour && h.players.some(p=>p.memberId===m.id || p.name===m.name))));
}
