const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');
const { generateAccessToken, generateRefreshToken } = require('../services/tokens');

const twoFactorController = {
  // ============================================
  // ÉTAPE 1 : Générer le secret et QR code
  // ============================================
  async setup2FA(req, res, next) {
    try {
      const userId = req.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (user.twoFactorEnabledAt) {
        return res.status(400).json({ error: 'Le 2FA est déjà activé' });
      }

      // Générer un secret
      const secret = speakeasy.generateSecret({
        name: `MonApp (${user.email})`,
        length: 32
      });

      // Sauvegarder temporairement le secret
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret.base32 }
      });

      // Générer le QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      res.json({
        message: 'Scannez ce QR code avec Google Authenticator',
        secret: secret.base32,
        qrCode: qrCodeUrl
      });

    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // ÉTAPE 2 : Vérifier et activer 2FA
  // ============================================
  async verifyAndEnable2FA(req, res, next) {
    try {
      const { token } = req.body;
      const userId = req.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user.twoFactorSecret) {
        return res.status(400).json({ error: 'Configuration non initiée' });
      }

      if (user.twoFactorEnabledAt) {
        return res.status(400).json({ error: '2FA déjà activé' });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2
      });

      if (!verified) {
        return res.status(400).json({ error: 'Code invalide' });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabledAt: new Date() }
      });

      res.json({ message: '2FA activé avec succès !' });

    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // DÉSACTIVER LE 2FA
  // ============================================
  async disable2FA(req, res, next) {
    try {
      const { token } = req.body;
      const userId = req.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user.twoFactorEnabledAt) {
        return res.status(400).json({ error: '2FA non activé' });
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: token,
        window: 2
      });

      if (!verified) {
        return res.status(400).json({ error: 'Code invalide' });
      }

      await prisma.user.update({
        where: { id: userId },
        data: { 
          twoFactorEnabledAt: null,
          twoFactorSecret: null
        }
      });

      res.json({ message: '2FA désactivé' });

    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // VÉRIFICATION 2FA LORS DU LOGIN
  // ============================================
  async verify2FALogin(req, res, next) {
    try {
      const { tempToken, twoFactorCode } = req.body;

      if (!tempToken || !twoFactorCode) {
        return res.status(400).json({ error: 'Token et code requis' });
      }

      const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);

      if (!decoded.pending2FA) {
        return res.status(400).json({ error: 'Token invalide' });
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 2
      });

      if (!verified) {
        return res.status(401).json({ error: 'Code 2FA invalide' });
      }

      // Générer les tokens finaux
      const accessToken = generateAccessToken(user.id);
      const refreshTokenValue = generateRefreshToken();

      await prisma.refreshToken.create({
        data: {
          token: refreshTokenValue,
          userId: user.id,
          userAgent: req.headers['user-agent'],
          ipAddress: req.ip,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.loginHistory.create({
        data: {
          userId: user.id,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          success: true,
        },
      });

      res.json({
        message: 'Connexion réussie',
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
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Session expirée' });
      }
      next(error);
    }
  }
};

module.exports = twoFactorController;