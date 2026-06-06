import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { pool } from '@/lib/db';

const DEFAULT_LIMIT = 120;
const SEARCH_LIMIT = 80;

function formatActor(row: { talent_id: string; name: string; birth_year: number | null; death_year: number | null; roleCount: number; primaryGenre: string | null }, maxRoleCount: number) {
  const nameParts = row.name.split(' ');
  const initials = nameParts.length > 1
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : nameParts[0].substring(0, 2).toUpperCase();

  const prominence = maxRoleCount > 0 ? row.roleCount / maxRoleCount : 0;
  const score = Math.min(99, Math.max(55, Math.round(55 + prominence * 44)));

  return {
    id: row.talent_id,
    name: row.name,
    initials,
    score,
    genre: row.primaryGenre || 'Algemeen',
    birthYear: row.birth_year,
    deathYear: row.death_year,
    bio: `Gerenommeerd talent met ${row.roleCount} geregistreerde producties in de database. Bekend om sterke vertolkingen in diverse genres.`,
  };
}

async function queryActors(search: string, limit: number) {
  let query = `
    SELECT
      t.talent_id,
      t.name,
      t.birth_year,
      t.death_year,
      t.roleCount,
      (
        SELECT g.genre_name
        FROM title_principal tp2
        JOIN title_genre tg ON tp2.title_id = tg.title_id
        JOIN genre g ON tg.genre_id = g.genre_id
        WHERE tp2.talent_id = t.talent_id
        GROUP BY g.genre_name
        ORDER BY COUNT(*) DESC
        LIMIT 1
      ) AS primaryGenre
    FROM (
      SELECT
        n.talent_id,
        n.talent_name AS name,
        n.birth_year,
        n.death_year,
        COUNT(DISTINCT tp.title_id) AS roleCount
      FROM talent n
      JOIN title_principal tp ON n.talent_id = tp.talent_id
      JOIN category c ON tp.category_id = c.category_id
      WHERE c.category_name IN ('actor', 'actress')
  `;

  const params: string[] = [];

  if (search) {
    query += ` AND n.talent_name LIKE ?`;
    params.push(`%${search}%`);
  }

  query += `
      GROUP BY n.talent_id, n.talent_name, n.birth_year, n.death_year
      ORDER BY roleCount DESC
      LIMIT ${limit}
    ) AS t
    ORDER BY t.roleCount DESC;
  `;

  const [rows] = await pool.execute(query, params);
  return rows as { talent_id: string; name: string; birth_year: number | null; death_year: number | null; roleCount: number; primaryGenre: string | null }[];
}

const getCachedActors = unstable_cache(
  async () => queryActors('', DEFAULT_LIMIT),
  ['actors-default'],
  { revalidate: 300 }
);

export async function GET(request: NextRequest) {
  try {
    const search = request.nextUrl.searchParams.get('search')?.trim() ?? '';

    let actorRows;
    if (search) {
      actorRows = await queryActors(search, SEARCH_LIMIT);
    } else {
      actorRows = await getCachedActors();
    }

    const maxRoleCount = actorRows.length > 0 ? actorRows[0].roleCount : 0;
    const formattedActors = actorRows.map((row) => formatActor(row, maxRoleCount));

    return NextResponse.json(formattedActors);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Kan geen acteurs ophalen uit de database' }, { status: 500 });
  }
}
