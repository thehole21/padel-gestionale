export function clubInventory(state, clubId) {
  return state.inventories?.find(inventory => inventory.clubId === clubId) ||
    {clubId, tubes: 0, tubeCents: 0, rentalCents: 0, rackets: []};
}

const validPrice = cents => Number.isSafeInteger(cents) && cents > 0;
const conditions = ['ready', 'maintenance', 'retired'];

export function availableRackets(inventory) {
  return inventory.rackets.filter(racket => racket.condition === 'ready' && !racket.rental);
}

export function inventoryAction(state, clubId, operation, input) {
  const inventory = clubInventory(state, clubId);
  if (operation === 'inventory-stock') {
    const {tubes, tubeCents, rentalCents} = input;
    if (!Number.isSafeInteger(tubes) || tubes < 0 || ![tubeCents,rentalCents].every(cents => cents === 0 || validPrice(cents))) {
      throw Error('Inserisci una scorta intera e prezzi validi. Usa zero per lasciare un prezzo da impostare.');
    }
    Object.assign(inventory, {tubes, tubeCents, rentalCents});
  } else {
    const racket = inventory.rackets.find(item => item.id === input.racketId);
    if (operation === 'inventory-return') {
      if (!racket?.rental || racket.rental.transactionId !== input.transactionId) {
        throw Error('Questo noleggio è già chiuso o non è più quello attivo.');
      }
      if (!conditions.includes(input.condition)) throw Error('Stato della racchetta non valido.');
      racket.condition = input.condition;
      delete racket.rental;
      return;
    }

    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || name.length > 160 || !conditions.includes(input.condition)) {
      throw Error('Inserisci un nome o codice e uno stato valido.');
    }
    if (input.racketId && !racket) throw Error('Racchetta non trovata.');
    if (racket?.rental) throw Error('Registra il rientro prima di modificare questa racchetta.');
    if (inventory.rackets.some(item => item !== racket && item.name.toLowerCase() === name.toLowerCase())) {
      throw Error('Esiste già una racchetta con questo nome o codice.');
    }
    if (racket) Object.assign(racket, {name, condition: input.condition});
    else inventory.rackets.push({id: crypto.randomUUID(), name, condition: input.condition});
  }

  const inventories = state.inventories ||= [];
  if (!inventories.includes(inventory)) inventories.push(inventory);
}

export function prepareExtras(state, clubId, {tubes = 0, racketId = '', tubeCents, rentalCents}) {
  if (!Number.isSafeInteger(tubes) || tubes < 0 || typeof racketId !== 'string') {
    throw Error('Controlla gli extra selezionati.');
  }
  const inventory = clubInventory(state, clubId);
  if (tubes > inventory.tubes || (tubes && !validPrice(inventory.tubeCents))) {
    throw Error('Tubi di palline insufficienti o prezzo non configurato.');
  }
  const racket = racketId ? availableRackets(inventory).find(item => item.id === racketId) : null;
  if (racketId && (!racket || !validPrice(inventory.rentalCents))) {
    throw Error('Racchetta non disponibile o prezzo di noleggio non configurato.');
  }
  if ((tubes && tubeCents !== undefined && tubeCents !== inventory.tubeCents) ||
      (racket && rentalCents !== undefined && rentalCents !== inventory.rentalCents)) {
    throw Error('I prezzi sono cambiati. Riapri il pagamento e controlla il totale.');
  }
  const lines = [];
  if (tubes) lines.push({label: 'Tubo di palline', quantity: tubes, unitCents: inventory.tubeCents});
  if (racket) lines.push({label: 'Noleggio racchetta · ' + racket.name, quantity: 1, unitCents: inventory.rentalCents});
  return {inventory, racket, tubes, lines};
}
