const express = require('express');
const router = express.Router();
const verificationMail = require('../controllers/verificationMail');

// Routes de vérification email
router.post('/send', verificationMail.sendVerificationEmail);
router.get('/verify', verificationMail.verifyEmail);
router.post('/resend', verificationMail.resendVerificationEmail);

module.exports = router;