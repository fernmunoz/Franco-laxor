# Francos läxor

En liten svepbar läx-app. `index.html` är startsidan där man väljer läxa,
och varje läxa ligger som en egen fil i `laxor/`.

## Så funkar det

- `assets/engine.css` och `assets/engine.js` är den delade motorn: kortstack,
  svep-navigering, sparande i webbläsaren, rättning av flervalsfrågor och
  en sammanfattning på slutet. Den är samma för alla läxor.
- Varje fil i `laxor/` innehåller bara *innehållet* för just den läxan: en
  lista av "kort" (frågor, ord, texter osv) som skickas in till
  `SwipeHomework.init({...})`.
- `index.html` listar alla läxor från `HOMEWORK_LIST` och visar hur långt
  han kommit på var och en (läses från `localStorage`).
- Namn (Franco) och dagens datum fylls i automatiskt av motorn, ingen
  startsida med fält behövs, första kortet är direkt första frågan/texten.
- På flervals-/sorteringsfrågor (`choice`, `classify`) måste man välja ett
  svar innan man kan gå vidare, så rättningen alltid hinner synas.
- Sista kortet visar vilka frågor man svarade fel på och en knapp för att
  öva på just dem i en ny liten runda (fungerar flera gånger på rad tills
  allt sitter). Den ursprungliga läxan och dess svar ändras inte av det,
  det är bara en extra övningsrunda ovanpå.

## Lägga till en ny läxa

1. Kopiera `laxor/den-mystiska-on.html` till en ny fil, t.ex. `laxor/matte-tal-1.html`
   (den har redan rätt `<head>` med manifest/ikoner/service worker ifylld, så
   den behöver du inte röra).
2. Byt ut kortlistan mot den nya läxans innehåll (se korttyperna nedan).
3. Ge den ett eget `storageKey` i `SwipeHomework.init({...})` så svaren inte
   blandas ihop med andra läxor.
4. Lägg till en rad i `HOMEWORK_LIST` i `index.html` som pekar på filen.

## Appen på hemskärmen

Sidan går att lägga till som en app-ikon på telefonen (`manifest.json` +
`service-worker.js` + ikoner i `assets/icons/`). På iPhone: öppna sidan i
Safari → Dela → "Lägg till på hemskärmen". På Android/Chrome kommer det
oftast ett förslag om det automatiskt, annars samma väg via menyn.

Lägger man till en helt ny läxfil (steg 1 ovan) fungerar den automatiskt
offline också, service workern cachar bara `index.html` + motorn i förväg,
men hämtar och cachar varje läxsida i farten första gången den öppnas.

## Korttyper motorn stödjer

| type         | Används till                                   |
|--------------|-------------------------------------------------|
| `read`       | En text att läsa                                |
| `open`       | Öppen fråga med fritextsvar                     |
| `word`       | Skriva av ett ord (för stavningsövning)         |
| `choice`     | Flervalsfråga, rättas direkt (t.ex. stavning)   |
| `classify`   | Sortera ett ord under en av flera taggar        |
| `long`       | Längre skrivuppgift med meningsräknare          |
| `checklist`  | Bockningslista att gå igenom innan man är klar  |
| `summary`    | Sista kortet – visar/skriver ut alla svar       |

Se `laxor/den-mystiska-on.html` för ett fullständigt exempel på varje typ.
