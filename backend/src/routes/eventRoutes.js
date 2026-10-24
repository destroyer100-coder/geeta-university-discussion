import express from 'express';
import { getEvents, createEvent, rsvpEvent } from '../controllers/eventController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Optional auth lets approved members view private-community events without
// making authentication mandatory for public event listings.
router.get('/', optionalAuth, getEvents);
router.post('/', authenticate, createEvent);
router.post('/:id/rsvp', authenticate, rsvpEvent);

export default router;
