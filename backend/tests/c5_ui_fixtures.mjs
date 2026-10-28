/**
 * C5 UI-MATRIX FIXTURES (additive, test-only).
 *
 * Why this exists:
 *   tests/c5_permission_matrix.mjs DELETES its own c5fx_* users in its cleanup
 *   step, so the "moderator holding only pin_posts" and "moderator holding no
 *   delegation" personas cannot be re-used for a live-browser UI run.
 *   This seeder (re)creates two PERSISTENT cse-discussion moderators so the
 *   browser matrix can be reproduced on demand.
 *
 * It changes NO authorization logic - it only inserts fixture users/memberships
 * through the same models the application uses.
 *
 * Run from backend/:  node tests/c5_ui_fixtures.mjs
 */
import bcrypt from 'bcryptjs';
import { connectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Community } from '../src/models/Community.js';
import { CommunityMember } from '../src/models/CommunityMember.js';
import { COMMUNITY_MEMBER_ROLES, DELEGATED_PERMISSIONS } from '../src/constants/index.js';

const PW = 'password123';
const CSE = 'cse-discussion';

const FIXTURES = [
  {
    email: 'c5ui_pinonly@geeta.edu.in',
    name: 'C5 UI PinOnly Mod',
    delegatedPermissions: [DELEGATED_PERMISSIONS.PIN_POSTS],
  },
  {
    email: 'c5ui_noperm@geeta.edu.in',
    name: 'C5 UI NoPerm Mod',
    delegatedPermissions: [],
  },
];

function assertTestDatabase() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run database-mutating tests in production.');
  }

  let databaseName = '';
  try {
    databaseName = new URL(process.env.MONGODB_URI || '').pathname.split('/').filter(Boolean)[0] || '';
  } catch {
    databaseName = '';
  }

  if (!/_test$/i.test(databaseName)) {
    throw new Error(
      'These tests mutate fixture records. Set MONGODB_URI to a disposable database whose name ends in "_test".'
    );
  }
}

async function main() {
  assertTestDatabase();
  await connectDB();
  const cse = await Community.findOne({ slug: CSE });
  if (!cse) throw new Error(`community ${CSE} missing - run the seed first`);

  const hash = await bcrypt.hash(PW, 10);

  for (const f of FIXTURES) {
    let user = await User.findOne({ email: f.email });
    if (!user) {
      user = await User.create({
        name: f.name,
        email: f.email,
        passwordHash: hash,
        role: 'student',
        verified: true,
        department: 'Computer Science & Engineering',
        year: '3rd Year',
      });
      console.log(`[C5-UI] created user ${f.email}`);
    } else {
      user.passwordHash = hash;
      await user.save();
      console.log(`[C5-UI] reset password for ${f.email}`);
    }

    const mem = await CommunityMember.findOne({ user: user._id, community: cse._id });
    if (!mem) {
      await CommunityMember.create({
        user: user._id,
        community: cse._id,
        role: COMMUNITY_MEMBER_ROLES.MODERATOR,
        status: 'active',
        canPost: true,
        delegatedPermissions: f.delegatedPermissions,
      });
      console.log(`[C5-UI] created cse membership (${f.delegatedPermissions.length} delegation(s)) for ${f.email}`);
    } else {
      mem.role = COMMUNITY_MEMBER_ROLES.MODERATOR;
      mem.status = 'active';
      mem.canPost = true;
      mem.delegatedPermissions = f.delegatedPermissions;
      await mem.save();
      console.log(`[C5-UI] updated cse membership (${f.delegatedPermissions.length} delegation(s)) for ${f.email}`);
    }
  }

  // Report the resulting server-side flags for each UI persona.
  const { permissionService } = await import('../src/services/permissionService.js');
  for (const f of FIXTURES) {
    const u = await User.findOne({ email: f.email });
    const flags = await permissionService.getModerationPermissions(u, cse);
    console.log(`[C5-UI] ${f.email} -> ${JSON.stringify(flags)}`);
  }

  console.log('[C5-UI] Fixtures ready.');
  process.exit(0);
}

main().catch((e) => {
  console.error('[C5-UI] FAILED:', e);
  process.exit(1);
});
