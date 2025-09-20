import type { APIRoute } from 'astro';
import { tennisApi } from '@/lib/api/tennisApi';

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const date = params.date as string;

    if (!date) {
      return new Response(
        JSON.stringify({ error: 'Date parameter is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return new Response(
        JSON.stringify({ error: 'Invalid date format. Expected YYYY-MM-DD' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate date is not too far in the past or future
    const requestedDate = new Date(date);
    const today = new Date();
    const maxPastDays = 30; // 30 days in the past
    const maxFutureDays = 14; // 14 days in the future

    const diffTime = requestedDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < -maxPastDays || diffDays > maxFutureDays) {
      return new Response(
        JSON.stringify({
          error: `Date must be within ${maxPastDays} days in the past or ${maxFutureDays} days in the future`
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Fetch matches for the specified date
    const matches = await tennisApi.getMatchesByDate(date);

    return new Response(
      JSON.stringify(matches),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=120' // 2 minutes cache
        }
      }
    );
  } catch (error) {
    console.error(`Error fetching matches for date ${params.date}:`, error);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch matches',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};