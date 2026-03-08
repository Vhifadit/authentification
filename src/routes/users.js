const express = require('express');
const router = express.Router();
const { prisma } = require('../config/database');
const { authenticate } = require('../middlewares/auth');

// GET /api/users - Liste tous les utilisateurs (protégé)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerifiedAt: true,
        twoFactorEnabledAt: true,
        createdAt: true
      }
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
});

// GET /api/users/me - Profil de l'utilisateur connecté
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerifiedAt: true,
        twoFactorEnabledAt: true,
        createdAt: true
      }
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// PUT /api/users/me - Modifier son profil
router.put('/me', authenticate, async (req, res, next) => {
  try {
    const { firstName, lastName } = req.body;
    
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { firstName, lastName },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        updatedAt: true
      }
    });
    
    res.json(user);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/users/me - Supprimer son compte
router.delete('/me', authenticate, async (req, res, next) => {
  try {
    await prisma.user.delete({
      where: { id: req.userId }
    });
    
    res.json({ message: 'Compte supprimé avec succès' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;