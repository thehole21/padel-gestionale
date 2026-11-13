import {pdpLogo} from './pdp-logo.js';
export function ensurePdp(state){
 if(state.clubs.some(c=>c.id==='pdp'))return;
 const courts=Array.from({length:6},(_,i)=>({id:'pdp-'+(i+1),name:'Campo '+(i+1),type:[0,1,2,5].includes(i)?'Coperto':'Scoperto',price:[0,1,2,5].includes(i)?12:10}));
 state.clubs.push({id:'pdp',name:'Parco Dei Pini',city:'',initials:'PDP',primary:'#063c99',accent:'#ffe600',canvas:'#ffffff',logo:pdpLogo,loginLogo:pdpLogo,courts});
 for(const name of ['Max','Federico'])state.staff.push({id:'pdp-'+name.toLowerCase(),clubId:'pdp',name,role:'Maestro',phone:''});
}
