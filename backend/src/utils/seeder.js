import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from '../config/db.js';
import { MONGODB_URI, NODE_ENV } from '../config/env.js';
import { User } from '../models/User.js';
import { Community } from '../models/Community.js';
import { CommunityMember } from '../models/CommunityMember.js';
import { Post } from '../models/Post.js';
import { Attachment } from '../models/Attachment.js';
import { Folder } from '../models/Folder.js';
import { Comment } from '../models/Comment.js';
import { Poll } from '../models/Poll.js';
import { PollVote } from '../models/PollVote.js';
import { Event } from '../models/Event.js';
import { AuditLog } from '../models/AuditLog.js';
import { Block } from '../models/Block.js';
import { Mute } from '../models/Mute.js';
import { Conversation } from '../models/Conversation.js';
import { PostRequest } from '../models/PostRequest.js';
import {
  VISIBILITY,
  POST_POLICY,
  COMMENT_POLICY,
  SHARE_POLICY,
  COMMUNITY_MEMBER_ROLES,
  CONTENT_STATUS,
  DELEGATED_PERMISSIONS,
} from '../constants/index.js';

const getSeedDatabaseName = () => {
  try {
    const databaseUrl = new URL(MONGODB_URI);
    return decodeURIComponent(databaseUrl.pathname.slice(1).split('/')[0] || '');
  } catch {
    return '';
  }
};

const assertSafeSeedTarget = () => {
  const databaseName = getSeedDatabaseName();
  const explicitlyAllowedName = process.env.SEED_ALLOWED_DATABASE_NAME || '';
  const demoPassword = process.env.SEED_DEMO_PASSWORD || '';

  if (demoPassword.length < 12) {
    throw new Error('[Seeder] SEED_DEMO_PASSWORD is required and must be at least 12 characters.');
  }

  if (NODE_ENV !== 'development') {
    throw new Error('[Seeder] Refusing to run unless NODE_ENV=development.');
  }

  if (process.env.ALLOW_DESTRUCTIVE_SEED !== 'true') {
    throw new Error('[Seeder] Blocked. Set ALLOW_DESTRUCTIVE_SEED=true only for an intentional disposable development seed.');
  }

  if (!databaseName || !explicitlyAllowedName || databaseName !== explicitlyAllowedName) {
    throw new Error('[Seeder] Refusing to clear data: database name must exactly match SEED_ALLOWED_DATABASE_NAME.');
  }

  const hostname = new URL(MONGODB_URI).hostname.toLowerCase();
  const isLocalDatabase = ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  if (!isLocalDatabase && !databaseName.endsWith('_dev')) {
    throw new Error('[Seeder] Remote database targets must use a dedicated database name ending in _dev.');
  }
};

