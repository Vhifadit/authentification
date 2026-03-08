const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { prisma } = require('../config/database');
const { generateAccessToken, generateRefreshToken } = require('../services/tokens');

const authController = {
  // ============================================
  // INSCRIPTION
  // ============================================
  async register(req, res, next) {
    try {
      const { email, password, firstName, lastName } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'Cet email est déjà utilisé' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: { 
          email, 
          password: hashedPassword, 
          firstName, 
          lastName
        },
      });

      // Générer token de vérification
      const verificationToken = uuidv4();
      
      await prisma.verificationToken.create({
        data: {
          token: verificationToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // Envoyer l'email (simulation)
      const verificationLink = `http://localhost:3000/api/verificationMail/verify?token=${verificationToken}`;
      
      console.log('=================================');
      console.log('📧 EMAIL DE VÉRIFICATION');
      console.log('À:', user.email);
      console.log('Lien:', verificationLink);
      console.log('=================================');

      res.status(201).json({
        message: 'Inscription réussie ! Vérifiez votre email pour activer votre compte.',
        user: { 
          id: user.id, 
          email, 
          firstName, 
          lastName 
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // CONNEXION (AVEC 2FA ET VÉRIFICATION EMAIL)
  // ============================================
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || user.disabledAt) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      // Vérifier si email est vérifié (sauf OAuth)
      if (!user.emailVerifiedAt && user.password) {
        return res.status(403).json({ 
          error: 'Email non vérifié. Vérifiez votre boîte mail ou demandez un nouveau lien.',
          needsVerification: true
        });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        await prisma.loginHistory.create({
          data: {
            userId: user.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            success: false,
          },
        });
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      // SI 2FA ACTIVÉ : renvoyer token temporaire
      if (user.twoFactorEnabledAt) {
        const tempToken = jwt.sign(
          { userId: user.id, pending2FA: true },
          process.env.JWT_SECRET,
          { expiresIn: '5m' }
        );

        return res.json({
          requires2FA: true,
          tempToken: tempToken,
          message: 'Code 2FA requis'
        });
      }

      // Connexion normale
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
          email, 
          firstName: user.firstName, 
          lastName: user.lastName 
        },
      });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // DÉCONNEXION
  // ============================================
  async logout(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const accessToken = authHeader.substring(7);
      const decoded = jwt.decode(accessToken);

      await prisma.blacklistedAccessToken.create({
        data: {
          token: accessToken,
          userId: req.userId,
          expiresAt: new Date(decoded.exp * 1000),
        },
      });

      const { refreshToken } = req.body;
      if (refreshToken) {
        await prisma.refreshToken.updateMany({
          where: { token: refreshToken, userId: req.userId },
          data: { revokedAt: new Date() },
        });
      }

      res.json({ message: 'Déconnexion réussie' });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // REFRESH TOKEN
  // ============================================
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token manquant' });
      }

      const tokenRecord = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
      });

      if (!tokenRecord || tokenRecord.revokedAt || tokenRecord.expiresAt < new Date()) {
        return res.status(401).json({ error: 'Refresh token invalide' });
      }

      const newAccessToken = generateAccessToken(tokenRecord.userId);
      res.json({ accessToken: newAccessToken });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // MOT DE PASSE OUBLIÉ
  // ============================================
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      if (user) {
        const resetToken = generateRefreshToken();
        await prisma.passwordResetToken.create({
          data: {
            token: resetToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });

        console.log('Token reset:', resetToken);
      }

      res.json({ message: 'Si cet email existe, un lien a été envoyé' });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // RÉINITIALISATION DU MOT DE PASSE
  // ============================================
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      const resetRecord = await prisma.passwordResetToken.findUnique({
        where: { token },
      });

      if (!resetRecord || resetRecord.expiresAt < new Date()) {
        return res.status(400).json({ error: 'Token invalide ou expiré' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: resetRecord.userId },
        data: { password: hashedPassword },
      });

      await prisma.passwordResetToken.delete({ where: { id: resetRecord.id } });

      await prisma.refreshToken.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      res.json({ message: 'Mot de passe réinitialisé' });
    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // CHANGEMENT DE MOT DE PASSE
  // ============================================
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({ where: { id: req.userId } });

      const validPassword = await bcrypt.compare(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: req.userId },
        data: { password: hashedPassword },
      });

      await prisma.refreshToken.updateMany({
        where: { userId: req.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      res.json({ message: 'Mot de passe modifié. Veuillez vous reconnecter.' });
    } catch (error) {
      next(error);
    }
  },
};

module.exports = authController;