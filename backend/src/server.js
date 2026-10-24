import app from './app.js';
import { connectDB } from './config/db.js';
import { EMAIL_VERIFICATION_REQUIRED, PORT } from './config/env.js';
import { User } from './models/User.js';

const startServer = async () => {
  try {
    await connectDB();

    // Old demo registrations were marked verified from email format alone.
    // In production, require a recorded verification timestamp before trusting that state.
    if (EMAIL_VERIFICATION_REQUIRED) {
      const migration = await User.updateMany(
        { isDeleted: { $ne: true }, verified: true, $or: [{ emailVerifiedAt: null }, { emailVerifiedAt: { $exists: false } }] },
        { $set: { verified: false } }
      );
      if (migration.modifiedCount > 0) {
        console.warn(`[Email verification] Marked ${migration.modifiedCount} legacy account(s) unverified; they must complete email verification.`);
      }
    }

    const server = app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(`Geeta University Discussion Platform Backend`);
      console.log(`Server running on: http://localhost:${PORT}`);
      console.log(`API base endpoint: http://localhost:${PORT}/api`);
      console.log(`====================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
