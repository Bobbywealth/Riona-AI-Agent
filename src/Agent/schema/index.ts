import { SchemaType } from "@google/generative-ai";
import mongoose, { Document, Schema, Model } from "mongoose";

export interface InstagramCommentSchema {
  description: string;
  type: SchemaType;
  items: {
    type: SchemaType;
    properties: {
      comment: {
        type: SchemaType;
        description: string;
        nullable: boolean;
      };
      viralRate: {
        type: SchemaType;
        description: string;
        nullable: boolean;
      };
      commentTokenCount: {
        type: SchemaType;
        description: string;
        nullable: boolean;
      };
    };
    required: string[];
  };
}

export const getInstagramCommentSchema = (): InstagramCommentSchema => {
  return {
    description: `Lists comments that are engaging and have the potential to attract more likes and go viral.`,
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        comment: {
          type: SchemaType.STRING,
          description: "A comment between 150 and 250 characters.",
          nullable: false,
        },
        viralRate: {
          type: SchemaType.NUMBER,
          description: "The viral rate, measured on a scale of 0 to 100.",
          nullable: false,
        },
        commentTokenCount: {
          type: SchemaType.NUMBER,
          description: "The total number of tokens in the comment.",
          nullable: false,
        },
      },
      required: ["comment", "viralRate", "commentTokenCount"],
    },
  };
};

export const getAutomationCommandSchema = () => {
  return {
    description:
      "Normalized instruction for the Instagram automation assistant. Always fill the summary and confidence fields.",
    type: SchemaType.OBJECT,
    properties: {
      action: {
        type: SchemaType.STRING,
        description:
          "The high-level action to perform. One of: campaign, interact, stories, status, logs, help.",
        nullable: false,
      },
      mode: {
        type: SchemaType.STRING,
        description:
          "Optional campaign mode such as feed, hashtag, location, explore, competitor_followers.",
        nullable: true,
      },
      hashtag: {
        type: SchemaType.STRING,
        description: "Hashtag to target when mode is hashtag.",
        nullable: true,
      },
      locationPath: {
        type: SchemaType.STRING,
        description: "Location path slug when mode is location.",
        nullable: true,
      },
      targetUsername: {
        type: SchemaType.STRING,
        description: "Username to inspect (for competitor or story actions).",
        nullable: true,
      },
      maxPosts: {
        type: SchemaType.NUMBER,
        description: "Number of posts to process.",
        nullable: true,
      },
      sendDMs: {
        type: SchemaType.BOOLEAN,
        description: "Whether to send DMs to qualified leads.",
        nullable: true,
      },
      inspectProfiles: {
        type: SchemaType.BOOLEAN,
        description: "Whether to inspect profiles before interacting.",
        nullable: true,
      },
      maxOutboundDMs: {
        type: SchemaType.NUMBER,
        description: "Maximum DMs to send during this run.",
        nullable: true,
      },
      requiredBioKeywords: {
        type: SchemaType.ARRAY,
        description: "Keywords that must be present in a bio before engaging.",
        nullable: true,
        items: {
          type: SchemaType.STRING,
        },
      },
      englishOnly: {
        type: SchemaType.BOOLEAN,
        description: "Whether to restrict interactions to English content.",
        nullable: true,
      },
      imagesOnly: {
        type: SchemaType.BOOLEAN,
        description: "Whether to skip videos/reels.",
        nullable: true,
      },
      storyCount: {
        type: SchemaType.NUMBER,
        description: "Number of stories to watch.",
        nullable: true,
      },
      storyTarget: {
        type: SchemaType.STRING,
        description: "Username whose stories should be prioritized.",
        nullable: true,
      },
      aiReplies: {
        type: SchemaType.BOOLEAN,
        description: "Whether to use AI replies for stories.",
        nullable: true,
      },
      tone: {
        type: SchemaType.STRING,
        description: "Tone for AI replies (friendly, consultative, hype).",
        nullable: true,
      },
      summary: {
        type: SchemaType.STRING,
        description: "Natural language summary of the planned action.",
        nullable: false,
      },
      confidence: {
        type: SchemaType.NUMBER,
        description: "Confidence score between 0 and 1.",
        nullable: false,
      },
      notes: {
        type: SchemaType.STRING,
        description: "Optional extra instructions or clarifications.",
        nullable: true,
      },
    },
    required: ["action", "summary", "confidence"],
  };
};

// Define the interface for the Tweet document
interface ITweet extends Document {
  tweetContent: string;
  imageUrl: string;
  timeTweeted: Date;
}

// Define the schema for the Tweet document
const tweetSchema: Schema<ITweet> = new Schema({
  tweetContent: { type: String, required: true },
  imageUrl: { type: String, required: true },
  timeTweeted: { type: Date, default: Date.now },
});

// Create the model for the Tweet document
const Tweet: Model<ITweet> = mongoose.model<ITweet>("Tweet", tweetSchema);

export default Tweet;
