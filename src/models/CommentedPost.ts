import mongoose, { Document, Schema, Model } from "mongoose";

// Interface for CommentedPost document
export interface ICommentedPost extends Document {
    postUrl: string;
    username: string;
    commentedAt: Date;
}

// Schema for CommentedPost
const commentedPostSchema: Schema<ICommentedPost> = new Schema({
    postUrl: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    commentedAt: { type: Date, default: Date.now },
});

// Create index for faster lookups
commentedPostSchema.index({ postUrl: 1 });
commentedPostSchema.index({ username: 1 });

// Model for CommentedPost
const CommentedPost: Model<ICommentedPost> = mongoose.model<ICommentedPost>("CommentedPost", commentedPostSchema);

export default CommentedPost;


