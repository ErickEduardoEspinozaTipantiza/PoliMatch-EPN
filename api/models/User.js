import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  INTERESTS,
  MAX_INTERESTS,
  MAX_PHOTOS,
  RELATIONSHIP_GOALS,
} from "../../shared/profile-options.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: { type: String, required: true, select: false },
    age: {
      type: Number,
      required: true,
      min: 18,
      max: 120,
      validate: Number.isInteger,
    },
    gender: { type: String, required: true, enum: ["male", "female"] },
    genderPreference: {
      type: String,
      required: true,
      enum: ["male", "female", "both"],
    },
    bio: { type: String, default: "", maxlength: 500 },
    image: { type: String, default: "" },
    photos: {
      type: [String],
      default: [],
      validate: (value) =>
        value.length <= MAX_PHOTOS && new Set(value).size === value.length,
    },
    interests: {
      type: [{ type: String, enum: INTERESTS }],
      default: [],
      validate: (value) =>
        value.length <= MAX_INTERESTS && new Set(value).size === value.length,
    },
    relationshipGoal: {
      type: String,
      enum: ["", ...RELATIONSHIP_GOALS.map(({ value }) => value)],
      default: "",
    },
    city: { type: String, default: "", trim: true, maxlength: 80 },
    university: { type: String, default: "", trim: true, maxlength: 120 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    matches: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, value) {
        delete value.password;
        delete value.__v;
        return value;
      },
    },
  },
);

userSchema.pre("save", async function () {
  if (this.isModified("password"))
    this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);
