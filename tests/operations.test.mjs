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
