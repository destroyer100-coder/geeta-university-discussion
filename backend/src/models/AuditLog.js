import mongoose from 'mongoose';
import { AUDIT_ACTIONS } from '../constants/index.js';

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: {
      type: String,
      enum: Object.values(AUDIT_ACTIONS),
      required: true,
    },
    targetType: {
      type: String,
      enum: ['community', 'post', 'comment', 'user', 'post_request', 'join_request'],
      required: true,
    },
    targetId: { type: String, required: true },
    community: { type: mongoose.Schema.Types.ObjectId, ref: 'Community', default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ community: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
