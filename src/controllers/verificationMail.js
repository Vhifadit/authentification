const { prisma } = require('../config/database');
const { sendEmail } = require('../services/email');
const { v4: uuidv4 } = require('uuid');

const verificationMail = {
  // ============================================
  // ENVOYER L'EMAIL DE VÉRIFICATION
  // ============================================
  async sendVerificationEmail(req, res, next) {
    try {
      const { userId } = req.body;

      // Vérifier si l'utilisateur existe
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({ error: 'Utilisateur non trouvé' });
      }

      // Vérifier si déjà vérifié
      if (user.emailVerifiedAt) {
        return res.status(400).json({ error: 'Email déjà vérifié' });
      }

      // Supprimer l'ancien token s'il existe
      await prisma.verificationToken.deleteMany({
        where: { userId }
      });

      // Créer un nouveau token
      const token = uuidv4();
      await prisma.verificationToken.create({
        data: {
          token,
          userId,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        },
      });

      // Envoyer l'email (simulation pour l'instant)
      const verificationLink = `http://localhost:3000/verify-email?token=${token}`;
      
      console.log('=================================');
      console.log('📧 EMAIL DE VÉRIFICATION');
      console.log('À:', user.email);
      console.log('Lien:', verificationLink);
      console.log('=================================');

      // TODO: Décommenter quand l'email est configuré
      // await sendEmail(
      //   user.email,
      //   'Vérifiez votre email',
      //   `<p>Cliquez sur ce lien: <a href="${verificationLink}">${verificationLink}</a></p>`
      // );

      res.json({ 
        message: 'Email de vérification envoyé',
        // En développement, on renvoie le lien pour tester
        verificationLink 
      });

    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // VÉRIFIER L'EMAIL (clic sur le lien)
  // ============================================
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ error: 'Token manquant' });
      }

      // Trouver le token
      const verificationToken = await prisma.verificationToken.findUnique({
        where: { token },
        include: { user: true }
      });

      if (!verificationToken) {
        return res.status(400).json({ error: 'Token invalide' });
      }

      // Vérifier expiration
      if (verificationToken.expiresAt < new Date()) {
        await prisma.verificationToken.delete({
          where: { id: verificationToken.id }
        });
        return res.status(400).json({ error: 'Token expiré' });
      }

      // Marquer l'email comme vérifié
      await prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerifiedAt: new Date() }
      });

      // Supprimer le token utilisé
      await prisma.verificationToken.delete({
        where: { id: verificationToken.id }
      });

      res.json({ 
        message: 'Email vérifié avec succès !',
        user: {
          id: verificationToken.user.id,
          email: verificationToken.user.email,
          emailVerifiedAt: new Date()
        }
      });

    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // RENVOYER L'EMAIL DE VÉRIFICATION
  // ============================================
  async resendVerificationEmail(req, res, next) {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({
        where: { email }
      });

      // Ne pas révéler si l'email existe ou pas (sécurité)
      if (!user || user.emailVerifiedAt) {
        return res.json({ 
          message: 'Si cet email existe et n\'est pas vérifié, un nouveau lien a été envoyé' 
        });
      }

      // Supprimer l'ancien token
      await prisma.verificationToken.deleteMany({
        where: { userId: user.id }
      });

      // Créer nouveau token
      const token = uuidv4();
      await prisma.verificationToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const verificationLink = `http://localhost:3000/verify-email?token=${token}`;
      
      console.log('=================================');
      console.log('📧 RENVOI EMAIL DE VÉRIFICATION');
      console.log('À:', user.email);
      console.log('Lien:', verificationLink);
      console.log('=================================');

      res.json({ 
        message: 'Si cet email existe et n\'est pas vérifié, un nouveau lien a été envoyé',
        verificationLink 
      });

    } catch (error) {
      next(error);
    }
  },
};

module.exports = verificationMail;