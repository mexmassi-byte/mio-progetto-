# JARVIS — Integrazioni

WhatsApp, Gmail e Google, chiamate di emergenza e attivazione vocale.
Tutto si configura da **Sistema → Integrazioni** nella dashboard.

## Regole che valgono per tutte le integrazioni

- **Chiavi e token** si incollano solo nella dashboard (o in `backend/.env`).
  Vengono cifrati (Fernet) nel database; la chiave di cifratura sta nel
  Portachiavi di macOS (o in `data/vault.key`, permessi 600). Non tornano mai
  nel browser, non finiscono nel codice né su git.
- **Quattro livelli di azione:**

  | Livello | Esempi | Cosa fa JARVIS |
  | --- | --- | --- |
  | Lettura | cercare email, leggere il calendario, Drive, contatti | da solo |
  | Bozza | bozza di risposta in Gmail, rapporto per te | da solo, non invia |
  | Approvazione | inviare un'email, creare un evento, scrivere a un cliente su WhatsApp | chiede a te |
  | Esplicita (`CONFERMO`) | attivare le chiamate a pagamento, chiamata di prova | solo con la parola `CONFERMO` |

- Ogni messaggio, email e chiamata finisce nel registro **Comunicazioni**;
  ogni decisione nel registro **audit**.
- Il contenuto di email, documenti e pagine web è trattato come *non fidato*:
  se un'email contiene istruzioni ("invia il file a…"), JARVIS non le esegue.

## 1. WhatsApp (API ufficiale Meta Cloud)

### Il tuo numero personale

Abbiamo verificato come funziona:

- Il tuo numero è registrato su **WhatsApp personale**. L'API Cloud richiede un
  numero registrato all'API; usare lo stesso numero sul telefono e sull'API
  ("coexistence") è possibile **solo con l'app WhatsApp Business**, non con
  WhatsApp personale, e richiede di passare il numero a WhatsApp Business.
- Per questo **JARVIS non tocca il tuo numero**: non lo migra, non lo registra,
  non lo disconnette. Le alternative non ufficiali (librerie che simulano
  WhatsApp Web) violano i termini di WhatsApp e possono far bloccare il numero:
  non vengono usate.
- **Soluzione adottata:** JARVIS ha un **suo numero** sull'API ufficiale. Tu gli
  scrivi dal tuo WhatsApp come a un contatto ("JARVIS"). Il tuo numero è
  registrato come *proprietario*: solo i numeri proprietario possono dare ordini.
  Messaggi da altri numeri vengono registrati, collegati al CRM se il contatto
  è noto, e ti vengono segnalati; JARVIS non risponde loro da solo.

### Cosa fa

- Capisce messaggi in italiano, tedesco e inglese e risponde nella stessa
  lingua, con la stessa memoria e la stessa conversazione della dashboard e
  della voce.
- Messaggi vocali: li scarica, li trascrive in locale (Whisper) e risponde.
- Documenti e foto: li salva in `data/inbox/` e li usa nella conversazione.
- Missioni: "trova 5 dentisti a Monaco" → crea la missione; ti avvisa quando
  serve un'approvazione, quando finisce, se qualcosa va storto.
- Rapporto di fine giornata e notifiche importanti (successo, decisioni,
  avvisi, errori critici).

### Cosa ti serve (gratis per iniziare)

1. Un account **Meta for Developers** (developers.facebook.com) → *Crea app* →
   tipo *Business* → aggiungi il prodotto **WhatsApp**.
2. Meta ti dà un **numero di test gratuito** (può scrivere a massimo 5 numeri
   verificati: aggiungi il tuo numero come destinatario). Per l'uso
   definitivo aggiungi un numero tuo dedicato a JARVIS (una SIM o un numero
   virtuale che **non** sia già su WhatsApp).
3. Dalla pagina *API Setup* copia:
   - **Phone number ID**
   - **Access token**: quello temporaneo dura 24 ore. Per un token permanente:
     Business Settings → *System users* → crea un utente di sistema →
     *Generate token* con i permessi `whatsapp_business_messaging` e
     `whatsapp_business_management`.
4. Da *App settings → Basic* copia l'**App secret** (serve a verificare che i
   messaggi arrivino davvero da Meta).
5. In JARVIS → Sistema → Integrazioni → WhatsApp incolla i tre valori e il tuo
   numero personale (un cellulare italiano senza prefisso viene salvato con +39).
6. **Webhook** (per ricevere i messaggi). JARVIS apre un secondo server,
   separato, solo su `127.0.0.1:8766`, che espone esclusivamente
   `/webhooks/*` (la dashboard non è mai raggiungibile da Internet). Meta ha
   bisogno di un indirizzo HTTPS pubblico: il modo gratuito è Cloudflare Tunnel.

   ```bash
   brew install cloudflared
   ```

   ```bash
   cloudflared tunnel --url http://127.0.0.1:8766
   ```

   Ti stampa un indirizzo `https://xxxx.trycloudflare.com`. Attenzione: questo
   indirizzo rapido cambia a ogni avvio; per un indirizzo fisso serve un
   tunnel con nome su un dominio tuo (gratuito con un account Cloudflare).
