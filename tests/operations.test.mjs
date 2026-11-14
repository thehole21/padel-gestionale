import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSeed,today} from '../public/domain.js';
import {deskAction,importReservation} from '../public/operations.js';
import {DemoPlaytomicAdapter} from '../public/playtomic.js';
test('sync aggiorna il campo e mantiene il saldo per ID anche con due omonimi',async()=>{
 const state=createSeed(),club=state.clubs[0], [b]=await new DemoPlaytomicAdapter().listBookings(club.id,today());
 b.players=[{name:'Ospite',externalId:'a',amount:10,paid:false,method:'club'},{name:'Ospite',externalId:'b',amount:10,paid:false,method:'club'}];
 const saved=importReservation(state,club,b);assert.notEqual(saved.players[0].memberId,saved.players[1].memberId);
 deskAction(state,club.id,'open',{});deskAction(state,club.id,'payment',{bookingId:b.id,index:1,method:'pos'});
 const changed=importReservation(state,club,{...b,courtId:club.courts[1].id,players:b.players.slice().reverse()});
 assert.equal(changed.players[0].deskMethod,'pos');assert.equal(changed.courtId,club.courts[1].id);
 deskAction(state,club.id,'close',{});deskAction(state,club.id,'open',{});assert.notEqual(state.shifts[1].id,state.ledger[0].shiftId);
 assert.throws(()=>deskAction(state,state.clubs[1].id,'payment',{bookingId:b.id,index:0,method:'pos'}));
});

test('incassa quota ed extra, scala i tubi e registra il rientro della racchetta',()=>{
 const state=createSeed(),booking=state.bookings.find(b=>b.players.some(p=>!p.paid));
 const clubId=booking.clubId,index=booking.players.findIndex(p=>!p.paid);
 const run=(operation,p={})=>deskAction(state,clubId,operation,p);
 run('inventory-stock',{tubes:3,tubeCents:600,rentalCents:400});
 run('inventory-racket',{name:'R-01',condition:'ready'});
 const inventory=state.inventories[0],racket=inventory.rackets[0],player=booking.players[index];
 const payment={bookingId:booking.id,index,method:'pos',tubes:2,racketId:racket.id,transactionId:'sale-1'};
 run('open');
 run('payment',payment);
 assert.equal(player.paid,true);
 assert.equal(inventory.tubes,1);
 assert.equal(racket.rental.playerName,player.name);
 assert.equal(state.ledger[0].cents,Math.round(player.amount*100)+1600);
 assert.equal(state.ledger[0].shiftId,state.shifts[0].id);
 assert.equal(state.ledger[0].items.length,2);
 run('payment',payment);
 assert.equal(inventory.tubes,1);
 assert.equal(state.ledger.length,1);

 const before=structuredClone(state);
 assert.throws(()=>run('payment',{...payment,tubes:1,transactionId:'sale-2'}),/non disponibile/);
 assert.throws(()=>run('payment',{...payment,racketId:'',transactionId:'sale-2'}),/insufficienti/);
 assert.throws(()=>run('payment',{...payment,racketId:'',tubes:1,transactionId:'sale-2',method:'credit'}),/Credito/);
 assert.throws(()=>run('payment',{...payment,racketId:'',tubes:1,transactionId:'sale-2',tubeCents:100}),/prezzi/);
 assert.deepEqual(state,before);

 run('inventory-return',{racketId:racket.id,transactionId:'sale-1',condition:'maintenance'});
 assert.equal(racket.rental,undefined);
 assert.equal(racket.condition,'maintenance');
 assert.equal(inventory.tubes,1);
 assert.throws(()=>run('inventory-return',{racketId:racket.id,transactionId:'sale-1',condition:'ready'}),/già chiuso/);
 assert.throws(()=>run('payment',{...payment,tubes:0,transactionId:'sale-2'}),/non disponibile/);

 run('inventory-racket',{racketId:racket.id,name:'R-01',condition:'ready'});
 run('payment',{...payment,tubes:1,transactionId:'sale-2'});
 assert.equal(state.ledger[1].cents,1000);
 assert.equal(inventory.tubes,0);
 assert.equal(racket.rental.transactionId,'sale-2');
 assert.throws(()=>run('inventory-return',{racketId:racket.id,transactionId:'sale-1',condition:'ready'}),/già chiuso/);
 assert.equal(racket.rental.transactionId,'sale-2');
});

test('l’inventario è separato per circolo e le quote preesistenti si saldano ancora',()=>{
 const state=createSeed(),clubId=state.clubs[0].id,other=state.clubs[1].id;
 const booking=state.bookings.find(b=>b.players.some(p=>!p.paid));
 const index=booking.players.findIndex(p=>!p.paid);
 const payment={bookingId:booking.id,index,method:'cash'};
 deskAction(state,other,'inventory-stock',{tubes:10,tubeCents:600,rentalCents:0});
 deskAction(state,clubId,'open',{});
 assert.throws(()=>deskAction(state,clubId,'payment',{...payment,tubes:1}),/insufficienti/);
 deskAction(state,clubId,'payment',{...payment,method:'debt'});
 deskAction(state,clubId,'payment',payment);
 assert.equal(state.ledger[0].settled,true);
 assert.equal(state.ledger[1].cents,Math.round(booking.players[index].amount*100));
 assert.equal(state.inventories[0].tubes,10);
 assert.equal(state.inventories.length,1);
});
