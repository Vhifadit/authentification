const rateLimit = require('express-rate-limit');

// Limite générale
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes max
  message: { error: 'Trop de requêtes, réessayez plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite stricte pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max
  skipSuccessfulRequests: true, // Ne pas compter les succès
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
});

module.exports = { rateLimiter, authLimiter };