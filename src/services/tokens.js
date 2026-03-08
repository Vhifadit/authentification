const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Access token (court durée)
const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });
};

// Refresh token (longue durée, stocké en base)
const generateRefreshToken = () => {
  return uuidv4();
};

module.exports = { generateAccessToken, generateRefreshToken };