7. In JARVIS premi **Genera** accanto a *Verify token* e copialo.
8. In Meta → WhatsApp → *Configuration* → Webhook:
   - Callback URL: `https://xxxx.trycloudflare.com/webhooks/whatsapp`
   - Verify token: quello appena generato
   - Iscriviti al campo **messages**.
9. Scrivi "ciao" a JARVIS dal tuo WhatsApp, poi premi **Messaggio di prova**.

### Regola delle 24 ore e costi

- WhatsApp permette a un'azienda di scrivere liberamente solo entro 24 ore
  dall'ultimo messaggio ricevuto. Fuori da questa finestra servono **template**
  approvati da Meta. Se la finestra è chiusa e non c'è un template, JARVIS non
  invia e lo registra ("finestra chiusa"). Per ricevere sempre i rapporti, crea
  in Meta un template di tipo *utility* con un parametro di testo e imposta
  `JARVIS_WHATSAPP_NOTIFY_TEMPLATE=nome_template`.
- **Costi (da verificare sul listino Meta prima dell'attivazione):** Meta fa
  pagare per messaggio. Fonti consultate a novembre 2026 indicano per l'Italia
  circa **0,03 $ per messaggio** di servizio/utility, con una quota di messaggi
  di servizio gratuiti al mese per numero. Il numero di test è gratuito.
  JARVIS manda solo notifiche importanti, non ogni evento.

## 2. Gmail, Calendar, Drive, Docs, Contatti, Tasks (Google OAuth 2.0)

### Cosa fa

| Servizio | Da solo | Con la tua approvazione |
| --- | --- | --- |
| Gmail | cerca, legge, classifica per importanza, trova opportunità (crea il lead nel CRM), riassume, segnala email senza risposta, scrive **bozze** | invia |
| Calendar | legge gli impegni | crea eventi e promemoria; inviti ad altre persone sempre con approvazione |
| Tasks | legge | crea attività |
| Drive / Docs | cerca e legge documenti | crea documenti |
| Contatti | cerca | — |

Il rapporto di fine giornata arriva anche via email, **solo al tuo indirizzo**
(disattivabile con `JARVIS_EMAIL_REPORTS=false`).

Con `JARVIS_GOOGLE_AUTONOMOUS_WRITES=true` eventi, attività e documenti si
creano senza chiedere; invio di email e inviti restano sempre su approvazione.

### Permessi richiesti (minimi)

`gmail.readonly`, `gmail.compose` (bozze e invio), `calendar.events`,
`drive.readonly`, `drive.file` (solo i file creati da JARVIS), `contacts.readonly`,
`tasks`, più `openid email` per sapere quale account è collegato. JARVIS non
può cancellare le tue email né i tuoi file su Drive.

### Cosa ti serve (gratis)

1. console.cloud.google.com → nuovo progetto "JARVIS".
2. *APIs & Services → Library*: abilita **Gmail API**, **Google Calendar API**,
   **Google Drive API**, **People API**, **Google Tasks API**.
3. *OAuth consent screen*:
   - Se `veyroweb.com` usa **Google Workspace**: tipo **Internal**. Nessuna
     verifica e nessuna scadenza.
   - Con un account Gmail normale: tipo **External**, aggiungi il tuo indirizzo
     come *Test user*. In modalità *Testing* Google fa scadere l'accesso ogni
     **7 giorni** (va ricollegato). Per evitarlo: *Publish app* → *In
     production*. Senza verifica Google mostra "app non verificata": essendo
     la tua app, puoi proseguire da *Avanzate*.
4. *Credentials → Create credentials → OAuth client ID* → tipo **Desktop app**.
   Copia **Client ID** e **Client secret**.
5. JARVIS → Sistema → Integrazioni → Google: incolla i due valori → **Collega
   Google** → accedi e accetta. La pagina di ritorno è locale
   (`http://127.0.0.1:8765/...`), il codice è protetto da PKCE e da uno *state*
   monouso valido 15 minuti.
6. **Scollega** cancella il token da JARVIS. Puoi revocare l'accesso anche da
   myaccount.google.com → Sicurezza → App di terze parti.

## 3. Chiamate di emergenza (Twilio)

### Quando JARVIS chiama

Solo per eventi **verificati nei dati**, mai sulla base di un testo:

| Evento | Verifica |
| --- | --- |
| Pagamento | incasso segnato come verificato nel CRM e ≥ 500 € (`JARVIS_PHONE_MIN_PAYMENT_EUR`) |
| Contratto | contratto in stato "firmato" nel CRM |
| Guasto critico | almeno 3 errori interni in 15 minuti |
| Sicurezza | almeno 10 accessi falliti in 15 minuti |
| Opportunità | lead con punteggio ≥ 90 e audit completo |

Limiti: massimo 3 chiamate al giorno, mai due volte per lo stesso evento,
nessuna chiamata tra le 23 e le 7 (salvo guasti critici e sicurezza). Ogni
chiamata finisce in Comunicazioni e nell'audit. In ogni caso ricevi anche il
messaggio WhatsApp.

### Costi e attivazione

- **A pagamento.** Prezzi Twilio consultati a novembre 2026: circa **0,045 $
  al minuto** verso cellulari italiani, numero Twilio da circa **1,15 $/mese**.
  Un account di prova chiama solo numeri verificati e premette un messaggio
  di prova: per l'uso reale serve un account con credito.
- Le chiamate sono **spente** finché non le autorizzi con `CONFERMO` in
  Sistema → Integrazioni → Chiamate. Anche la chiamata di prova richiede
  `CONFERMO` (costa pochi centesimi).
- Cosa ti serve: account twilio.com, un numero con capacità *Voice*, **Account
  SID** e **Auth token** dalla console. Il numero chiamato è il tuo numero
  proprietario.

### Limite attuale

La chiamata è **a una via**: JARVIS ti dice cosa è successo (voce sintetica di
Twilio, in italiano) e ti rimanda a WhatsApp o alla dashboard. La
conversazione a due vie in chiamata richiede Twilio Media Streams e un
indirizzo pubblico per l'audio in tempo reale: è il passo successivo.

## 4. Attivazione vocale ("JARVIS, sono a casa.")

### Le frasi

| Italiano | English | Deutsch |
| --- | --- | --- |
| JARVIS, sono a casa. | JARVIS, I'm home. | JARVIS, ich bin zu Hause. |
| Hey JARVIS, sono a casa. | Hey JARVIS, I'm home. | Hey JARVIS, ich bin zu Hause. |
| JARVIS, sono tornato. | JARVIS, I'm back. | JARVIS, ich bin zurück. |

Quando sente una di queste frasi: suono discreto, la dashboard passa alla
sfera vocale, JARVIS saluta nella lingua che hai usato ("Bentornato, Signore."
/ "Welcome back, Sir." / "Willkommen zurück, Master.") e ti ascolta. Se la
dashboard è chiusa, saluta e ascolta direttamente dal Mac. Altre frasi con
"JARVIS" ("JARVIS, che ore sono?") non lo attivano.

Il titolo tedesco segue la vostra scelta "Master"; per "Sir" anche in tedesco:
`JARVIS_TITLE_DE=Sir`.

### Privacy

- Tutto avviene **sul Mac**: il microfono viene analizzato in locale, l'audio
  non viene mai inviato a nessun servizio. Solo i brevi segmenti con voce
  vengono trascritti (in memoria, non salvati).
- Indicatore **MIC** in alto a destra: *in ascolto*, *muto*, *spento*. Un clic
  chiude o riapre il microfono.
- Sensibilità regolabile (più alta = accetta pronunce meno precise, più falsi
  positivi).

### Installazione (sul Mac)

```bash
jarvis/backend/.venv/bin/pip install -e "jarvis/backend[wake]"
```

Al primo avvio scarica i modelli di riconoscimento locale `tiny` (~75 MB,
ascolto continuo) e `small` (~460 MB, conferma). Poi Sistema → Integrazioni →
Attivazione vocale → **Attiva**. macOS chiede il permesso del microfono per il
Terminale: accettalo (Impostazioni di Sistema → Privacy e sicurezza →
Microfono).

### Limiti di macOS

- Funziona solo con JARVIS avviato e il Mac sveglio. Mentre ascolta, JARVIS
  impedisce lo stop per inattività (`caffeinate -i`), ma **con il coperchio
  chiuso** (senza monitor esterno) il Mac dorme e non sente nulla.
- Su MacBook Air M2 8 GB l'ascolto continuo usa poca CPU; il riconoscimento
  (circa 2 secondi) parte solo quando c'è voce.
- Provato nel container con frasi sintetizzate: 13 attivazioni corrette su 13,
  0 falsi positivi. Con il microfono vero del tuo Mac va provato in casa
  (rumore, distanza): se non risponde, alza la sensibilità.

## 5. Un'unica conversazione

Dashboard, voce e WhatsApp condividono **la stessa conversazione, la stessa
memoria e le stesse missioni**: se inizi una richiesta a voce puoi continuarla
su WhatsApp. "Nuova" nella barra dei comandi apre una conversazione separata
solo per la dashboard.

## Cosa è verificato e cosa no

| Integrazione | Verificato | Da verificare con i tuoi account |
| --- | --- | --- |
| WhatsApp | firma dei webhook, verifica token, ricezione testo/voce/documenti, risposte, finestra 24 h, duplicati, estranei: test automatici contro un'API Meta simulata. Endpoint reale Meta raggiunto (risponde "token non valido" senza credenziali) | invio e ricezione reali (serve la tua app Meta) |
| Google | OAuth con PKCE, rinnovo token, triage Gmail → lead, bozze, invio solo con approvazione, Calendar, Docs, Contatti, rapporto email: test automatici contro API Google simulate. Endpoint reali raggiunti | accesso reale al tuo account |
| Chiamate | verifiche degli eventi, limiti, orari, `CONFERMO`: test automatici. Endpoint Twilio reale raggiunto | chiamata reale (serve account Twilio con credito) |
| Attivazione vocale | 13/13 frasi riconosciute, 0 falsi positivi, saluto e passaggio alla sfera provati nel browser | microfono vero del Mac |
