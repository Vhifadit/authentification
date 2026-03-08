const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const sessionController = require('../controllers/sessionController');

// Lister ses sessions
router.get('/', authenticate, sessionController.getSessions);

// Révoquer une session spécifique
router.delete('/:id', authenticate, sessionController.revokeSession);

// Révoquer toutes les autres sessions
router.delete('/others', authenticate, sessionController.revokeOtherSessions);

module.exports = router;