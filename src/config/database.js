// Charge le client Prisma généré
const { PrismaClient } = require('@prisma/client');

// Crée une instance du client
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'], // Affiche les requêtes SQL dans le terminal
});

// Exporte pour l'utiliser ailleurs
module.exports = { prisma };