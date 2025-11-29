# Jarvee-Style Scheduler & Session Management

## 🎯 **Goals**

1. ✅ **Stay Logged In** - Auto-refresh cookies, never lose session
2. ✅ **Visual Scheduler** - Jarvee-style dashboard to manage automation
3. ✅ **Multiple Action Types** - Like, comment, follow, DM, stories, etc.
4. ✅ **Time-based Scheduling** - Set specific times for each action
5. ✅ **Daily Limits** - Configure max actions per day/hour
6. ✅ **Activity Tracking** - See what ran and when

---

## 📋 **Features to Add**

### **1. Session Management (Stay Logged In)**

#### **A. Cookie Auto-Refresh**
- Check session every 30 minutes
- Auto-refresh cookies before they expire
- Alert if login required

#### **B. Session Health Monitor**
- Dashboard indicator: 🟢 Active / 🟡 Expiring Soon / 🔴 Expired
- Show "Session expires in: X days"
- One-click re-login button

---

### **2. Jarvee-Style Scheduler Dashboard**

#### **A. Visual Schedule Grid**
```
┌─────────────────────────────────────────────────────────┐
│  AUTOMATION SCHEDULE                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🕐 9:00 AM  │ ❤️ Like Feed Posts (20)                 │
│  🕐 11:00 AM │ 💬 Comment on Explore (10)              │
│  🕐 2:00 PM  │ 👀 Watch Stories (15)                   │
│  🕐 5:00 PM  │ 📩 Send DMs (5)                         │
│  🕐 8:00 PM  │ ❤️ Like Hashtag #miami (15)             │
│                                                         │
│  [+ Add New Schedule]                                   │
└─────────────────────────────────────────────────────────┘
```

#### **B. Schedule Configuration**
For each schedule:
- ⏰ **Time** - When to run (e.g., 9:00 AM)
- 📅 **Days** - Which days (Mon-Sun checkboxes)
- 🎯 **Action Type** - Like, Comment, Follow, DM, Stories, etc.
- 🔢 **Quantity** - How many (e.g., 20 posts)
- 🎭 **Target** - Feed, Explore, Hashtag, Location, User
- ⚙️ **Options** - AI comments, like probability, etc.
- 🔘 **Enabled** - Toggle on/off

#### **C. Quick Actions**
- ▶️ Run Now
- ⏸️ Pause All
- 🔄 Reset Limits
- 📊 View History

---

### **3. Action Types (Like Jarvee)**

| Action | Description | Options |
|--------|-------------|---------|
| ❤️ **Like Posts** | Like posts from feed/explore/hashtag | Max likes, target source |
| 💬 **Comment** | AI-powered comments | Max comments, AI tone |
| 👥 **Follow** | Follow users | Max follows, target audience |
| 👋 **Unfollow** | Unfollow non-followers | Max unfollows, whitelist |
| 📩 **Send DMs** | Campaign DMs | Max DMs, message template |
| 👀 **Watch Stories** | View & interact with stories | Max stories, AI replies |
| 📸 **Post Content** | Auto-post from queue | Image + caption |
| 🔍 **Scrape** | Collect followers/hashtags | Export to CSV |

---

### **4. Daily Limits Dashboard**

```
┌─────────────────────────────────────────────────────────┐
│  DAILY LIMITS                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ❤️ Likes:      45 / 100  [████████░░] 45%            │
│  💬 Comments:   12 / 50   [██░░░░░░░░] 24%            │
│  👥 Follows:    8 / 30    [██░░░░░░░░] 27%            │
│  📩 DMs:        3 / 20    [█░░░░░░░░░] 15%            │
│  👀 Stories:    25 / 50   [█████░░░░░] 50%            │
│                                                         │
│  Resets in: 8 hours 23 minutes                         │
└─────────────────────────────────────────────────────────┘
```

---

### **5. Activity History**

```
┌─────────────────────────────────────────────────────────┐
│  RECENT ACTIVITY                                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  12:46 PM  ✅ Liked 20 posts from feed                  │
│  12:30 PM  ✅ Watched 15 stories                        │
│  11:15 AM  ✅ Sent 5 DMs (Miami campaign)               │
│  10:00 AM  ⚠️ Comment failed (rate limit)               │
│  9:00 AM   ✅ Liked 18 posts from #miami                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 **Implementation Plan**

### **Phase 1: Session Management (30 min)**
1. Add cookie expiry checker
2. Add session health API endpoint
3. Add dashboard session indicator
4. Add auto-refresh logic

### **Phase 2: Scheduler Backend (1 hour)**
1. Create schedule storage (JSON file or DB)
2. Create CRUD API for schedules
3. Enhance cron system to support dynamic schedules
4. Add action type handlers

### **Phase 3: Scheduler Dashboard (1.5 hours)**
1. Create schedule grid UI
2. Add schedule creation modal
3. Add edit/delete/toggle functions
4. Add "Run Now" quick action
5. Add daily limits display
6. Add activity history

### **Phase 4: Advanced Features (1 hour)**
1. Add timezone support
2. Add random delays (human-like)
3. Add warmup mode (gradually increase limits)
4. Add smart scheduling (avoid peak detection times)

---

## 📊 **Dashboard Mockup**

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 RIONA INSTAGRAM BOT                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Session: 🟢 Active (expires in 6 days)  [🔄 Refresh]          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  AUTOMATION SCHEDULE                    [+ Add Schedule]│   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ⏰ 9:00 AM  │ ❤️ Like Feed (20)        │ 🟢 │ ▶️ │ ✏️ │   │
│  │  ⏰ 2:00 PM  │ 💬 Comment Explore (10)  │ 🟢 │ ▶️ │ ✏️ │   │
│  │  ⏰ 7:00 PM  │ 👀 Watch Stories (15)    │ 🔴 │ ▶️ │ ✏️ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  DAILY LIMITS                                           │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  ❤️ Likes:    45/100 [████████░░] Resets in 8h 23m     │   │
│  │  💬 Comments: 12/50  [██░░░░░░░░]                       │   │
│  │  📩 DMs:      3/20   [█░░░░░░░░░]                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  RECENT ACTIVITY                                        │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  12:46 PM  ✅ Liked 20 posts from feed                  │   │
│  │  12:30 PM  ✅ Watched 15 stories                        │   │
│  │  11:15 AM  ✅ Sent 5 DMs (Miami campaign)               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 **Next Steps**

**Do you want me to:**
1. ✅ Build the full Jarvee-style scheduler now?
2. ✅ Start with session management first?
3. ✅ Focus on a specific feature?

Let me know and I'll start coding! 🚀

