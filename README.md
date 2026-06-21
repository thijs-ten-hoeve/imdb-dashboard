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