export const seedDatabase = async () => {
  try {
    assertSafeSeedTarget();
    console.log('[Seeder] Starting disposable development database seed...');
    await connectDB();

    // Clear existing collections
    await User.deleteMany({});
    await Community.deleteMany({});
    await CommunityMember.deleteMany({});
    await Post.deleteMany({});
    await Attachment.deleteMany({});
    await Folder.deleteMany({});
    await Comment.deleteMany({});
    await Poll.deleteMany({});
    await PollVote.deleteMany({});
    await Event.deleteMany({});
    await AuditLog.deleteMany({});
    await Block.deleteMany({});
    await Mute.deleteMany({});
    await Conversation.deleteMany({});
    await PostRequest.deleteMany({});

    const passwordHash = await bcrypt.hash(process.env.SEED_DEMO_PASSWORD, 12);

    // 1. Create Users
    console.log('[Seeder] Creating users...');
    const users = await User.create([
      {
        name: 'Vansh Jawla',
        email: 'vansh@geeta.edu.in',
        passwordHash,
        role: 'student',
        verified: true,
        department: 'Computer Science & Engineering',
        year: '3rd Year • CSE',
        bio: 'Passionate full-stack developer & competitive programmer. Geeta University Class of 2027.',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      },
      {
        name: 'Dr. Rakesh Sharma',
        email: 'rakesh@geeta.edu.in',
        passwordHash,
        role: 'faculty',
        verified: true,
        department: 'Computer Science & Engineering',
        year: 'Faculty • CSE Head',
        bio: 'Head of CSE Department, Geeta University. Research interests: AI, Cloud Computing, Distributed Systems.',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      },
      {
        name: 'Rahul Mehta',
        email: 'rahul@geeta.edu.in',
        passwordHash,
        role: 'student',
        verified: true,
        department: 'Computer Science & Engineering',
        year: '4th Year • CSE',
        bio: 'Placement Coordinator & Lead Moderator for CSE Community. Incoming SDE at Microsoft.',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      },
      {
        name: 'Sneha Arora',
        email: 'sneha@geeta.edu.in',
        passwordHash,
        role: 'student',
        verified: true,
        department: 'Computer Science & Engineering',
        year: '3rd Year • CSE',
        bio: 'Open source contributor & tech blogger. Loves Operating Systems and Computer Architecture.',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      },
      {
        name: 'Aman Verma',
        email: 'aman@geeta.edu.in',
        passwordHash,
        role: 'faculty',
        verified: true,
        department: 'Computer Science & Engineering',
        year: 'Faculty • CSE',
        bio: 'Assistant Professor. Teaching Data Structures, Algorithms, and System Design.',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
      },
      {
        name: 'Karan Malik',
        email: 'karan@geeta.edu.in',
        passwordHash,
        role: 'student',
        verified: true,
        department: 'Mechanical Engineering',
        year: '3rd Year • Mechanical',
        bio: 'Exploring software development and automation.',
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
      },
      {
        name: 'Priya Singh',
        email: 'priya@geeta.edu.in',
        passwordHash,
        role: 'student',
        verified: true,
        department: 'Computer Science & Engineering',
        year: '1st Year • CSE',
        bio: 'New student excited to learn and connect with peers.',
        avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
      },
      {
        name: 'Demo Community Owner',
        email: 'community-owner@geeta.edu.in',
        passwordHash,
        role: 'student',
        verified: true,
        department: 'Administration',
        year: 'Demo Community Owner',
        bio: 'Geeta University Platform Administrator.',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      },
    ]);

    const [vansh, drRakesh, rahul, sneha, aman, karan, priya, adminUser] = users;

    // 2. Create Communities (Section 12: Community Examples)
    console.log('[Seeder] Creating communities with permission models...');
    const communities = await Community.create([
      {
        name: 'CSE Discussion',
        slug: 'cse-discussion',
        description: 'Discussions, doubts, resources, projects and opportunities for Geeta University CSE students.',
        avatar: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=100&auto=format&fit=crop&q=80',
        banner: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80',
        owner: drRakesh._id,
        moderators: [rahul._id, aman._id],
        type: 'academic',
        permissions: {
          visibility: VISIBILITY.PUBLIC,
          postPolicy: POST_POLICY.APPROVED_USERS, // Members + approved users can post
          commentPolicy: COMMENT_POLICY.EVERYONE,
          sharePolicy: SHARE_POLICY.EVERYONE,
          allowPostRequests: true,
          requirePostApproval: false,
          allowAnonymousPosts: true,
        },
        rules: [
          { title: 'Be Respectful and Academic', description: 'Respect fellow students, faculty, and maintain professional discussion standards.' },
          { title: 'Provide Code & Reproducible Context', description: 'When asking for debugging help, provide clean code snippets and error traces.' },
          { title: 'No Copyright Infringements', description: 'Do not share pirated textbooks or proprietary test materials.' },
        ],
                memberCount: 0,
        postCount: 356,
      },
      {
        name: 'General Discussion',
        slug: 'general-discussion',
        description: 'Campus life, queries, peer chats and general conversation open to all Geeta University members.',
        avatar: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=100&auto=format&fit=crop&q=80',
        banner: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&auto=format&fit=crop&q=80',
        owner: adminUser._id,
        moderators: [rahul._id],
        type: 'general',
        permissions: {
          visibility: VISIBILITY.PUBLIC,
          postPolicy: POST_POLICY.EVERYONE, // Everyone can post
          commentPolicy: COMMENT_POLICY.EVERYONE,
          sharePolicy: SHARE_POLICY.EVERYONE,
          allowPostRequests: false,
          requirePostApproval: false,
          allowAnonymousPosts: true,
        },
        rules: [
          { title: 'Friendly Communication', description: 'Promote an inclusive, friendly campus community.' },
        ],
                memberCount: 0,
        postCount: 890,
      },
      {
        name: 'University Announcements',
        slug: 'university-announcements',
        description: 'Official circulars, exam notices, schedules, holidays and official campus communications.',
        avatar: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?w=100&auto=format&fit=crop&q=80',
        banner: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200&auto=format&fit=crop&q=80',
        owner: adminUser._id,
        moderators: [drRakesh._id],
        type: 'announcements',
        permissions: {
          visibility: VISIBILITY.PUBLIC,
          postPolicy: POST_POLICY.HEAD_MODS, // Only Head / Admin can post
          commentPolicy: COMMENT_POLICY.MEMBERS,
          sharePolicy: SHARE_POLICY.EVERYONE,
          allowPostRequests: false,
          requirePostApproval: false,
          allowAnonymousPosts: false,
        },
        rules: [
          { title: 'Official Authority Only', description: 'Only designated university officers may publish circulars here.' },
        ],
                memberCount: 0,
        postCount: 142,
      },
      {
        name: 'Placement Updates',
        slug: 'placement-updates',
        description: 'On-campus recruitment drives, eligibility lists, interview experiences, and placement preparation.',
        avatar: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=100&auto=format&fit=crop&q=80',
        banner: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&auto=format&fit=crop&q=80',
        owner: rahul._id,
        moderators: [drRakesh._id],
        type: 'placement',
        permissions: {
          visibility: VISIBILITY.PUBLIC,
          postPolicy: POST_POLICY.MEMBERS, // Verified members can post
          commentPolicy: COMMENT_POLICY.EVERYONE,
          sharePolicy: SHARE_POLICY.EVERYONE,
          allowPostRequests: true,
          requirePostApproval: false,
          allowAnonymousPosts: true,
        },
        rules: [
          { title: 'Verified Drives Only', description: 'Only post verified recruiter schedules and official university links.' },
        ],
                memberCount: 0,
        postCount: 420,
      },
      {
        name: 'Coding Club',
        slug: 'coding-club',
        description: 'Competitive programming, LeetCode challenges, hackathons, open source and algorithmic sprints.',
        avatar: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=100&auto=format&fit=crop&q=80',
        banner: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=1200&auto=format&fit=crop&q=80',
        owner: vansh._id,
        moderators: [rahul._id],
        type: 'club',
        permissions: {
          visibility: VISIBILITY.PUBLIC,
          postPolicy: POST_POLICY.APPROVED_USERS, // Members + approved users can post
          commentPolicy: COMMENT_POLICY.EVERYONE,
          sharePolicy: SHARE_POLICY.EVERYONE,
          allowPostRequests: true,
          requirePostApproval: false,
          allowAnonymousPosts: true,
        },
        rules: [
          { title: 'Contest Etiquette', description: 'Do not post active contest solutions before contests end.' },
        ],
                memberCount: 0,
        postCount: 215,
      },
    ]);

    const [cseComm, genComm, announceComm, placementComm, codingComm] = communities;

    // 3. Create Community Memberships
    // Seeded moderators receive the explicit delegation set they are documented to
    // operate with (rules §3, §9, §13, §25, §26): pin, lock, delete, request review
    // and accepted-answer marking. `manage_rules` is intentionally NOT granted —
    // community settings remain Head/Platform-Admin only.
    const SEEDED_MODERATOR_PERMISSIONS = [
      DELEGATED_PERMISSIONS.PIN_POSTS,
      DELEGATED_PERMISSIONS.LOCK_POSTS,
      DELEGATED_PERMISSIONS.DELETE_POSTS,
      DELEGATED_PERMISSIONS.MANAGE_REQUESTS,
      DELEGATED_PERMISSIONS.MARK_ACCEPTED_ANSWERS,
    ];
    console.log('[Seeder] Creating community memberships...');
    await CommunityMember.create([
      { user: drRakesh._id, community: cseComm._id, role: COMMUNITY_MEMBER_ROLES.OWNER, status: 'active', canPost: true },
      { user: rahul._id, community: cseComm._id, role: COMMUNITY_MEMBER_ROLES.MODERATOR, status: 'active', canPost: true, delegatedPermissions: SEEDED_MODERATOR_PERMISSIONS },
      { user: aman._id, community: cseComm._id, role: COMMUNITY_MEMBER_ROLES.MODERATOR, status: 'active', canPost: true, delegatedPermissions: SEEDED_MODERATOR_PERMISSIONS },
      { user: vansh._id, community: cseComm._id, role: COMMUNITY_MEMBER_ROLES.APPROVED_USER, status: 'active', canPost: true, approvedBy: drRakesh._id },
      { user: sneha._id, community: cseComm._id, role: COMMUNITY_MEMBER_ROLES.APPROVED_USER, status: 'active', canPost: true, approvedBy: drRakesh._id },

      { user: vansh._id, community: codingComm._id, role: COMMUNITY_MEMBER_ROLES.OWNER, status: 'active', canPost: true },
      { user: rahul._id, community: codingComm._id, role: COMMUNITY_MEMBER_ROLES.MODERATOR, status: 'active', canPost: true, delegatedPermissions: SEEDED_MODERATOR_PERMISSIONS },
      // NOTE: aman is a moderator of CSE only; in coding-club he is a plain member
      // (cross-community isolation: moderator powers never leak across communities).
      { user: aman._id, community: codingComm._id, role: COMMUNITY_MEMBER_ROLES.MEMBER, status: 'active', canPost: true },
      { user: sneha._id, community: codingComm._id, role: COMMUNITY_MEMBER_ROLES.MEMBER, status: 'active', canPost: true },

      { user: rahul._id, community: placementComm._id, role: COMMUNITY_MEMBER_ROLES.OWNER, status: 'active', canPost: true },
      { user: vansh._id, community: placementComm._id, role: COMMUNITY_MEMBER_ROLES.MEMBER, status: 'active', canPost: true },
    ]);

    // 4. Create the SPEC MANDATORY Post: Section 6 "Complete DSA Roadmap for Placements"
    console.log('[Seeder] Creating Section 6 One Post with 5 attachment types...');
    const dsaRoadmapPost = await Post.create({
      author: vansh._id,
      community: cseComm._id,
      type: 'resource',
      title: 'Complete DSA Roadmap for Placements',
      body: 'I followed this roadmap for placements. I am sharing my notes, video explanation, and practice material too. Feel free to ask any doubts or discuss optimization strategies in the comments below!',
      tags: ['DSA', 'Placements', 'Resources', 'Roadmap', 'InterviewPrep'],
      status: 'published',
      isPinned: true,
      pinnedAt: new Date(),
      pinnedBy: drRakesh._id,
      isAnonymous: false,
      allowComments: true,
      isQuestion: false,
      likes: [drRakesh._id, rahul._id, sneha._id, aman._id],
      saves: [karan._id, priya._id, sneha._id],
      helpfulVotes: [drRakesh._id, rahul._id, aman._id, sneha._id],
      viewsCount: 2450,
      commentsCount: 3,
    });

    // Create the Folder record for Code_Examples/
    const codeFolder = await Folder.create({
      post: dsaRoadmapPost._id,
      parentFolder: null,
      name: 'Code_Examples',
      relativePath: 'Code_Examples',
    });

    // Create all 5 attachment types on the SAME post (Section 6)
    await Attachment.create([
      {
        post: dsaRoadmapPost._id,
        type: 'video',
        originalName: 'DSA_Roadmap.mp4',
        mimeType: 'video/mp4',
        size: 120 * 1024 * 1024, // 120 MB
        storageKey: 'dsa_roadmap_demo_video.mp4',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', // working demo video
        relativePath: 'DSA_Roadmap.mp4',
        metadata: { duration: 932, thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=80' },
        status: 'ready',
      },
      {
        post: dsaRoadmapPost._id,
        type: 'image',
        originalName: 'Roadmap_Image.png',
        mimeType: 'image/png',
        size: 2.4 * 1024 * 1024, // 2.4 MB
        storageKey: 'roadmap_flowchart.png',
        url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&auto=format&fit=crop&q=80',
        relativePath: 'Roadmap_Image.png',
        metadata: { width: 1920, height: 1080 },
        status: 'ready',
      },
      {
        post: dsaRoadmapPost._id,
        type: 'file',
        originalName: 'DSA_Notes.pdf',
        mimeType: 'application/pdf',
        size: 4.8 * 1024 * 1024, // 4.8 MB
        storageKey: 'dsa_notes.pdf',
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        relativePath: 'DSA_Notes.pdf',
        status: 'ready',
      },
      {
        post: dsaRoadmapPost._id,
        type: 'file',
        originalName: 'Practice_Questions.zip',
        mimeType: 'application/zip',
        size: 12 * 1024 * 1024, // 12 MB
        storageKey: 'practice_questions.zip',
        url: 'https://example.com/files/practice_questions.zip',
        relativePath: 'Practice_Questions.zip',
        status: 'ready',
      },
      {
        post: dsaRoadmapPost._id,
        folder: codeFolder._id,
        type: 'file',
        originalName: 'Tree_Traversal.cpp',
        mimeType: 'text/x-c++',
        size: 14 * 1024,
        storageKey: 'tree_traversal.cpp',
        url: 'https://example.com/files/tree_traversal.cpp',
        relativePath: 'Code_Examples/Tree_Traversal.cpp',
        status: 'ready',
      },
      {
        post: dsaRoadmapPost._id,
        folder: codeFolder._id,
        type: 'file',
        originalName: 'Graph_Algorithms.java',
        mimeType: 'text/x-java',
        size: 28 * 1024,
        storageKey: 'graph_algorithms.java',
        url: 'https://example.com/files/graph_algorithms.java',
        relativePath: 'Code_Examples/Graph_Algorithms.java',
        status: 'ready',
      },
    ]);

    // Create Poll attached to the DSA Roadmap post
    const poll = await Poll.create({
      post: dsaRoadmapPost._id,
      question: 'Which language are you using for DSA?',
      options: [
        { text: 'C++', votesCount: 62 },
        { text: 'Java', votesCount: 24 },
        { text: 'Python', votesCount: 10 },
        { text: 'Other (Comment below)', votesCount: 4 },
      ],
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    });

    await PollVote.create({
      poll: poll._id,
      user: rahul._id,
      option: 0,
    });

    // 5. Create Comments for the DSA Roadmap Post (including Accepted Answer test)
    console.log('[Seeder] Creating nested comments...');
    const comment1 = await Comment.create({
      post: dsaRoadmapPost._id,
      author: rahul._id,
      body: 'Excellent roadmap Vansh! For anyone preparing for upcoming summer internships, I strongly suggest finishing Striver A2Z Sheet along with LeetCode Top 150 Interview questions. Consistent daily practice of 2-3 questions makes a huge difference.',
      isAccepted: true, // Marked as accepted answer by Vansh!
      likes: [vansh._id, sneha._id, drRakesh._id],
    });

    // Nested reply to comment 1
    await Comment.create({
      post: dsaRoadmapPost._id,
      author: priya._id,
      parentComment: comment1._id,
      body: 'Thank you Rahul bhaiya! As a 1st year student, should I start directly with C++ STL or learn basic syntax first?',
      likes: [vansh._id],
    });

    const comment2 = await Comment.create({
      post: dsaRoadmapPost._id,
      author: sneha._id,
      body: 'The PDF notes have very neat diagrams for AVL Trees and Segment Trees. Highly appreciated!',
      likes: [vansh._id],
    });

    // 6. Create Additional Realistic Discussions (matching Reference 1 & 4)
    console.log('[Seeder] Creating supplementary discussions...');
    const post2 = await Post.create({
      author: aman._id,
      community: cseComm._id,
      type: 'question',
      title: 'Best resources to learn DSA for placements?',
      body: 'Hey everyone, I am mentoring 3rd year students who want to strengthen their DSA for upcoming placement seasons. Can you all share the best resources (free or paid) that actually helped you? Also if possible, share a proper roadmap you followed.',
      tags: ['DSA', 'Placements', 'Roadmap', 'Resources'],
      status: 'published',
      isQuestion: true,
      likes: [rahul._id, vansh._id, sneha._id],
      saves: [karan._id],
      helpfulVotes: [rahul._id, vansh._id],
      viewsCount: 2100,
      commentsCount: 42,
    });

    await Comment.create({
      post: post2._id,
      author: rahul._id,
      body: "Here is what worked for me:\n1. Striver's A2Z DSA Sheet (best for structured learning)\n2. LeetCode (for consistent problem solving)\n3. CodeStudio (good for company-wise questions)\nSolve previous year questions of companies you are targeting. Consistency is the key!",
      isAccepted: true,
      likes: [aman._id, vansh._id],
    });

    const post3 = await Post.create({
      author: sneha._id,
      community: cseComm._id,
      type: 'resource',
      title: 'Complete Operating Systems Notes (with PDF + Diagrams)',
      body: "I've compiled my complete OS notes from class lectures and standard reference books. Topics include Process Synchronization, Virtual Memory, CPU Scheduling, and File Systems. Hope this helps your semester and placement prep!",
      tags: ['OperatingSystems', 'Notes', 'Placements', 'CoreCS'],
      status: 'published',
      likes: [vansh._id, rahul._id, karan._id],
      saves: [priya._id, karan._id],
      viewsCount: 1840,
      commentsCount: 18,
    });

    await Attachment.create([
      {
        post: post3._id,
        type: 'file',
        originalName: 'OS_Complete_Notes.pdf',
        mimeType: 'application/pdf',
        size: 3.8 * 1024 * 1024,
        storageKey: 'os_notes.pdf',
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        relativePath: 'OS_Complete_Notes.pdf',
        status: 'ready',
      },
      {
        post: post3._id,
        type: 'file',
        originalName: 'System_Calls_Diagrams.png',
        mimeType: 'image/png',
        size: 1.2 * 1024 * 1024,
        storageKey: 'system_calls.png',
        url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1000&auto=format&fit=crop&q=80',
        relativePath: 'System_Calls_Diagrams.png',
        status: 'ready',
      },
    ]);

    const post4 = await Post.create({
      author: karan._id,
      community: placementComm._id,
      type: 'discussion',
      title: 'My Internship Experience at Wipro (3 Months)',
      body: 'Just completed my 3-month internship at Wipro! Sharing my experience, the interview process, work culture, things I learned, and some useful tips for anyone applying this year.',
      tags: ['Wipro', 'Internship', 'Experience', 'Placements'],
      status: 'published',
      likes: [vansh._id, rahul._id, sneha._id],
      saves: [priya._id],
      viewsCount: 1650,
      commentsCount: 24,
    });

    // Seed Pending Post for Moderation Approval Flow (Section 5)
    console.log('[Seeder] Creating Section 5 Pending Post for moderator review testing...');
    const pendingPost = await Post.create({
      author: priya._id,
      community: cseComm._id,
      type: 'question',
      title: 'Machine Learning Minor Project: CNN vs Vision Transformer Tradeoffs',
      body: 'I am comparing Vision Transformers and ResNet-50 for medical image classification. Would love guidance from seniors on batch size limitations with lab GPUs.',
      tags: ['MachineLearning', 'ComputerVision', 'ProjectDoubts'],
      status: 'pending',
      isQuestion: true,
      likes: [],
      saves: [],
      helpfulVotes: [],
    });

    // Seed Locked Post for Content State Machine testing (Section 4)
    console.log('[Seeder] Creating Section 4 Locked Announcement...');
    const lockedPost = await Post.create({
      author: drRakesh._id,
      community: cseComm._id,
      type: 'announcement',
      title: 'Official End-Semester Examination Hall Protocol & Practical Schedule',
      body: 'Official guidelines on admit card requirements, prohibited smartwatches, and lab practical batches. Comments are locked for this official notice.',
      tags: ['Official', 'Exams', 'CSE'],
      status: 'locked',
      allowComments: false,
      likes: [vansh._id, rahul._id],
      saves: [vansh._id, sneha._id],
      viewsCount: 3200,
    });

    // Seed Audit Log records (Section 8 & 19)
    console.log('[Seeder] Creating initial audit log records...');
    await AuditLog.create([
      {
        actor: drRakesh._id,
        action: 'pin_post',
        targetType: 'post',
        targetId: dsaRoadmapPost._id.toString(),
        community: cseComm._id,
        details: { title: dsaRoadmapPost.title },
        ip: '127.0.0.1',
      },
      {
        actor: drRakesh._id,
        action: 'lock_post',
        targetType: 'post',
        targetId: lockedPost._id.toString(),
        community: cseComm._id,
        details: { title: lockedPost.title },
        ip: '127.0.0.1',
      },
    ]);

    // 7. Seed Events (matching Reference 1)
    console.log('[Seeder] Creating university events...');
    await Event.create([
      {
        community: cseComm._id,
        organizer: drRakesh._id,
        title: 'Tech Talk: From Campus to Career',
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        time: '02:00 PM - 04:30 PM',
        venue: 'Auditorium 1, Geeta University',
        description: 'Distinguished alumni share real-world strategies for breaking into top tier tech organizations.',
        category: 'Tech Talk',
        attendees: [vansh._id, rahul._id, sneha._id],
      },
      {
        community: codingComm._id,
        organizer: vansh._id,
        title: 'Hackathon 3.0: 24h Innovation Sprint',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        time: '09:00 AM Onwards',
        venue: 'CS Innovation Labs, 3rd Floor',
        description: 'Build impactful prototypes in Web3, AI, and Sustainable Tech. Cash prizes worth 1 Lakh INR.',
        category: 'Hackathon',
        attendees: [vansh._id, rahul._id, sneha._id, priya._id],
      },
      {
        community: placementComm._id,
        organizer: rahul._id,
        title: 'Resume Building & ATS Optimization Workshop',
        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        time: '04:00 PM - 06:00 PM',
        venue: 'Seminar Hall B',
        description: 'Learn how to format resumes that beat ATS scanners and highlight university projects effectively.',
        category: 'Workshop',
        attendees: [karan._id, priya._id],
      },
    ]);

    console.log('[Seeder] Database successfully seeded with full specification dataset!');
    process.exit(0);
  } catch (error) {
    console.error('[Seeder] Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
