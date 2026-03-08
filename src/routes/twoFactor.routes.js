const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const twoFactorController = require('../controllers/twoFactorController');

// Routes protégées
router.post('/setup', authenticate, twoFactorController.setup2FA);
router.post('/enable', authenticate, twoFactorController.verifyAndEnable2FA);
router.post('/disable', authenticate, twoFactorController.disable2FA);

// Route publique (après login)
router.post('/verify-login', twoFactorController.verify2FALogin);

module.exports = router;