# Story Reply Debugging Guide

## ✅ **What Was Added**

Enhanced logging to debug why AI story replies are failing to send.

### **New Logs You'll See:**

#### **1. AI Analysis Logs:**
```
🤖 AI Story Analysis: confidence=75%, minRequired=55%, shouldReply=true
🤖 AI Generated Reply: "Love the vibe! 🔥 This would be perfect for a restaurant campaign"
```

#### **2. Reply Attempt Logs:**
```
💬 Attempting to reply to story: "Love the vibe! 🔥 This would be perfect for a restaurant campaign"
✅ Found story reply input with selector: textarea[placeholder^="Reply"]
✅ Story reply sent successfully
```

#### **3. Failure Logs:**
```
💬 Attempting to reply to story: "Great content!"
❌ No story reply input field found. Tried all selectors.
⚠️ AI story reply failed to send.
```

---

## 🚀 **Deploy & Test**

### **On VPS:**
```bash
cd /root/Riona-AI-Agent
git pull
npx tsc
pm2 restart riona-bot
pm2 logs riona-bot --lines 0
```

### **Then Test Stories:**
1. Go to dashboard: http://167.88.165.161
2. Enable AI Story Replies in the "Story Engagement" card
3. Click "👀 Watch Stories"
4. Watch the logs carefully

---

## 🔍 **What to Look For**

### **Scenario 1: AI Not Generating Replies**
If you see:
```
📸 Story 1 screenshot saved
🤖 Skipping story 1 (confidence 30%)
```
**Cause:** AI confidence is too low  
**Fix:** Lower the "Min Confidence" threshold in dashboard (try 40% instead of 55%)

---

### **Scenario 2: AI Generating But Not Sending**
If you see:
```
🤖 AI Story Analysis: confidence=75%, shouldReply=true
🤖 AI Generated Reply: "Great post!"
💬 Attempting to reply to story: "Great post!"
❌ No story reply input field found
⚠️ AI story reply failed to send.
```
**Cause:** Instagram's story reply input field has changed  
**Fix:** We need to update the selectors (I'll do this if you see this pattern)

---

### **Scenario 3: Working Correctly**
If you see:
```
🤖 AI Story Analysis: confidence=75%, shouldReply=true
🤖 AI Generated Reply: "Love this! 🔥"
💬 Attempting to reply to story: "Love this! 🔥"
✅ Found story reply input with selector: textarea[placeholder^="Reply"]
✅ Story reply sent successfully
🤖 AI replied to story 1 (75%)
```
**Result:** ✅ Everything is working!

---

## 📋 **Next Steps**

1. **Deploy the new logging** (see commands above)
2. **Test story watching** with AI replies enabled
3. **Copy the logs** and send them to me
4. I'll analyze the logs and fix any selector issues

---

## 🛠️ **Troubleshooting**

### **If AI replies are too generic:**
- Adjust the tone in dashboard (try "consultative" or "hype")
- The AI is trained to reference visual details from the story

### **If AI is replying to everything:**
- Increase the "Min Confidence" threshold (try 65% or 70%)
- Reduce "Max Replies per Session" to 1 or 2

### **If AI never replies:**
- Lower the "Min Confidence" threshold (try 40%)
- Check that Gemini API key is valid in `.env`

---

**Deploy now and let's see what the detailed logs reveal!** 🔍

