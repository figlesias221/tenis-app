import type { APIRoute } from 'astro';
import { tennisApi } from '@/lib/api/tennisApi';

export const GET: APIRoute = async ({ url }) => {
  try {
    const urlParams = new URLSearchParams(url.search);
    const tour = urlParams.get('tour') || 'ATP'; // Default to ATP

    console.log(`Fetching competitions for tour: ${tour}`);

    // For our dataset, we only have ATP data
    if (tour.toUpperCase() !== 'ATP') {
      return new Response(JSON.stringify({
        competitions: [],
        lastUpdated: new Date().toISOString(),
        message: 'Only ATP competitions are available in this dataset'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get competitions from our provider
    const competitions = await tennisApi.getATPCompetitions();

    return new Response(JSON.stringify(competitions), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // 1 hour cache
        'CDN-Cache-Control': 'max-age=3600',
        'Cloudflare-CDN-Cache-Control': 'max-age=3600',
        'Vary': 'Accept-Encoding',
        'ETag': `"competitions-${tour}"`
      }
    });

  } catch (error) {
    console.error('Competitions API error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return new Response(JSON.stringify({
      error: 'Failed to fetch competitions',
      details: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};