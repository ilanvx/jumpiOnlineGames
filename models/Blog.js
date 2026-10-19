import mongoose from "mongoose";

const Id = mongoose.Schema.Types.ObjectId;

// Jumpi Club blog (routes/blog.js): posts are written by admins only, each with a picture.
const blogPostSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 120 },
  body: { type: String, required: true, maxlength: 20000 },   // plain text; an empty line starts a new paragraph
  image: { type: Id, ref: "BlogImage", default: null },
  author: { type: Id, ref: "User" },
  authorName: { type: String, default: "" },
  at: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: null },
});
blogPostSchema.index({ at: -1 });

// a post's picture (uploaded by an admin)
const blogImageSchema = new mongoose.Schema({
  type: { type: String, enum: ["image/png", "image/jpeg", "image/webp"], required: true },
  data: { type: Buffer, required: true },
  by: { type: Id, ref: "User" },
  at: { type: Date, default: Date.now },
});

// a comment on a post: nobody sees it until an admin approves it
const blogCommentSchema = new mongoose.Schema({
  post: { type: Id, ref: "BlogPost", required: true },
  user: { type: Id, ref: "User", required: true },
  username: { type: String, required: true },
  text: { type: String, required: true, maxlength: 400 },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  at: { type: Date, default: Date.now },
  reviewedBy: { type: String, default: "" },
  reviewedAt: { type: Date, default: null },
});
blogCommentSchema.index({ post: 1, status: 1, at: 1 });
blogCommentSchema.index({ status: 1, at: 1 });

export const BlogPost = mongoose.model("BlogPost", blogPostSchema);
export const BlogImage = mongoose.model("BlogImage", blogImageSchema);
export const BlogComment = mongoose.model("BlogComment", blogCommentSchema);
