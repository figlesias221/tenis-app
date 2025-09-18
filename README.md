# Tennis Live

A modern tennis website built with Astro that displays live ATP rankings and match results using the SportRadar Tennis API.

## Features

- 🏆 **Live ATP Rankings** - Top 100 ATP players with points and position changes
- 🎾 **Live Matches** - Real-time scores from ATP and Challenger tournaments
- 📱 **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- 🌙 **Dark Mode** - Automatic dark/light theme switching
- ⚡ **Fast Performance** - Built with Astro for optimal loading speeds

## Technology Stack

- **Framework**: Astro v5
- **Styling**: Tailwind CSS v4
- **API**: SportRadar Tennis API
- **TypeScript**: Full type safety
- **Architecture**: API-agnostic design pattern

## Setup Instructions

### Prerequisites

- Node.js 18+ and npm
- SportRadar Tennis API key (trial version included)

### Installation

1. **Clone and install dependencies:**
   ```bash
   cd tenis-app
   npm install
   ```

2. **Configure API key:**

   The SportRadar API key is already configured in the `.env` file:
   ```
   SPORTRADAR_API_KEY=ghFUX4ygnpBf7wX2Ua6ZtTnfFWdEg0JWKQ4envGp
   ```

3. **Test API connection (optional):**
   ```bash
   node test-api.js
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   ```
   http://localhost:4321
   ```

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
tenis-app/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Header.astro     # Navigation header
│   │   ├── RankingsTable.astro  # ATP rankings table
│   │   ├── MatchCard.astro      # Match information card
│   │   └── MatchesList.astro    # List of matches
│   ├── layouts/             # Page layouts
│   │   └── Layout.astro     # Base layout
│   ├── lib/                 # Business logic
│   │   └── api/             # API abstraction layer
│   │       ├── types.ts     # TypeScript interfaces
│   │       ├── tennisApi.ts # Main API service
│   │       └── providers/
│   │           └── sportradar.ts # SportRadar implementation
│   ├── pages/               # Route pages
│   │   ├── index.astro      # Home page
│   │   ├── rankings.astro   # ATP rankings page
│   │   └── matches.astro    # Live matches page
│   ├── styles/              # Global styles
│   │   └── global.css       # Tailwind base styles
│   └── site.config.ts       # Site configuration
├── public/                  # Static assets
└── package.json
```

## API Integration

### SportRadar Tennis API

The application uses SportRadar's Tennis API v3 with the following endpoints:

- **Rankings**: `/rankings.json` - ATP player rankings
- **Live Matches**: `/schedules/live/summaries.json` - Currently live matches
- **Daily Schedule**: `/schedules/{date}/summaries.json` - Today's match schedule

### API Architecture

The application uses an API-agnostic pattern that allows easy switching between different tennis data providers:

```typescript
// Main API service
import { tennisApi } from '@/lib/api/tennisApi';

// Get ATP rankings (top 100)
const rankings = await tennisApi.getATPRankings(100);

// Get live matches
const liveMatches = await tennisApi.getLiveMatches();

// Get today's matches
const todayMatches = await tennisApi.getTodayMatches();
```

### Switching API Providers

To use a different API provider, implement the `TennisApiProvider` interface:

```typescript
class NewProvider implements TennisApiProvider {
  async getRankings(type: "ATP" | "WTA", limit?: number): Promise<Rankings> {
    // Implementation
  }

  async getLiveMatches(): Promise<LiveMatches> {
    // Implementation
  }

  async getTodayMatches(): Promise<LiveMatches> {
    // Implementation
  }
}

// Switch provider
tennisApi.setProvider(new NewProvider());
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run check` - Run Astro checks
- `npm run format` - Format code with Prettier
- `npm run lint` - Lint code with Biome

## Error Handling

The application includes comprehensive error handling:

- **API Failures**: Clear error messages with retry options
- **Network Issues**: Graceful degradation with user feedback
- **Rate Limiting**: Proper error display for API limits
- **Invalid Responses**: Type-safe error handling

## Performance

- **Server-Side Rendering**: Fast initial page loads
- **Static Generation**: Optimized for performance
- **Image Optimization**: Automatic image optimization
- **Code Splitting**: Minimal JavaScript bundles

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the existing patterns
4. Test your changes
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues with:
- **SportRadar API**: Check the [SportRadar Developer Portal](https://developer.sportradar.com/tennis)
- **Application bugs**: Create an issue in this repository
- **Feature requests**: Create an issue with the "enhancement" label