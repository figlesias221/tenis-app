// Simple test script to verify SportRadar API integration
const API_KEY = "ghFUX4ygnpBf7wX2Ua6ZtTnfFWdEg0JWKQ4envGp";
const BASE_URL = "https://api.sportradar.com/tennis/trial/v3/en";

async function testAPI() {
  console.log("Testing SportRadar Tennis API...");

  try {
    // Test rankings endpoint
    console.log("\n1. Testing Rankings endpoint...");
    const rankingsUrl = `${BASE_URL}/rankings.json`;
    console.log("URL:", rankingsUrl);

    const rankingsResponse = await fetch(rankingsUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': API_KEY
      }
    });
    console.log("Status:", rankingsResponse.status, rankingsResponse.statusText);

    if (rankingsResponse.ok) {
      const rankingsData = await rankingsResponse.json();
      console.log("Rankings data structure:", Object.keys(rankingsData));
      console.log("Sample ranking entry:", rankingsData.rankings?.[0]);

      // Get first competitor ID for profile testing
      if (rankingsData.rankings?.[0]?.competitor_rankings?.[0]?.competitor) {
        const firstCompetitor = rankingsData.rankings[0].competitor_rankings[0].competitor;
        console.log("First competitor for profile test:", firstCompetitor.id, firstCompetitor.name);

        // Test competitor profile endpoint
        console.log("\n4. Testing Competitor Profile endpoint...");
        const profileUrl = `${BASE_URL}/competitors/${firstCompetitor.id}/profile.json`;
        console.log("URL:", profileUrl);

        const profileResponse = await fetch(profileUrl, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-key': API_KEY
          }
        });
        console.log("Status:", profileResponse.status, profileResponse.statusText);

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          console.log("Profile data structure:", Object.keys(profileData));
          console.log("Full competitor object:", JSON.stringify(profileData.competitor, null, 2));
          console.log("Info object:", JSON.stringify(profileData.info, null, 2));
          console.log("Competitor rankings:", JSON.stringify(profileData.competitor_rankings, null, 2));
          console.log("Periods sample:", JSON.stringify(profileData.periods?.slice(0, 1), null, 2));
        } else {
          const errorText = await profileResponse.text();
          console.log("Profile error response:", errorText);
        }
      }
    } else {
      const errorText = await rankingsResponse.text();
      console.log("Error response:", errorText);
    }

    // Test live matches endpoint
    console.log("\n2. Testing Live Matches endpoint...");
    const liveUrl = `${BASE_URL}/schedules/live/summaries.json`;
    console.log("URL:", liveUrl);

    const liveResponse = await fetch(liveUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': API_KEY
      }
    });
    console.log("Status:", liveResponse.status, liveResponse.statusText);

    if (liveResponse.ok) {
      const liveData = await liveResponse.json();
      console.log("Live data structure:", Object.keys(liveData));
      console.log("Number of live matches:", liveData.summaries?.length || 0);
    } else {
      const errorText = await liveResponse.text();
      console.log("Error response:", errorText);
    }

    // Test today's matches endpoint
    console.log("\n3. Testing Today's Matches endpoint...");
    const today = new Date().toISOString().split('T')[0];
    const todayUrl = `${BASE_URL}/schedules/${today}/summaries.json`;
    console.log("URL:", todayUrl);

    const todayResponse = await fetch(todayUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': API_KEY
      }
    });
    console.log("Status:", todayResponse.status, todayResponse.statusText);

    if (todayResponse.ok) {
      const todayData = await todayResponse.json();
      console.log("Today data structure:", Object.keys(todayData));
      console.log("Number of today's matches:", todayData.summaries?.length || 0);
    } else {
      const errorText = await todayResponse.text();
      console.log("Error response:", errorText);
    }

  } catch (error) {
    console.error("Test failed:", error);
  }
}

testAPI();