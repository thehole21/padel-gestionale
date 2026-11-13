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

## Desk integrato

La scheda prenotazione e la cassa condividono le quote. In Giocatori e soci → Conto e preferenze si gestiscono credito in euro, insoluti, fascia oraria e consenso WhatsApp. In Partite aperte → Trova sostituto si filtrano e invitano i soci del circolo. Playtomic è in sola lettura.

La demo statica su Vercel conserva i dati nel browser e simula le risposte. Con Node 24, npm run start:desk serve la stessa interfaccia con SQLite, import periodico e webhook WhatsApp. Vedere desk/README.md.
