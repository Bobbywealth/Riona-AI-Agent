# Instagram Bot Guide

This guide provides all the necessary steps for configuring and running the Instagram Bot.

## Smart Targeting Overview

- **Feed Mode** – comment on recent posts from accounts you already follow.
- **Explore Mode** – discover trending posts directly from Instagram’s explore grid.
- **Specific User Mode** – focus on any public profile (just provide the username).
- **Hashtag Mode** – provide one or more hashtags and the bot will engage with matching posts.
- **Location Mode** – target geographic hotspots using Instagram’s `locationId/location-slug` format.
- **Competitor Followers Mode** – scrape a competitor’s followers and auto-engage with their latest posts.
- **Engagement Filters** – optionally require a minimum like or comment count before interacting so energy stays on high-performing content.

## 1. Prerequisites & File Structure

Before running the bot, ensure the project has the following structure and files:

```
├── .env              # Environment variables including IGusername and IGpassword
├── cookies/          # Directory for storing session cookies (Instagramcookies.json)
└── src/
    ├── secret/
    │   └── index.ts  # Exports Instagram credentials (IGusername and IGpassword)
    └── Agent/
        └── training/ # Directory containing training data files (PDFs, MP3s, TXT, URLs)
```

## 2. Setup Checklist

### Credentials & Secret Management
- Place your Instagram credentials in the `` file:
  ```env
  IGusername=your_instagram_username
  IGpassword=your_instagram_password
  ```
- Ensure `src/secret/index.ts` exports these credentials correctly.

### Cookie Management
- On the first run, the bot will handle cookie creation automatically and store them in `cookies/Instagramcookies.json`.
- For subsequent runs, ensure the `cookies` directory exists to allow the bot to load valid sessions.

### MongoDB Setup (choose one path)

The server refuses to start unless `MONGODB_URI` points to a reachable database. Pick whichever option fits your workflow and copy the exact commands into your terminal or assistant.

#### Option A — MongoDB Atlas (cloud, free tier)
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas) and sign in (Google/GitHub works). Click **Build a Database → Shared (M0) → Create**.
2. Pick the provider/region (defaults are fine) and finish the wizard. Wait until the cluster shows a green “Running” status.
3. In **Network Access**, add an IP rule:
   - For quick testing: `0.0.0.0/0` (allows anywhere).
   - For better security: add your current public IP (Atlas shows it in the dialog).
4. In **Database Access**, create a user (e.g., `riona_user`) with a strong password and **Read and write to any database** permission.
5. Click **Connect → Drivers**, choose Node.js 4.9+, and copy the URI. Replace `<password>` with the one you set and (optionally) change the database name at the end:
   ```
   mongodb+srv://riona_user:<password>@cluster0.xxxxx.mongodb.net/riona-ai-agent?retryWrites=true&w=majority&appName=Cluster0
   ```
6. Update `.env`:
   ```
   MONGODB_URI=mongodb+srv://riona_user:your_password@cluster0.xxxxx.mongodb.net/riona-ai-agent?retryWrites=true&w=majority&appName=Cluster0
   ```
7. Save the file, then from the project root run `npm start`. If the logs say `MongoDB connected`, you’re good.

#### Option B — Local Docker container
1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) if you haven’t already.
2. Open a terminal in the project root and start MongoDB:
   ```
   docker run -d -p 27017:27017 --name riona-mongo mongodb/mongodb-community-server:latest
   ```
   - Want persistent data across restarts? Add `-v mongodb_data:/data/db`.
3. Verify it’s running:
   ```
   docker ps --filter name=riona-mongo
   ```
4. Update `.env` with the local URI:
   ```
   MONGODB_URI=mongodb://localhost:27017/riona-ai-agent
   ```
5. Launch the bot with `npm start`. You should see `MongoDB connected` followed by the usual Instagram logs. To stop the DB later: `docker stop riona-mongo` (restart with `docker start riona-mongo`).

> Keep DB usernames/passwords and the `.env` file private. Do not commit `.env` to Git.

## 3. Agent Training Data Configuration

The bot uses training data to refine and tailor the comments it posts. In this context, "training" refers to the process where the bot:
- **Uses Input Data Types Such As:**
  - **Text Files (.txt):** Provide sample responses and templates.
  - **PDF Documents:** Contain technical documents or guidelines to improve response relevancy.
  - **Audio Files (.mp3):** Supply samples for tone and conversational style.
  - **URLs:** Allow scraping of website content for context.
- **Training Process:**
  1. Add your training files to `src/Agent/training/`.
  2. On execution, the bot processes these files to update its response generation model.
  3. The model updates periodically (e.g., weekly) as new data is added.
- **Customization:**
  - Modify the training data to adjust how the bot crafts its responses.
  - Supported formats offer flexibility in providing contextual data for improved accuracy.

## 4. Core Customization Points

### Comment Generation Engine
- **Location:** `src/Agent/schema/index.ts`
- **Details:**
  - Defines response length limits (e.g., 300 characters).
  - Sets tone rules to ensure responses are professional and empathetic.
  - Specifies banned topics or phrases, maintaining compliance with Instagram's community guidelines.

### Interaction Patterns
- **Location:** `src/client/Instagram.ts`
- **Configurable Parameters:**
  - **maxPosts:** The maximum number of posts the bot will interact with (default is 50).
  - **waitTime:** A randomized delay between interactions to mimic natural behavior.
  ```javascript
  const maxPosts = 50; // Maximum posts to process
  const waitTime = Math.floor(Math.random() * 5000) + 5000; // Delay range: 5 to 10 seconds
  ```

### Personality Configuration
- **Location:** `src/Agent/characters/`
- **Details:**
  - Customize the bot's personality by modifying JSON files.
  - Adjust vocabulary, tone, and emoji usage.
  - Set cultural reference preferences to better tailor interactions.
  - To use a new custom character:
    1. Add its JSON file to the `src/Agent/characters/` directory.
    2. Update the configuration in **`src/Agent/index.ts`**.
- **Example usage:**
  ```javascript
  // In src/Agent/index.ts:
  // Set the character file path to the custom character JSON file you created:
  const characterFile = 'src/Agent/characters/YourCustomCharacter.json';
  
  // Also, update the import statement to load your custom character:
  import character from './characters/YourCustomCharacter.json';
  ```

## 5. Running the Bot

Once the setup is complete:
1. Confirm that your credentials and training data are correctly placed.
2. Run the Instagram bot using your preferred method (e.g., via a start script or command line).
3. Monitor console logs to verify successful login and post interactions.
4. Check the `cookies/Instagramcookies.json` file after the first run for session management.

## 6. Additional Considerations

- **Safety & Rate Limiting:** The bot includes built-in delays and interaction limits to avoid spam-like behavior.
- **Proxy & Stealth Settings:** Proxy configurations and stealth plugins (configured in `src/client/Instagram.ts`) help reduce detection risks.
- **Maintenance:** Regularly update your training data in `src/Agent/training/` to keep the bot effective and engaging.
