const { generateAccessToken, generateRefreshToken } = require('../services/tokens');
const { prisma } = require('../config/database');

const oauthController = {
  async googleCallback(req, res, next) {
    try {
      const user = req.user;

      const accessToken = generateAccessToken(user.id);
      const refreshTokenValue = generateRefreshToken();

      await prisma.refreshToken.create({
        data: {
          token: refreshTokenValue,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      res.json({
        message: 'Connexion OAuth réussie',
        accessToken,
        refreshToken: refreshTokenValue,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = oauthController;