import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { Community } from '../models/Community.js';
import { CommunityMember } from '../models/CommunityMember.js';
import { VISIBILITY, COMMUNITY_MEMBER_ROLES, ERROR_CODES } from '../constants/index.js';

const MAX_EVENTS_PER_REQUEST = 100;
const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_VENUE_LENGTH = 180;
const MAX_TIME_LENGTH = 60;
const MAX_CATEGORY_LENGTH = 60;

const isValidObjectId = (value) =>
  typeof value === 'string' && mongoose.isValidObjectId(value);

const idString = (value) => {
  const id = value?._id || value;
  return id == null ? '' : id.toString();
};

const isActiveMember = async (userId, communityId) =>
  Boolean(await CommunityMember.exists({
    user: userId,
    community: communityId,
    status: 'active',
  }));

// A private community's events are visible only to active members, its head,
// active moderators/owners, or platform admins. Public events remain public.
const canAccessCommunityEvents = async (user, community) => {
  if (!community) return false;
  if (community.permissions?.visibility !== VISIBILITY.MEMBERS_ONLY) return true;
  if (!user) return false;
  if (user.role === 'admin') return true;

  const userId = idString(user);
  if (idString(community.owner) === userId) return true;

  return isActiveMember(user._id, community._id);
};

// Event creation is limited to the head/owner or an active moderator of the
// exact community submitted by the client. A moderator role in another
// community does not grant event creation rights here.
const canCreateCommunityEvent = async (user, community) => {
  if (!user || !community) return false;
  if (idString(community.owner) === idString(user)) return true;

  const membership = await CommunityMember.findOne({
    user: user._id,
    community: community._id,
    status: 'active',
    role: {
      $in: [COMMUNITY_MEMBER_ROLES.OWNER, COMMUNITY_MEMBER_ROLES.MODERATOR],
    },
  }).select('_id role');

  return Boolean(membership);
};

const validationError = (res, message) =>
  res.status(400).json({
    success: false,
    message,
    error: { code: ERROR_CODES.VALIDATION_ERROR, message },
  });

export const getEvents = async (req, res, next) => {
  try {
    const { community, upcoming = 'true' } = req.query;

    if (community && !isValidObjectId(community)) {
      return validationError(res, 'Invalid community ID.');
    }
    if (!['true', 'false'].includes(upcoming)) {
      return validationError(res, 'The upcoming filter must be true or false.');
    }

    const filter = {};
    if (community) filter.community = community;
    if (upcoming === 'true') {
      filter.date = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
    }

    const events = await Event.find(filter)
      .populate('community', 'name slug avatar owner permissions.visibility')
      .populate('organizer', 'name avatar')
      .sort({ date: 1, _id: 1 })
      .limit(MAX_EVENTS_PER_REQUEST)
      .lean();

    const accessResults = await Promise.all(
      events.map((event) => canAccessCommunityEvents(req.user, event.community))
    );
    const visibleEvents = events.filter((event, index) => accessResults[index]);

    res.json({ success: true, count: visibleEvents.length, data: visibleEvents });
  } catch (error) {
    next(error);
  }
};

export const createEvent = async (req, res, next) => {
  try {
    const { community: communityId, title, date, time, venue, description, category } = req.body || {};

    if (!isValidObjectId(communityId)) {
      return validationError(res, 'A valid community is required to create an event.');
    }
    if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > MAX_TITLE_LENGTH) {
      return validationError(res, `Event title must be between 3 and ${MAX_TITLE_LENGTH} characters.`);
    }
    if (description != null && (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH)) {
      return validationError(res, `Event description must not exceed ${MAX_DESCRIPTION_LENGTH} characters.`);
    }
    if (venue != null && (typeof venue !== 'string' || venue.trim().length > MAX_VENUE_LENGTH)) {
      return validationError(res, `Event venue must not exceed ${MAX_VENUE_LENGTH} characters.`);
    }
    if (time != null && (typeof time !== 'string' || time.trim().length > MAX_TIME_LENGTH)) {
      return validationError(res, `Event time must not exceed ${MAX_TIME_LENGTH} characters.`);
    }
    if (category != null && (typeof category !== 'string' || category.trim().length > MAX_CATEGORY_LENGTH)) {
      return validationError(res, `Event category must not exceed ${MAX_CATEGORY_LENGTH} characters.`);
    }

    const community = await Community.findById(communityId)
      .select('name owner permissions.visibility');
    if (!community) {
      return res.status(404).json({ success: false, message: 'Community not found.' });
    }

    if (!(await canCreateCommunityEvent(req.user, community))) {
      return res.status(403).json({
        success: false,
        message: 'Only the community head or an active moderator of this community can create events.',
        error: { code: ERROR_CODES.FORBIDDEN, message: 'Event creation permission denied.' },
      });
    }

    const eventDate = date == null || date === ''
      ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      : new Date(date);
    if (Number.isNaN(eventDate.getTime()) || eventDate.getTime() <= Date.now()) {
      return validationError(res, 'Event date must be a valid future date.');
    }

    const event = await Event.create({
      community: community._id,
      organizer: req.user._id,
      title: title.trim(),
      date: eventDate,
      time: typeof time === 'string' && time.trim() ? time.trim() : '11:00 AM',
      venue: typeof venue === 'string' && venue.trim() ? venue.trim() : 'Auditorium A, Geeta University',
      description: typeof description === 'string' ? description.trim() : '',
      category: typeof category === 'string' && category.trim() ? category.trim() : 'Workshop',
      attendees: [req.user._id],
    });

    const populated = await Event.findById(event._id)
      .populate('community', 'name slug avatar')
      .populate('organizer', 'name avatar');

    res.status(201).json({
      success: true,
      message: 'Event created successfully.',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

export const rsvpEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const userId = req.user._id;
    const event = await Event.findById(id)
      .populate('community', 'name slug avatar owner permissions.visibility');

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    if (!(await canAccessCommunityEvents(req.user, event.community))) {
      // Return 404 so private community event existence is not disclosed.
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const alreadyJoined = (event.attendees || []).some((attendee) =>
      idString(attendee) === idString(userId)
    );

    let updatedEvent;
    if (alreadyJoined) {
      updatedEvent = await Event.findOneAndUpdate(
        { _id: id, attendees: userId },
        { $pull: { attendees: userId } },
        { new: true }
      );
    } else {
      updatedEvent = await Event.findOneAndUpdate(
        { _id: id, attendees: { $ne: userId } },
        { $addToSet: { attendees: userId } },
        { new: true }
      );
    }

    // Another concurrent request may already have applied the desired state.
    if (!updatedEvent) updatedEvent = await Event.findById(id);
    if (!updatedEvent) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const joined = (updatedEvent.attendees || []).some((attendee) =>
      idString(attendee) === idString(userId)
    );
    const populatedEvent = await Event.findById(id)
      .populate('community', 'name slug avatar')
      .populate('organizer', 'name avatar');

    res.json({
      success: true,
      joined,
      attendeesCount: updatedEvent.attendees?.length || 0,
      data: populatedEvent,
      message: joined ? 'RSVP confirmed! You are attending this event.' : 'RSVP cancelled.',
    });
  } catch (error) {
    next(error);
  }
};
