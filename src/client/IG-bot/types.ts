export type InteractionMode =
  | 'feed'
  | 'explore'
  | 'user'
  | 'hashtag'
  | 'location'
  | 'competitor_followers'
  | 'stories';

export interface EngagementFilters {
  minLikes?: number;
  minComments?: number;
}

export interface InteractionOptions {
  mode?: InteractionMode;
  hashtags?: string[];
  locationPath?: string;
  locationQuery?: string;
  locationCoordinates?: {
    latitude: number;
    longitude: number;
  };
  competitorUsername?: string;
  followersToEngage?: number;
  postsPerFollower?: number;
  engagement?: EngagementFilters;
  englishOnly?: boolean;
  imagesOnly?: boolean;
  requireCaption?: boolean;
  inspectProfile?: boolean;
  sendDMs?: boolean;
  maxOutboundDMs?: number;
  requiredBioKeywords?: string[];
}

export interface StoryAIReplyOptions {
  enabled?: boolean;
  maxReplies?: number;
  minConfidence?: number;
  tone?: 'friendly' | 'consultative' | 'hype';
}

export interface StoryOptions {
  source?: 'feed' | 'user';
  targetUsername?: string;
  storyCount?: number;
  minWatchTimeMs?: number;
  maxWatchTimeMs?: number;
  likeProbability?: number;
  reactionProbability?: number;
  reactionEmoji?: string;
  aiReply?: StoryAIReplyOptions;
}

export interface EngagementMetrics {
  likes: number | null;
  comments: number | null;
}

