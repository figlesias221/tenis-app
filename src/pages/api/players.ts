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
      .filter((entry: any) => entry && (entry.competitor || entry.player))
      .map((entry: any) => {
        // Handle both data structures (competitor from raw API, player from processed)
        const playerData = entry.competitor || entry.player;
        return {
          id: playerData.id,
          name: playerData.name,
          country: playerData.country || playerData.nationality || 'Unknown',
          country_code: playerData.country_code || playerData.countryCode || 'XX',
          ranking: entry.rank || entry.position || 'N/A'
        };
      });

    return new Response(JSON.stringify({
      players,
      tour,
      total: players.length
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, s-maxage=3600", // 1 hour cache
        "CDN-Cache-Control": "max-age=3600",
        "Cloudflare-CDN-Cache-Control": "max-age=3600",
        "Vary": "Accept-Encoding",
        "ETag": `"players-${tour}-${limit}-${Date.now()}"`
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