import mongoose from 'mongoose';
import {
  VISIBILITY,
  POST_POLICY,
  COMMENT_POLICY,
  SHARE_POLICY,
} from '../constants/index.js';

const communitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    avatar: { type: String, default: '' },
    banner: { type: String, default: '' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    type: {
      type: String,
      default: 'general',
    },
    category: {
      type: String,
      default: 'General',
    },
    permissions: {
      visibility: {
        type: String,
        enum: Object.values(VISIBILITY),
        default: VISIBILITY.PUBLIC,
      },
      postPolicy: {
        type: String,
        enum: Object.values(POST_POLICY),
        default: POST_POLICY.MEMBERS,
      },
      commentPolicy: {
        type: String,
        enum: Object.values(COMMENT_POLICY),
        default: COMMENT_POLICY.EVERYONE,
      },
      sharePolicy: {
        type: String,
        enum: Object.values(SHARE_POLICY),
        default: SHARE_POLICY.EVERYONE,
      },
      allowPostRequests: { type: Boolean, default: true },
      requirePostApproval: { type: Boolean, default: false },
      allowAnonymousPosts: { type: Boolean, default: true },
      customAllowedUsers: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        default: [],
      },
    },
    rules: [
      {
        title: { type: String, required: true },
        description: { type: String, default: '' },
      },
    ],
    maxPinnedPosts: { type: Number, default: 3 },
    memberCount: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

communitySchema.index({ category: 1 });
communitySchema.index({ memberCount: -1 });

export const Community = mongoose.model('Community', communitySchema);
