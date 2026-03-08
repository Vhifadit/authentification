const jwt = require('jsonwebtoken');
const { prisma } = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.substring(7);

    // Vérifier blacklist
    const blacklisted = await prisma.blacklistedAccessToken.findUnique({
      where: { token }
    });
    if (blacklisted) {
      return res.status(401).json({ error: 'Token révoqué' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || user.disabledAt) {
      return res.status(401).json({ error: 'Utilisateur invalide' });
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré' });
    }
    return res.status(401).json({ error: 'Token invalide' });
  }
};

module.exports = { authenticate };