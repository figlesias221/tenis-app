import type { APIRoute } from "astro";
import { tennisApi } from "@/lib/api/tennisApi";

export const GET: APIRoute = async ({ url }) => {
  try {
    const urlParams = new URLSearchParams(url.search);
    const tour = urlParams.get('tour') || 'ATP'; // Default to ATP
    const limit = parseInt(urlParams.get('limit') || '50'); // Get top 50 players

    let rankings;
    if (tour.toUpperCase() === 'WTA') {
      rankings = await tennisApi.getWTARankings(limit);
    } else {
      rankings = await tennisApi.getATPRankings(limit);
    }

    // Transform rankings to a simple player list
    if (!rankings || !rankings.rankings) {
      throw new Error('Invalid rankings data structure');
    }

    const players = rankings.rankings
      .filter((entry: any) => entry && entry.competitor)
      .map((entry: any) => ({
        id: entry.competitor.id,
        name: entry.competitor.name,
        country: entry.competitor.country || 'Unknown',
        country_code: entry.competitor.country_code || 'XX',
        ranking: entry.rank || entry.position || 'N/A'
      }));

    return new Response(JSON.stringify({
      players,
      tour,
      total: players.length
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    console.error('Failed to fetch players:', error);

    // Add more detailed error logging
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }

    return new Response(JSON.stringify({
      error: "Failed to fetch players",
      message: error instanceof Error ? error.message : "Unknown error",
      details: process.env.NODE_ENV === 'development' ? error : undefined
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
};