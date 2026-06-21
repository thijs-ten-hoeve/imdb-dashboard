import mysql from 'mysql2/promise';
import { NextRequest, NextResponse } from 'next/server';

// Maak initialen op dezelfde manier als de acteur-/regisseur-routes,
// zodat de avatar-fallback consistent oogt door de hele app.
function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : parts[0].substring(0, 2).toUpperCase();
}

// IMDb slaat de rolnaam op als JSON-array string, bv. ["Jake"].
// Hier maken we daar leesbare tekst van; valt netjes terug op null.
function parseCharacters(raw: string | null): string | null {
  if (!raw || raw === '\\N') return null;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const joined = arr.filter(Boolean).join(', ').trim();
      return joined || null;
    }
  } catch {
    // geen geldige JSON — gebruik de ruwe waarde, ontdaan van haakjes/quotes
  }
  const cleaned = raw.replace(/[[\]"]/g, '').trim();
  return cleaned || null;
}

export async function GET(request: NextRequest) {
  try {
    const titleId = request.nextUrl.searchParams.get('titleId');

    if (!titleId) {
      return NextResponse.json({ error: 'titleId is verplicht' }, { status: 400 });
    }

    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE || 'imdb_project',
    });

    // Regisseur(s) van de titel — DISTINCT voorkomt dubbele namen
    const [directorRows] = await connection.execute(
      `SELECT DISTINCT n.talent_id AS id, n.talent_name AS name
       FROM title_director td
       JOIN talent n ON td.talent_id = n.talent_id
       WHERE td.title_id = ?
       ORDER BY n.talent_name`,
      [titleId]
    );

    // Hoofdcast: acteurs/actrices, beste rol eerst op basis van credit-volgorde (ord).
    // Ruim genomen, want dezelfde acteur kan meerdere rollen hebben (meerdere rijen).
    const [castRows] = await connection.execute(
      `SELECT n.talent_id AS id, n.talent_name AS name, tp.characters AS characters
       FROM title_principal tp
       JOIN talent n   ON tp.talent_id   = n.talent_id
       JOIN category c ON tp.category_id = c.category_id
       WHERE tp.title_id = ? AND c.category_name IN ('actor', 'actress')
       ORDER BY tp.ord ASC
       LIMIT 20`,
      [titleId]
    );

    await connection.end();

    // Regisseurs ontdubbelen op talent_id
    const directorMap = new Map<string, { id: string; name: string; initials: string }>();
    for (const r of directorRows as { id: string; name: string }[]) {
      if (!directorMap.has(r.id)) {
        directorMap.set(r.id, { id: r.id, name: r.name, initials: initialsFromName(r.name) });
      }
    }
    const directors = Array.from(directorMap.values());

    // Cast ontdubbelen op talent_id: behoud de best gecrediteerde rij (laagste ord,
    // = eerste in de gesorteerde lijst) en voeg eventuele extra rollen samen.
    const castMap = new Map<string, { id: string; name: string; initials: string; characters: string[] }>();
    for (const r of castRows as { id: string; name: string; characters: string | null }[]) {
      const character = parseCharacters(r.characters);
      const existing = castMap.get(r.id);
      if (!existing) {
        castMap.set(r.id, {
          id: r.id,
          name: r.name,
          initials: initialsFromName(r.name),
          characters: character ? [character] : [],
        });
      } else if (character && !existing.characters.includes(character)) {
        existing.characters.push(character);
      }
    }
    const cast = Array.from(castMap.values()).slice(0, 4).map(e => ({
      id: e.id,
      name: e.name,
      initials: e.initials,
      character: e.characters.length > 0 ? e.characters.join(', ') : null,
    }));

    return NextResponse.json({ directors, cast });
  } catch (error) {
    console.error('Database error in title credits route:', error);
    return NextResponse.json({ error: 'Kan regisseur en cast niet ophalen' }, { status: 500 });
  }
}
