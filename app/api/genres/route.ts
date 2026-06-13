import { NextRequest, NextResponse } from 'next/server';
import { fetchGenreStats, fetchGenreStatsForRange } from '@/lib/genre-stats';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startYear = searchParams.get('startYear');
    const endYear = searchParams.get('endYear');

    const genreStats = startYear && endYear
      ? await fetchGenreStatsForRange(parseInt(startYear, 10), parseInt(endYear, 10))
      : await fetchGenreStats();

    return NextResponse.json(genreStats);
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Kan genres niet ophalen uit de database' }, { status: 500 });
  }
}
