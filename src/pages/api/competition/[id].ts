import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ params, request }) => {
  const { id } = params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Competition ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const apiKey = import.meta.env.SPORTRADAR_API_KEY;

    if (!apiKey) {
      console.error('SPORTRADAR_API_KEY environment variable is not set');
      return new Response(JSON.stringify({ error: 'API configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const response = await fetch(
      `https://api.sportradar.com/tennis/trial/v3/en/competitions/${id}/info.json`,
      {
        headers: {
          'accept': 'application/json',
          'x-api-key': apiKey
        }
      }
    );

    if (!response.ok) {
      console.error(`SportRadar API error: ${response.status} ${response.statusText}`);
      return new Response(JSON.stringify({ error: `API error: ${response.status}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=43200, s-maxage=43200', // 12 hours cache
        'CDN-Cache-Control': 'max-age=43200',
        'Cloudflare-CDN-Cache-Control': 'max-age=43200',
        'Vary': 'Accept-Encoding',
        'ETag': `"competition-${id}"`
      }
    });

  } catch (error) {
    console.error('Error fetching competition details:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch competition details' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};