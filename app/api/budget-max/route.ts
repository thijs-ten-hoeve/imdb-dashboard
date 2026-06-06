import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { pool } from '@/lib/db';

const getMaxBudget = unstable_cache(
  async () => {
    const [rows] = await pool.execute(
      'SELECT MAX(budget) AS maxBudget FROM title_financials WHERE budget IS NOT NULL'
    );
    const max = (rows as { maxBudget: number }[])[0]?.maxBudget ?? 1_000_000_000;
    return Number(max);
  },
  ['budget-max'],
  { revalidate: 3600 }
);

export async function GET() {
  try {
    const maxBudget = await getMaxBudget();
    return NextResponse.json({ maxBudget });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ maxBudget: 1_000_000_000 }, { status: 200 });
  }
}
