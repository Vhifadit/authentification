// Charge les variables d'environnement
require('dotenv').config();

// Charge Express
const express = require('express');

// Charge Prisma
const { prisma } = require('./src/config/database');

// Crée l'application
const app = express();

// Middleware pour lire le JSON dans les requêtes
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ✅ AJOUTE CETTE ROUTE - Page d'accueil
app.get('/', (req, res) => {
  res.json({ 
    message: 'API d\'authentification - Bienvenue ! 🚀',
    status: 'En ligne',
    endpoints: {
      users: {
        get: '/users - Liste tous les utilisateurs',
        post: '/users - Créer un utilisateur'
      }
    }
  });
});

// Route GET - Liste tous les utilisateurs
app.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route POST - Crée un utilisateur
app.post('/users', async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    const user = await prisma.user.create({
      data: {
        email,
        password,
        firstName,
        lastName,
      },
    });
    
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Démarre le serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});