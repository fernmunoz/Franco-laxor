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

## Lägga till en ny läxa

1. Kopiera `laxor/den-mystiska-on.html` till en ny fil, t.ex. `laxor/matte-tal-1.html`.
2. Byt ut kortlistan mot den nya läxans innehåll (se korttyperna nedan).
3. Ge den ett eget `storageKey` i `SwipeHomework.init({...})` så svaren inte
   blandas ihop med andra läxor.
4. Lägg till en rad i `HOMEWORK_LIST` i `index.html` som pekar på filen.

## Korttyper motorn stödjer

| type         | Används till                                   |
|--------------|-------------------------------------------------|
| `intro`      | Startkort med namn/datum-fält                   |
| `read`       | En text att läsa                                |
| `open`       | Öppen fråga med fritextsvar                     |
| `word`       | Skriva av ett ord (för stavningsövning)         |
| `choice`     | Flervalsfråga, rättas direkt (t.ex. stavning)   |
| `classify`   | Sortera ett ord under en av flera taggar        |
| `long`       | Längre skrivuppgift med meningsräknare          |
| `checklist`  | Bockningslista att gå igenom innan man är klar  |
| `summary`    | Sista kortet – visar/skriver ut alla svar       |

Se `laxor/den-mystiska-on.html` för ett fullständigt exempel på varje typ.
