import mongoose from 'mongoose';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { User } from '../models/User.js';
import { permissionService } from '../services/permissionService.js';
import { ERROR_CODES } from '../constants/index.js';

export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Find all conversations involving this user where user hasn't deleted the conversation
    const conversations = await Conversation.find({
      participants: userId,
      deletedBy: { $ne: userId },
    })
      .populate({ path: 'participants', select: 'name avatar department role isDeleted', match: { isDeleted: false } })
      .sort({ lastMessageAt: -1 });

    const formatted = await Promise.all(
      conversations.map(async (conv) => {
        // Messaging is strictly one-to-one; do not expose malformed conversations.
        if (conv.participants.length !== 2) return null;
        const otherUser = conv.participants.find(
          (p) => p && p._id.toString() !== userId.toString()
        );
        if (!otherUser || await permissionService.isBlocked(userId, otherUser._id)) return null;

        // Count unread messages in this conversation for current user
        const unreadCount = await Message.countDocuments({
          conversation: conv._id,
          receiver: userId,
          read: false,
          deletedFor: { $ne: userId },
        });

        return {
          _id: conv._id,
          user: otherUser,
          lastMessage: conv.lastMessage,
          lastMessageAt: conv.lastMessageAt,
          unreadCount,
        };
      })
    );

    res.json({ success: true, data: formatted.filter(Boolean) });
  } catch (error) {
    next(error);
  }
};

export const getMessagesWithUser = async (req, res, next) => {
  try {
    const { userId: otherUserId } = req.params;
    const currentUserId = req.user._id;

    if (!mongoose.isValidObjectId(otherUserId) || otherUserId === currentUserId.toString()) {
      return res.status(400).json({ success: false, message: 'A valid other user is required.', error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Invalid conversation participant.' } });
    }

    const otherUser = await User.findOne({ _id: otherUserId, isDeleted: false }).select('_id');
    if (!otherUser) return res.status(404).json({ success: false, message: 'User not found.', error: { code: ERROR_CODES.NOT_FOUND, message: 'User not found.' } });

    if (await permissionService.isBlocked(currentUserId, otherUserId)) {
      return res.status(403).json({ success: false, message: 'This conversation is unavailable because communication is restricted by block settings.', error: { code: ERROR_CODES.FORBIDDEN, message: 'User is blocked.' } });
    }

    // Match exactly the two participants; $all alone could match a larger group.
    const conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, otherUserId], $size: 2 },
    });

    if (!conversation) {
      return res.json({ success: true, data: [] });
    }

    const messages = await Message.find({
      conversation: conversation._id,
      deletedFor: { $ne: currentUserId },
    })
      .populate('sender', 'name avatar')
      .populate('receiver', 'name avatar')
      .sort({ createdAt: 1 });

    // Mark unread messages as read
    await Message.updateMany(
      { conversation: conversation._id, receiver: currentUserId, read: false },
      { read: true }
    );

    res.json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const { receiverId, body } = req.body;
    if (!mongoose.isValidObjectId(receiverId) || receiverId === req.user._id.toString() || typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Receiver and non-empty message body are required.',
        error: { code: ERROR_CODES.VALIDATION_ERROR, message: 'Receiver and body required.' },
      });
    }

    const receiver = await User.findOne({ _id: receiverId, isDeleted: false }).select('_id');
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found.', error: { code: ERROR_CODES.NOT_FOUND, message: 'Receiver not found.' } });
    }

    // Enforce blocks for both new and already-existing conversations.
    const isBlocked = await permissionService.isBlocked(req.user._id, receiverId);
    if (isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Unable to deliver message: communication between these accounts is restricted by user block settings.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'User is blocked.' },
      });
    }

    // Find or create conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [req.user._id, receiverId], $size: 2 },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [req.user._id, receiverId],
        lastMessage: body.trim(),
        lastMessageAt: new Date(),
        deletedBy: [],
      });
    } else {
      conversation.lastMessage = body.trim();
      conversation.lastMessageAt = new Date();
      // If previously deleted by either user, restore it
      conversation.deletedBy = conversation.deletedBy.filter(
        (id) => id.toString() !== req.user._id.toString()
      );
      await conversation.save();
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      receiver: receiverId,
      body: body.trim(),
      read: false,
      deletedFor: [],
    });

    const populated = await Message.findById(message._id)
      .populate('sender', 'name avatar')
      .populate('receiver', 'name avatar');

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

// Delete Message for Me (Point 14)
export const deleteMessageForMe = async (req, res, next) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Message not found.' },
      });
    }

    // Verify both message addressing and membership in its exact conversation.
    const conversation = await Conversation.findOne({ _id: message.conversation, participants: req.user._id, participants: { $size: 2 } });
    const isParticipant = !!conversation && (
      message.sender.toString() === req.user._id.toString() ||
      message.receiver.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Unauthorized' },
      });
    }

    await Message.updateOne({ _id: message._id }, { $addToSet: { deletedFor: req.user._id } });

    res.json({ success: true, message: 'Message deleted for you.' });
  } catch (error) {
    next(error);
  }
};

// Delete Message for Everyone (Point 14)
export const deleteMessageForEveryone = async (req, res, next) => {
  try {
    const { id } = req.params;
    const message = await Message.findById(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found.',
        error: { code: ERROR_CODES.NOT_FOUND, message: 'Message not found.' },
      });
    }

    const conversation = await Conversation.findOne({ _id: message.conversation, participants: req.user._id, participants: { $size: 2 } });
    if (!conversation || message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the sender can delete a message for everyone.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Unauthorized' },
      });
    }

    message.isDeleted = true;
    message.body = '[Message deleted by sender]';
    await message.save();

    res.json({ success: true, message: 'Message deleted for everyone.', data: message });
  } catch (error) {
    next(error);
  }
};
