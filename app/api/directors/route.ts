import { NextRequest, NextResponse } from 'next/server';
import { createConnection } from '@/lib/genre-stats';

const DEFAULT_LIMIT = 5;

type Filters = {
  genre: string | null;
  startYear: number;
  endYear: number;
  minBudget: number;
  maxBudget: number;
};

function buildQuery(filters: Filters): { sql: string; params: (string | number)[] } {
  const { genre, startYear, endYear, minBudget, maxBudget } = filters;
  const params: (string | number)[] = [];

  let genreJoin = '';
  if (genre) {
    genreJoin = `JOIN title_genre tg ON td.title_id = tg.title_id
                 JOIN genre g ON tg.genre_id = g.genre_id AND g.genre_name = ?`;
    params.push(genre);
  }

  // title join voor jaar-filter
  params.push(startYear, endYear);
  // financials join voor budget-filter
  params.push(minBudget, maxBudget);

  const sql = `
    SELECT
      n.talent_id,
      n.talent_name AS name,
      n.birth_year,
      n.death_year,
      COUNT(DISTINCT td.title_id) AS filmCount,
      AVG(tf.revenue - tf.budget)  AS avgProfit,
      AVG(tr.average_rating)       AS avgRating
    FROM talent n
    JOIN title_director td ON n.talent_id = td.talent_id
    ${genreJoin}
    JOIN title t ON td.title_id = t.title_id
      AND t.start_year BETWEEN ? AND ?
    JOIN title_financials tf ON td.title_id = tf.title_id
      AND tf.budget  BETWEEN ? AND ?
      AND tf.budget  > 0
      AND tf.revenue > 0
    LEFT JOIN title_rating tr ON td.title_id = tr.title_id
    WHERE n.death_year IS NULL
    GROUP BY n.talent_id, n.talent_name, n.birth_year, n.death_year
    HAVING filmCount >= 1
    ORDER BY AVG(tf.revenue - tf.budget) DESC
    LIMIT 100
  `;

  return { sql, params };
}

function formatDirector(
  row: { talent_id: string; name: string; birth_year: number | null; death_year: number | null; filmCount: number; avgProfit: number; avgRating: number | null },
  maxAvgProfit: number,
  maxFilmCount: number
) {
  const nameParts = row.name.split(' ');
  const initials = nameParts.length > 1
    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
    : nameParts[0].substring(0, 2).toUpperCase();

  const normProfit = maxAvgProfit > 0 ? row.avgProfit / maxAvgProfit : 0;
  const normRating = row.avgRating != null ? Math.max(0, (row.avgRating - 4) / 6) : 0.5;
  const normFilms  = maxFilmCount  > 0 ? Math.min(1, row.filmCount / Math.min(maxFilmCount, 10)) : 0;

  const composite = normProfit * 0.6 + normRating * 0.3 + normFilms * 0.1;
  const score = Math.min(99, Math.max(55, Math.round(55 + composite * 44)));

  const filmLabel  = row.filmCount === 1 ? 'film' : 'films';
  const ratingText = row.avgRating != null ? `, gem. ${Number(row.avgRating).toFixed(1)} IMDb` : '';
  const profitM    = Math.round(row.avgProfit / 1_000_000);
  const bio = `${row.filmCount} ${filmLabel} — gem. €${profitM}M winst${ratingText}.`;

  return {
    id: row.talent_id,
    name: row.name,
    initials,
    score,
    genre: 'Algemeen',
    birthYear: row.birth_year,
    deathYear: row.death_year,
    bio,
    filmCount: row.filmCount,
    avgProfitM: profitM,
    avgRating: row.avgRating != null ? Number(Number(row.avgRating).toFixed(1)) : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const genre     = sp.get('genre')?.trim()   || null;
    const limit     = parseInt(sp.get('limit')  ?? String(DEFAULT_LIMIT), 10);
    const startYear = parseInt(sp.get('startYear') ?? '1970', 10);
    const endYear   = parseInt(sp.get('endYear')   ?? '2026', 10);
    const minBudget = parseInt(sp.get('minBudget') ?? '0',    10) * 1_000_000;
    const maxBudget = parseInt(sp.get('maxBudget') ?? '1000', 10) * 1_000_000;

    const { sql, params } = buildQuery({ genre, startYear, endYear, minBudget, maxBudget });

    const conn = await createConnection();
    try {
      const [rows] = await conn.execute(sql, params);
      const directors = rows as { talent_id: string; name: string; birth_year: number | null; death_year: number | null; filmCount: number; avgProfit: number; avgRating: number | null }[];

      if (directors.length === 0) return NextResponse.json([]);

      const maxAvgProfit = Math.max(...directors.map(d => d.avgProfit));
      const maxFilmCount = Math.max(...directors.map(d => d.filmCount));

      const scored = directors
        .map(d => formatDirector(d, maxAvgProfit, maxFilmCount))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return NextResponse.json(scored);
    } finally {
      await conn.end();
    }
  } catch (error) {
    console.error('Database error directors:', error);
    return NextResponse.json({ error: 'Kan geen regisseurs ophalen' }, { status: 500 });
  }
}
