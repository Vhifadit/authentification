const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const { prisma } = require('./database');

// GOOGLE (déjà existant)
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/oauth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const googleId = profile.id;

        let oauthAccount = await prisma.oAuthAccount.findFirst({
          where: {
            provider: 'google',
            providerId: googleId,
          },
          include: { user: true },
        });

        if (oauthAccount) {
          return done(null, oauthAccount.user);
        }

        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              firstName: profile.name.givenName,
              lastName: profile.name.familyName,
              emailVerifiedAt: new Date(), // OAuth = email vérifié
            },
          });
        }

        await prisma.oAuthAccount.create({
          data: {
            provider: 'google',
            providerId: googleId,
            userId: user.id,
          },
        });

        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

// GITHUB (nouveau)
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: '/api/oauth/github/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const githubId = profile.id;

        let oauthAccount = await prisma.oAuthAccount.findFirst({
          where: {
            provider: 'github',
            providerId: githubId,
          },
          include: { user: true },
        });

        if (oauthAccount) {
          return done(null, oauthAccount.user);
        }

        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email,
              firstName: profile.displayName?.split(' ')[0] || profile.username,
              lastName: profile.displayName?.split(' ')[1] || '',
              emailVerifiedAt: new Date(), // OAuth = email vérifié
            },
          });
        }

        await prisma.oAuthAccount.create({
          data: {
            provider: 'github',
            providerId: githubId,
            userId: user.id,
          },
        });

        return done(null, user);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

module.exports = passport;