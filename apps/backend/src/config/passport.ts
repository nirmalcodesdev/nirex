import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
import type { OAuthProfile } from '../types/index.js';

// Passport strategies are configured here for completeness and potential
// server-side redirect flows, but the primary REST API uses manual code
// exchange in auth.service.ts for a stateless, SPA-friendly architecture.
// Session serialization is explicitly disabled — JWT handles auth state.
export function configurePassport(): void {
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user as Express.User));

  // ── Google OAuth2 ────────────────────────────────────────────────────────

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: env.GOOGLE_CALLBACK_URL,
          scope: ['profile', 'email'],
        },
        (_accessToken, _refreshToken, profile, done) => {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            logger.warn('Google OAuth: no email in profile', { profileId: profile.id });
            return done(new Error('Google account has no associated email address'));
          }

          const normalized: OAuthProfile = {
            id: profile.id,
            email,
            fullName: profile.displayName ?? 'Unknown',
          };

          return done(null, normalized as unknown as Express.User);
        }
      )
    );
  } // end Google guard

  // ── GitHub OAuth2 ────────────────────────────────────────────────────────

  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_CALLBACK_URL) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          callbackURL: env.GITHUB_CALLBACK_URL,
          scope: ['user:email'],
        },
        (
          _accessToken: string,
          _refreshToken: string,
          profile: {
            id: string;
            displayName?: string;
            username?: string;
            emails?: Array<{ value: string; primary?: boolean }>;
          },
          done: (err: Error | null, user?: Express.User) => void
        ) => {
          const primaryEmail =
            profile.emails?.find((e) => e.primary)?.value ??
            profile.emails?.[0]?.value;

          if (!primaryEmail) {
            logger.warn('GitHub OAuth: no email in profile', { profileId: profile.id });
            return done(new Error('GitHub account has no public email address'));
          }

          const normalized: OAuthProfile = {
            id: String(profile.id),
            email: primaryEmail,
            fullName: profile.displayName ?? profile.username ?? 'Unknown',
          };

          return done(null, normalized as unknown as Express.User);
        }
      )
    );
  } // end GitHub guard

  logger.info('Passport strategies configured');
}
