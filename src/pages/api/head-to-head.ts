import type { APIRoute } from 'astro';
import { tennisApi } from '@/lib/api/tennisApi';

export const GET: APIRoute = async ({ url }) => {
  const searchParams = new URL(url).searchParams;
  const player1Id = searchParams.get('player1');
  const player2Id = searchParams.get('player2');

  if (!player1Id || !player2Id) {
    return new Response(
      JSON.stringify({
        error: 'Missing required parameters: player1 and player2'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    console.log(`Fetching head-to-head data for ${player1Id} vs ${player2Id}`);

    const headToHeadData = await tennisApi.getHeadToHead(player1Id, player2Id);

    return new Response(
      JSON.stringify(headToHeadData),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        }
      }
    );
  } catch (error) {
    console.error('Head-to-head API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch head-to-head data',
        details: errorMessage
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};