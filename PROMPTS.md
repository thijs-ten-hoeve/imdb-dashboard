# Prompts

Reconstructie van de prompts die tot dit project hebben geleid, afgeleid uit de
commitgeschiedenis. Chronologisch gegroepeerd per thema.

1. **Zet een eerste versie van het dashboard op met Next.js en koppel het aan de
   database.**
   → `Versie 1 dashboard`, `Initial commit from Create Next App`

2. **Maak het dashboard sneller en zorg dat het budgetfilter dynamisch wordt. Haal
   ook de hardcoded database-gegevens uit de code.**
   → `feat: performance improvements and dynamic budget filter`,
   `fix: remove hardcoded database credentials`

3. **Laat acteurs per genre zien in plaats van alleen het primaire genre, en maak de
   winst-per-genre grafiek meebewegen met het periodefilter.**
   → `feat: toon acteurs per genre`,
   `feat: maak winst-per-genre grafiek reageren op periodefilter`

4. **Maak de titelrij in de filmlijst klikbaar zodat hij uitklapt, en haal de trailer-
   en sluitknop weg.**
   → `feat: maak titelrij klikbaar voor uitklappen`

5. **Voeg naast de 'geschikte regisseur' kaart ook een 'geschikte acteur' kaart toe,
   met een 'meer acteurs' popover waaruit je een acteur kunt selecteren.**
   → `feat: voeg geschikte acteur kaart toe`, `feat: voeg 'meer acteurs' popover toe`,
   `feat: maak geschikte acteur selecteerbaar`

6. **Vervang de acteur-toggle door een potlood-icoon met label 'Verander', en voeg een
   info-knop toe in de acteurlijst.**
   → `feat: vervang acteur-toggle door potlood-icoon`,
   `feat: add Verander label to pencil button`, plus de bijbehorende fixes voor de
   info-popup

7. **Voeg een acteur-zoekfilter toe in de zijbalk, en maak de gezochte acteur
   automatisch de geschikte acteur (vul ook de topkaart met zijn topgenre).**
   → `feat: voeg acteur-zoekfilter toe`,
   `feat: maak gezochte acteur automatisch de geschikte acteur`,
   `feat: vul top card met topgenre`

8. **Geef de regisseur ook een 'Verander' dropdown met inline accordion, en vertaal de
   genres naar het Nederlands (bv. Fantasy → Fantasie).**
   → `feat: add director Verander dropdown`,
   `feat: Fantasy -> Fantasie, genre dropdown instead of grid`

9. **Toon de IMDb-rating in een geel badge en laat zowel de titel als de badge naar
   IMDb linken.** (gevolgd door veel finetuning van het badge-ontwerp)
   → `feat: IMDb rating in yellow badge`, plus ~8 fixes over padding/outline/styling
   van de IMDb-badge

10. **Haal de gemiddelde duur uit de database in plaats van het in de client te
    berekenen, en handel het geval af waarin er geen geldige data is.**
    → `fix: fetch avgDuration from database`,
    `fix: hide/always show avg duration card`

11. **Voeg een 'laatst bijgewerkt' tijdstempel met refreshknop toe aan de zijbalk, met
    een bevestigingstekst 'je hebt de laatste data'.**
    → `feat: add last update timestamp and refresh button`,
    `feat: add je hebt de laatste data confirmation`

12. **Maak meervoudige genre-selectie mogelijk met een OR-filter, en bereken een
    gewogen gemiddelde voor winst en duur over de geselecteerde genres.**
    → `feat: multi-genre selection with OR filter`,
    `fix: weighted average for profit and duration`

13. **Pas de winstberekening per genre aan: gebruik de echte revenue/budget-ratio,
    breng een risicokorting aan bij 3+ genres (-10% per extra genre), cap de ratio op
    3,5x en corrigeer survivorship bias.**
    → `feat: apply risk discount`, `feat: use actual revenue/budget ratio`,
    `fix: cap revenue/budget ratio at 3.5x`, `fix: correct survivorship bias`

14. **Toon de verwachte winst per genre in het genre-selectierooster, en cap de
    budget-slider op het echte maximale budget van elk genre.**
    → `feat: show projected profit per genre`,
    `feat: cap profit and budget slider at each genre's real max budget`

15. **Negeer de genres Film-Noir en News in de database-queries, maak het 'Type Media'
    filter multi-selecteerbaar met Speelfilms als standaard.**
    → `feat: ignore Film-Noir and News genres`,
    `feat: make Type Media multi-selectable`,
    `feat: default Type Media filter to Speelfilms`

16. **Style de zijbalk-header als 'Canary Productions' (Canary vet, Productions
    normaal) met een 'Prestatiepredictor' subtitel, en zet de paginatitel op 'Canary
    Dashboard'. Vervang het laad-icoon door een spinner.**
    → `feat: update sidebar header to canary`,
    `feat: apply modern sans-serif styling`, `feat: add Prestatiepredictor subtitle`,
    `feat: change page title to Canary Dashboard`,
    `feat: replace loading screen icon with spinner`

17. **Voeg een popup met de filmcredits toe (regisseur + hoofdrolspeler) en haal de
    'laatste update'-knop weg. Dedupliceer regisseurs en cast, en verplaats de TMDB
    API-key naar een environment-variabele.**
    → `feat: add movie credits popup`, `fix: dedupe directors and cast`,
    `refactor: move TMDB API key to NEXT_PUBLIC_TMDB_API_KEY`
