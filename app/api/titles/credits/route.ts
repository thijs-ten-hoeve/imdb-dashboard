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

    // Regisseur(s) van de titel
    const [directorRows] = await connection.execute(
      `SELECT n.talent_id AS id, n.talent_name AS name
       FROM title_director td
       JOIN talent n ON td.talent_id = n.talent_id
       WHERE td.title_id = ?
       ORDER BY n.talent_name`,
      [titleId]
    );

    // Hoofdcast: acteurs/actrices, beste rol eerst op basis van credit-volgorde (ord)
    const [castRows] = await connection.execute(
      `SELECT n.talent_id AS id, n.talent_name AS name, tp.characters AS characters
       FROM title_principal tp
       JOIN talent n   ON tp.talent_id   = n.talent_id
       JOIN category c ON tp.category_id = c.category_id
       WHERE tp.title_id = ? AND c.category_name IN ('actor', 'actress')
       ORDER BY tp.ord ASC
       LIMIT 4`,
      [titleId]
    );

    await connection.end();

    const directors = (directorRows as { id: string; name: string }[]).map(r => ({
      id: r.id,
      name: r.name,
      initials: initialsFromName(r.name),
    }));

    const cast = (castRows as { id: string; name: string; characters: string | null }[]).map(r => ({
      id: r.id,
      name: r.name,
      initials: initialsFromName(r.name),
      character: parseCharacters(r.characters),
    }));

    return NextResponse.json({ directors, cast });
  } catch (error) {
    console.error('Database error in title credits route:', error);
    return NextResponse.json({ error: 'Kan regisseur en cast niet ophalen' }, { status: 500 });
  }
}
