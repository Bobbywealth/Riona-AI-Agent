# Riona AI Agent - Instagram & Twitter Bot

## Overview
Riona AI Agent is an AI-powered automation tool for Instagram and Twitter that automates social media interactions including posting, liking, and commenting. It uses Google's Gemini AI to generate engaging content and manage social media accounts efficiently.

## Project Status
Successfully imported and configured for Replit environment on November 30, 2025.

## Core Features
- **Instagram Automation**: Auto-login, post photos, like posts, and leave AI-generated comments
- **Twitter Automation**: Auto-tweet, retweet, and like tweets
- **AI-Powered Content**: Uses Google Generative AI (Gemini 2.0 Flash) for captions and comments
- **Proxy Support**: Manage multiple accounts and avoid rate limits
- **Cookie Management**: Persistent sessions across restarts
- **Web Dashboard**: Beautiful UI for managing bot activities and configurations

## Tech Stack
- **Backend**: Node.js with Express and TypeScript
- **Database**: MongoDB (optional - works with in-memory storage if not configured)
- **AI**: Google Generative AI (Gemini API)
- **Frontend**: Static HTML/CSS/JavaScript dashboard
- **Social Media**: Instagram Private API, Twitter API v2, Puppeteer

## Project Structure
```
src/
├── Agent/          # AI agent logic and training
├── api/            # API endpoints
├── client/         # Instagram and Twitter clients
├── config/         # Configuration (DB, logger, Adrian's style)
├── models/         # MongoDB models
├── routes/         # Express routes
├── services/       # Business logic
├── utils/          # Utility functions
├── app.ts          # Express app setup
└── index.ts        # Server entry point

public/
└── dashboard.html  # Web interface
```

## Environment Setup

### Required Environment Variables
- `PORT`: Server port (default: 5000)
- `GEMINI_API_KEY_1`: Google Gemini API key (at least one required for AI features)
- `SESSION_SECRET`: Session secret key
- `JWT_SECRET`: JWT secret key

### Optional Environment Variables
- `IGusername`, `IGpassword`: Instagram credentials (can set via dashboard)
- `Xusername`, `Xpassword`: Twitter credentials
- `MONGODB_URI`: MongoDB connection string (optional)
- `ENABLE_SCHEDULER`: Enable automated posting (true/false)
- `PROXY_ENABLED`, `PROXY_HOST`, `PROXY_PORT`: Proxy configuration
- Additional `GEMINI_API_KEY_2` through `GEMINI_API_KEY_50`: For API key rotation

## Running the Application

### Development
The application is configured to run automatically via the "Start Server" workflow.

The server runs on `0.0.0.0:5000` and the dashboard is accessible at the root URL.

### Build Process
```bash
npm start
```
This will:
1. Compile TypeScript to JavaScript
2. Copy character JSON files to build directory
3. Start the server

## Deployment
Configured for Replit Autoscale deployment:
- **Target**: Autoscale (stateless web application)
- **Run Command**: `npm start`
- **Port**: 5000

## Recent Changes (Nov 30, 2025)
1. Installed @types/node to fix TypeScript errors
2. Updated server to bind to 0.0.0.0:5000 for Replit compatibility
3. Created .env.example with all required variables
4. Configured workflow for automatic server startup
5. Set up deployment configuration for autoscale
6. Verified dashboard accessibility and functionality

## Key Features

### AI Persona Configuration
The bot uses "Adrian's Style" configuration (theadrianszufel) with:
- Business-casual tone
- Polish language focus
- Tourism/hospitality industry expertise
- Professional but approachable communication
- Concrete, results-oriented messaging

### Rate Limiting
Built-in safety features:
- Likes per day: 45
- Comments per day: 30
- Follows per day: 30
- Night mode breaks
- Emergency cooldown mode

### Dashboard Features
- Account management (login/logout)
- Proxy configuration
- Lead generation campaigns
- Story engagement
- Custom targeting modes
- AI-powered commenting
- Real-time status monitoring

## MongoDB (Optional)
The application works without MongoDB using in-memory storage. For persistent data:
- Set `MONGODB_URI` in environment variables
- Stores commented post tracking to avoid duplicates

## Security Notes
- All credentials should be stored as Replit secrets
- JWT tokens for dashboard authentication
- HTTP-only cookies for session management
- Proxy support for IP rotation

## Known Issues
- Minor mongoose schema warning (duplicate index on postUrl) - doesn't affect functionality
- Password fields in dashboard not contained in forms (cosmetic warning)

## Future Development
- GitHub automation (planned)
- Enhanced analytics
- Multi-account management
- Advanced scheduling features

## Support
Original project: https://github.com/david-patrick-chuks/riona-ai-agent
Developer: David Patrick (@david_patrick01)
