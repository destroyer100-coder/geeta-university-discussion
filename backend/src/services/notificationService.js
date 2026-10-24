import { Notification } from '../models/Notification.js';

export const notificationService = {
  async notify({ userId, actorId, type, message, target }) {
    if (!userId) return;
    if (actorId && userId.toString() === actorId.toString()) return; // don't notify self actions

    try {
      return await Notification.create({
        user: userId,
        actor: actorId,
        type,
        message,
        target: target || {},
        read: false,
      });
    } catch (err) {
      console.error('[NotificationService] Error creating notification:', err.message);
    }
  },
};
