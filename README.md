# Canary Dashboard — Prestatiepredictor

Het Canary Dashboard is een interactief dashboard voor Canary Productions waarmee de
verwachte prestaties van filmproducties kunnen worden ingeschat. Op basis van een IMDb-
en TMDB-dataset filtert het dashboard op type media, genre, budget en tijdsperiode en
toont het onder meer de verwachte winst per genre, de best scorende films, een geschikte
regisseur en acteur, en per film de regie en hoofdcast.

## Implementatieadvies

Omdat Gerold het dashboard zelfstandig gebruikt, is het aan te raden het dashboard te
plaatsen op een stabiele omgeving die altijd bereikbaar is, bijvoorbeeld via een
cloudservice. Zo kan Gerold het dashboard op elk moment openen zonder afhankelijk te zijn
van een lokale computer die aan moet staan.

Het dashboard werkt het beste op een desktop of laptop in een moderne browser zoals Chrome
of Edge. Voor dagelijks gebruik hoeft Gerold alleen de filters aan de linkerkant in te
stellen: genre, budget en tijdsperiode. De rest van het dashboard past zich daar
automatisch op aan. De meegeleverde video bevat een uitgebreidere uitleg.

## Lokale installatie en opstartinstructies

Wanneer het dashboard lokaal moet worden uitgevoerd, kunnen de volgende stappen worden
gevolgd:

1. Download en installeer MySQL Community Edition.
2. Maak binnen MySQL een nieuwe server/database aan.
3. Importeer de aangeleverde database vanuit het meegeleverde SQL-bestand.
4. Download en installeer de laatste versie van Node.js.
5. Clone de repository of gebruik de meegeleverde ZIP-versie van het project.
6. Open een terminal in de rootmap van het dashboard.
7. Open het bestand `.env.local` en vul hier de juiste MySQL-inloggegevens en een geldige
   TMDB API-sleutel in (gratis te krijgen via TMDB).
8. Voer het commando `npm install` uit om alle benodigde packages te installeren.
9. Start vervolgens de applicatie met het commando `npm run dev`.
10. Het dashboard is daarna bereikbaar via http://localhost:3000.
