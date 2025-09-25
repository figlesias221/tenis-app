import type { APIRoute } from 'astro';
import { tennisApi } from '@/lib/api/tennisApi';

export const GET: APIRoute = async ({ params }) => {
  const playerId = params.id as string;

  if (!playerId) {
    return new Response(
      JSON.stringify({ error: 'Player ID parameter is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    console.log(`Fetching player profile for ID: ${playerId}`);

    const playerProfile = await tennisApi.getCompetitorProfile(playerId);

    return new Response(
      JSON.stringify(playerProfile),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600', // 1 hour cache
          'CDN-Cache-Control': 'max-age=3600',
          'Cloudflare-CDN-Cache-Control': 'max-age=3600',
          'Vary': 'Accept-Encoding',
          'ETag': `"player-${playerId}"`
        }
      }
    );
  } catch (error) {
    console.error('Player profile API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch player profile',
        details: errorMessage
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};