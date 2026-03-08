const { prisma } = require('../config/database');

const sessionController = {
  // ============================================
  // LISTER SES SESSIONS ACTIVES
  // ============================================
  async getSessions(req, res, next) {
    try {
      const userId = req.userId;

      const sessions = await prisma.refreshToken.findMany({
        where: {
          userId: userId,
          revokedAt: null,
          expiresAt: { gt: new Date() }
        },
        select: {
          id: true,
          userAgent: true,
          ipAddress: true,
          createdAt: true,
          expiresAt: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Marquer la session actuelle
      const currentTokenId = req.headers['x-refresh-token-id']; // Optionnel : si tu passes l'ID du refresh token

      const formattedSessions = sessions.map(session => ({
        ...session,
        isCurrent: false // On verra comment marquer la session courante plus tard
      }));

      res.json({
        count: sessions.length,
        sessions: formattedSessions
      });

    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // RÉVOQUER UNE SESSION SPÉCIFIQUE
  // ============================================
  async revokeSession(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.userId;

      // Vérifier que la session existe et appartient à l'utilisateur
      const session = await prisma.refreshToken.findFirst({
        where: {
          id: id,
          userId: userId,
          revokedAt: null
        }
      });

      if (!session) {
        return res.status(404).json({ error: 'Session non trouvée ou déjà révoquée' });
      }

      // Révoquer la session
      await prisma.refreshToken.update({
        where: { id: id },
        data: { revokedAt: new Date() }
      });

      res.json({ message: 'Session révoquée avec succès' });

    } catch (error) {
      next(error);
    }
  },

  // ============================================
  // RÉVOQUER TOUTES LES AUTRES SESSIONS
  // ============================================
  async revokeOtherSessions(req, res, next) {
    try {
      const userId = req.userId;
      const { currentRefreshToken } = req.body;

      if (!currentRefreshToken) {
        return res.status(400).json({ error: 'Token de la session actuelle requis' });
      }

      // Trouver la session actuelle
      const currentSession = await prisma.refreshToken.findUnique({
        where: { token: currentRefreshToken }
      });

      if (!currentSession || currentSession.userId !== userId) {
        return res.status(400).json({ error: 'Session invalide' });
      }

      // Révoquer toutes les autres sessions
      const result = await prisma.refreshToken.updateMany({
        where: {
          userId: userId,
          revokedAt: null,
          id: { not: currentSession.id }
        },
        data: { revokedAt: new Date() }
      });

      res.json({ 
        message: 'Toutes les autres sessions ont été révoquées',
        revokedCount: result.count
      });

    } catch (error) {
      next(error);
    }
  }
};

module.exports = sessionController;