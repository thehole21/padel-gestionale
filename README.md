# padel / Club OS

Prima versione dimostrativa del gestionale per circoli di padel, personalizzabile per più clienti. Interfaccia italiana, responsive, senza dipendenze runtime. Node.js 22+.

## Avvio

```sh
npm run dev
```

Aprire http://localhost:3000. Selezionare circolo e ruolo demo. Non servono password: **questa schermata non implementa autenticazione**.

```sh
npm run check
npm test
npm run build
```

La build produce `dist/`, adatta a hosting statico. `vercel.json` contiene la configurazione di build; nessun deploy viene effettuato automaticamente da questi script.

## Funzioni disponibili

- Agenda giornaliera per campo e vista elenco; fasce 08:00–24:00; slot da 30 minuti; prenotazioni da 60/90/120 minuti; controllo sovrapposizioni; modifica e annullamento; blocchi manutenzione e lezioni.
- Quattro posti per partita, ricerca nomi dei soci, livello, quote individuali, pagato online o al circolo, saldo residuo e partite incomplete.
- Anagrafiche soci, certificati e scadenze, pacchetti e crediti modificabili manualmente.
- Cassa con registrazione manuale quote, rettifiche, spese ed esportazione CSV. I totali sono aggregati sulla data della prenotazione, non sulla data di incasso: non sono una prima nota fiscale.
- Attività e tornei sociali: data, quota, capienza, iscrizioni e rimozione iscritti. Non generano tabelloni, incassi o occupazione campi automaticamente.
- Rubrica maestri e staff; non crea account.
- Statistiche calcolate dai dati presenti, avvisi e ricerca rapida con Ctrl/Cmd+K.
- Pannello proprietario demo: creazione circoli, selezione cliente, gestione campi, loghi distinti login/dashboard (PNG/JPG/WebP, max 500 KB), colori principale/accento/sfondo ed esportazione JSON.
- Due circoli dimostrativi con dati separati nelle viste. Un nuovo circolo parte senza dati operativi.

## Persistenza e limiti

I dati sono salvati esclusivamente in `localStorage` sul browser in uso, con chiave `padel-club-os:v1`. La sessione demo è in `sessionStorage`. Non c'è database condiviso, autenticazione, isolamento di sicurezza, controllo concorrenza fra postazioni o invio di notifiche. Il proprietario e la reception sono ruoli dimostrativi selezionabili liberamente. Non inserire dati personali reali, credenziali o dati di carte. La pulizia dei dati del browser rimuove il salvataggio; l'esportazione JSON è un backup leggibile, il ripristino non è ancora implementato.

## Playtomic predisposto, senza API reali

`public/playtomic.js` contiene un contratto **interno**, non una descrizione di endpoint ufficiali:

```js
class PlaytomicAdapter {
  async listBookings(clubId, date) {}
  async upsertBooking(booking, idempotencyKey) {}
  async cancelBooking(externalId, idempotencyKey) {}
}
```

`DemoPlaytomicAdapter` non effettua richieste di rete. Il pannello può importare una prenotazione fittizia ripetibile alle 08:00 del primo campo. L'ID esterno stabile evita duplicati. Anche l'importazione verifica sovrapposizioni. Creazioni/modifiche e cancellazioni possono essere messe in coda; l'esecuzione è manuale e produce esclusivamente esiti `demo-*`. Ogni job ha circolo, ID stabile, tentativi ed errore; i retry riutilizzano la stessa chiave. I job non ancora eseguiti vengono sostituiti dall'ultima modifica. Non è un worker di produzione.

Nessuna garanzia sulla disponibilità di operazioni Playtomic: accesso partner, autorizzazioni, modello dati, vincoli di pagamento e supporto a scrittura/cancellazione devono essere verificati sul contratto ufficiale prima dell'integrazione. Non sono stati inventati endpoint né utilizzate API non ufficiali.

## Passaggi necessari prima della vendita

1. Backend e database condiviso: tenant su tutte le entità, isolamento verificato sul server, gestione timezone e importi in centesimi.
2. Accessi reali: proprietario globale, amministratore circolo, reception e maestro; autorizzazioni server, recupero password e audit degli accessi.
3. Prenotazioni transazionali: vincolo sulle sovrapposizioni, concorrenza, cancellazioni e audit; nessuna fiducia nel `clubId` passato dal browser.
4. Pagamenti reali e registro eventi immutabile, separando metodo, stato, data di incasso e fonte. Un importo dichiarato online dalla demo non è una verifica bancaria.
5. Playtomic solo dal backend: segreti protetti, mapping campi esterni, import incrementale, idempotenza persistente, webhook verificati se previsti dal partner, retry con backoff e riconciliazione dei conflitti.
6. Upload protetti e storage persistente per loghi/documenti; backup e ripristino; policy privacy, conservazione dati e consensi.
7. Verifica dei flussi con utenti del circolo e test di sicurezza prima di accogliere dati reali.

## Struttura

- `public/app.js`: interfaccia e flussi dimostrativi.
- `public/domain.js`: prenotazioni, validazioni, totali e dati di esempio.
- `public/playtomic.js`: contratto adapter e coda demo.
- `public/style.css`: design responsive, tema per circolo e movimento ridotto.
- `tests/domain.test.mjs`: collisioni, confini del circolo, pagamenti e sincronizzazione.

I font Google sono opzionali: in assenza di connessione si usano i font di sistema.
