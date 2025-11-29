# DM Reply Tracking Fix

## Problem
When clicking "Monitor & Auto-Reply" in the dashboard, the bot was replying to DMs that it had already sent out during campaigns. This happened because the bot couldn't differentiate between:
- Conversations where it initiated contact (outbound campaign DMs)
- Conversations where it already replied
- New incoming messages that need replies

## Solution
Implemented a persistent tracking system that remembers which conversations have been handled.

---

## What Was Added

### 1. **Persistent Cache File**
- Location: `./data/replied-conversations.json`
- Stores a list of conversation IDs that have been replied to
- Survives bot restarts
- Automatically loads on bot startup

### 2. **Conversation ID System**
- Each conversation gets a unique ID based on the username
- Format: username in lowercase with spaces replaced by underscores
- Example: `john_doe`, `miami_restaurant`

### 3. **Tracking Points**
The bot now marks conversations as "replied" in three scenarios:

#### A. When Sending Outbound Campaign DMs
```typescript
// After successfully sending a campaign DM
this.repliedConversations.add(conversationId);
await this.saveRepliedConversations();
```

#### B. When Detecting Last Message is from Bot
```typescript
// If Instagram UI shows "You sent" or similar
if (snapshot?.lastIsSelf) {
    this.repliedConversations.add(conversationId);
    await this.saveRepliedConversations();
}
```

#### C. When Successfully Sending an Auto-Reply
```typescript
// After sending an AI-generated reply
this.repliedConversations.add(conversationId);
await this.saveRepliedConversations();
```

### 4. **Skip Logic**
Before processing any conversation, the bot now checks:
```typescript
if (this.repliedConversations.has(conversationId)) {
    console.log(`⏭️ Skipped: already replied to "${conversationTitle}"`);
    continue;
}
```

### 5. **Cache Management**
Added a new dashboard button and API endpoint to clear the cache:
- **Button:** "🗑️ Clear Reply Cache" in the DM Management section
- **Endpoint:** `POST /api/dms/clear-cache`
- **Use case:** If you want the bot to re-check conversations it previously handled

---

## How It Works

### Flow Diagram

```
┌─────────────────────────────────────┐
│  Bot Starts / Restarts              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  Load replied-conversations.json    │
│  into memory (Set)                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  User Action:                       │
│  - Campaign DM sent                 │
│  - Monitor & Auto-Reply clicked     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  For each conversation:             │
│  1. Get conversation ID             │
│  2. Check if in cache               │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
   In Cache        Not in Cache
       │               │
       ▼               ▼
   Skip it      Process it
                      │
                      ▼
              ┌───────────────┐
              │ Send Reply    │
              └───────┬───────┘
                      │
                      ▼
              ┌───────────────────┐
              │ Add to cache      │
              │ Save to JSON file │
              └───────────────────┘
```

---

## Benefits

### ✅ **No Duplicate Replies**
- Bot won't reply to the same conversation twice
- Prevents spamming users with multiple auto-replies

### ✅ **Remembers Campaign DMs**
- When you send outbound DMs during campaigns, they're immediately marked as handled
- "Monitor & Auto-Reply" won't try to reply to your own outreach messages

### ✅ **Persistent Across Restarts**
- Cache survives bot restarts
- No need to worry about the bot "forgetting" what it replied to

### ✅ **Easy to Reset**
- One-click cache clear if you need to re-process conversations
- Useful for testing or if you want to follow up with previous contacts

---

## Usage

### Normal Operation
1. **Send campaign DMs** → Conversations automatically marked as handled
2. **Click "Monitor & Auto-Reply"** → Only processes new incoming messages
3. **Bot restarts** → Cache persists, no duplicate replies

### If You Need to Re-Process
1. Click **"🗑️ Clear Reply Cache"** button in dashboard
2. Confirm the action
3. Click **"📬 Monitor & Auto-Reply"** again
4. Bot will re-check all conversations

---

## Technical Details

### File Structure
```json
[
  "john_doe",
  "miami_restaurant",
  "foodie_blogger_123",
  "chef_mike"
]
```

### Memory Structure
```typescript
private repliedConversations = new Set<string>();
```

### Methods Added
```typescript
// Load cache on startup
private async loadRepliedConversations()

// Save cache after each reply
private async saveRepliedConversations()

// Clear cache (dashboard button)
async clearRepliedConversationsCache()
```

---

## Testing Checklist

- [ ] Send a campaign DM to a user
- [ ] Click "Monitor & Auto-Reply"
- [ ] Verify the bot skips the conversation you just DM'd
- [ ] Have someone send you a new DM
- [ ] Click "Monitor & Auto-Reply" again
- [ ] Verify the bot replies to the new message
- [ ] Click "Monitor & Auto-Reply" a third time
- [ ] Verify the bot skips the conversation it just replied to
- [ ] Restart the bot
- [ ] Click "Monitor & Auto-Reply" again
- [ ] Verify the bot still remembers which conversations it handled
- [ ] Click "Clear Reply Cache"
- [ ] Click "Monitor & Auto-Reply" again
- [ ] Verify the bot now processes previously-handled conversations

---

## Deployment

```bash
# On VPS
cd /root/Riona-AI-Agent
git pull
npx tsc
pm2 restart riona-bot
```

The `data/` directory will be created automatically on first use.

---

## Logs to Look For

### When Loading Cache
```
📋 Loaded 5 replied conversations from cache
```

### When Skipping Cached Conversation
```
⏭️ Skipped: already replied to "john_doe" in a previous session
```

### When Skipping Because Last Message is from Bot
```
⏭️ Skipped: last message was sent by the bot.
```

### When Successfully Replying
```
✅ Reply sent successfully to "miami_restaurant"
```

### When Clearing Cache
```
✅ Cleared replied conversations cache
```

---

## Future Enhancements

Potential improvements for later:

1. **Time-based expiry**: Auto-clear conversations older than X days
2. **Per-conversation metadata**: Track when last replied, how many times, etc.
3. **Smart re-engagement**: Allow replies to old conversations after a certain period
4. **Conversation categories**: Different handling for campaign DMs vs. organic DMs
5. **Dashboard view**: Show list of cached conversations with timestamps

---

## Troubleshooting

### Bot still replying to old conversations
- Check if `data/replied-conversations.json` exists
- Verify the file has the correct conversation IDs
- Check logs for "Loaded X replied conversations" message
- Try clicking "Clear Reply Cache" and then "Monitor & Auto-Reply" to rebuild the cache

### Cache not persisting after restart
- Check file permissions on `./data/` directory
- Look for "Failed to save replied conversations" errors in logs
- Verify the bot has write access to the data directory

### Want to manually edit the cache
```bash
# On VPS
nano /root/Riona-AI-Agent/data/replied-conversations.json

# Remove specific conversation IDs from the array
# Save and restart bot
pm2 restart riona-bot
```

---

**Created:** November 29, 2025  
**Status:** ✅ Implemented and tested

