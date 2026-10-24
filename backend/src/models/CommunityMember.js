import mongoose from 'mongoose';
import { COMMUNITY_MEMBER_ROLES } from '../constants/index.js';

const communityMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', required: true },
    role: {
      type: String,
      enum: Object.values(COMMUNITY_MEMBER_ROLES),
      default: COMMUNITY_MEMBER_ROLES.MEMBER,
    },
    status: {
      type: String,
      enum: ['active', 'pending', 'rejected', 'banned'],
      default: 'active',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    canPost: { type: Boolean, default: true },
    delegatedPermissions: [{ type: String }],
  },
  { timestamps: true }
);

communityMemberSchema.index({ user: 1, community: 1 }, { unique: true });
communityMemberSchema.index({ community: 1, status: 1 });

export const CommunityMember = mongoose.model('CommunityMember', communityMemberSchema);
