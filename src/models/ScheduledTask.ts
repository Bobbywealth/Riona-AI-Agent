import mongoose, { Document, Schema, Model } from "mongoose";

// Interface for ScheduledTask document
export interface IScheduledTask extends Document {
    name: string;
    taskType: 'campaign' | 'stories' | 'dm_monitor' | 'profile_scrape';
    enabled: boolean;
    scheduleType: 'cron' | 'once';
    cronExpression?: string;
    runAt?: Date;
    timezone?: string;
    config: {
        // Campaign config
        mode?: string;
        maxPosts?: number;
        hashtags?: string[];
        locationPath?: string;
        targetUsername?: string;
        sendDMs?: boolean;
        maxOutboundDMs?: number;
        englishOnly?: boolean;
        minLikes?: number;
        minComments?: number;
        // Stories config
        storyCount?: number;
        storyTarget?: string;
        likeProbability?: number;
        reactionProbability?: number;
        aiReplies?: boolean;
        // DM monitor config
        autoReply?: boolean;
        // Profile scrape config
        scrapeTarget?: string;
        maxFollowers?: number;
    };
    lastRun?: Date;
    nextRun?: Date;
    runCount: number;
    createdAt: Date;
    updatedAt: Date;
}

// Schema for ScheduledTask
const scheduledTaskSchema: Schema<IScheduledTask> = new Schema({
    name: { type: String, required: true },
    taskType: { 
        type: String, 
        required: true,
        enum: ['campaign', 'stories', 'dm_monitor', 'profile_scrape']
    },
    enabled: { type: Boolean, default: true },
    scheduleType: { type: String, enum: ['cron', 'once'], default: 'cron' },
    cronExpression: { type: String },
    runAt: { type: Date },
    timezone: { type: String, default: 'America/New_York' },
    config: { type: Schema.Types.Mixed, default: {} },
    lastRun: { type: Date },
    nextRun: { type: Date },
    runCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Create indexes
scheduledTaskSchema.index({ enabled: 1, nextRun: 1 });
scheduledTaskSchema.index({ taskType: 1 });
scheduledTaskSchema.index({ scheduleType: 1, runAt: 1 });

// Update the updatedAt field before saving
scheduledTaskSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Model for ScheduledTask
const ScheduledTask: Model<IScheduledTask> = mongoose.model<IScheduledTask>("ScheduledTask", scheduledTaskSchema);

export default ScheduledTask;

