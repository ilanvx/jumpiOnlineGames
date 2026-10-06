import mongoose from "mongoose";

// a message sent from the Contact page on the website (read them in MongoDB Atlas → contactmessages)
const contactSchema = new mongoose.Schema(
  {
    name: { type: String, default: "", maxlength: 80 },
    email: { type: String, required: true, maxlength: 200 },
    topic: { type: String, enum: ["general", "safety", "privacy", "account", "bug", "idea"], default: "general" },
    message: { type: String, required: true, maxlength: 3000 },
    username: { type: String, default: "" },   // filled in when the sender is signed in to Jumpi
    lang: { type: String, default: "en" },
    handled: { type: Boolean, default: false },
  },
  { timestamps: true }
);
contactSchema.index({ handled: 1, createdAt: -1 });

export const ContactMessage = mongoose.models.ContactMessage || mongoose.model("ContactMessage", contactSchema);
