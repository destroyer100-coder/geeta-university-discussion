# Trusted Platform Admin Bootstrap

Platform administrator access is never granted through public registration or the normal admin dashboard.

## Preconditions

1. Register the intended account through the normal registration flow.
2. Verify its email address. The bootstrap command refuses unverified accounts.
3. Use a trusted terminal with access to the intended MongoDB environment.
4. Confirm the backend environment variables point to the correct database.

## Run once

From the `backend` directory, set these variables only in the current trusted shell:

- `ALLOW_ADMIN_BOOTSTRAP=true`
- `ADMIN_BOOTSTRAP_EMAIL=the-exact-verified-account-email`

Then run:

```bash
npm run bootstrap:admin
```

The command asks you to type the exact email again before changing the account role. It refuses missing accounts, already-admin accounts, unverified accounts, and unconfirmed requests. It writes an audit entry and does not accept an email or role from an HTTP request.

Remove both variables from the shell after the command. Do not add them to deployment configuration, CI variables, source control, or a persistent `.env` file.

## Demo seeding

The destructive development seeder also requires `SEED_DEMO_PASSWORD` (at least 12 characters), in addition to its existing development and database safety gates. It no longer creates a Platform Admin account or uses a shared `password123` credential. Its demo community owner is a normal student account.

Never run the destructive seeder against production or a database containing real user data.
