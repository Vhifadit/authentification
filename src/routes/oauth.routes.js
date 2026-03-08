const express = require('express');
const router = express.Router();
const passport = require('passport');
const oauthController = require('../controllers/oauthController');

// Lancer la connexion Google
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
  })
);

// Callback Google
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false }),
  oauthController.googleCallback
);

module.exports = router;