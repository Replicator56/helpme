const app = require('./app');
const MongoClient = require('mongodb').MongoClient;
const bcrypt = require('bcrypt');
require('dotenv').config();

const ticketService = require('./services/ticketService');
const reponseService = require('./services/reponseService');
const userService = require('./services/userService');

const PORT = process.env.PORT || 3000;
const DB_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = 'eni_ticket_app';

let db;

// Middleware pour vérifier si utilisateur est connecté
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

// Middleware pour vérifier si formateur
function isFormateur(req, res, next) {
  if (req.session.user && req.session.user.role === 'formateur') return next();
  res.status(403).send('Accès interdit');
}

// Initialisation du formateur par défaut
async function initFormateur(db) {
  const login = 'formateur';
  const existing = await db.collection('users').findOne({ login });
  if (!existing) {
    const hashed = await bcrypt.hash(process.env.FORMATEUR_PASSWORD || 'formateur', 10);
    await db.collection('users').insertOne({
      login,
      password: hashed,
      prenom: 'Formateur',
      nom: 'ENI',
      role: 'formateur',
      active: true
    });
    console.log('Formateur initialisé.');
  }
}

MongoClient.connect(DB_URL).then(async client => {
  db = client.db(DB_NAME);
  await initFormateur(db);

  // --- Routes ---

  app.get('/login', (req, res) => {
    res.render('auth/login', { error: null });
  });

  app.post('/login', async (req, res) => {
    const { login, password } = req.body;
    const user = await userService.getUserByLogin(db, login);
    if (user && await bcrypt.compare(password, user.password)) {
      if (user.active || user.role === 'formateur') {
        req.session.user = user;
        res.redirect('/');
      } else {
        res.render('auth/login', { error: 'Compte non activé' });
      }
    } else {
      res.render('auth/login', { error: 'Identifiants invalides' });
    }
  });

  app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
  });

  // Page d'accueil avec liste des tickets
  app.get('/', isAuthenticated, async (req, res) => {
    const tickets = await ticketService.getAllTickets(db);
    res.render('tickets/list', { tickets, user: req.session.user });
  });

  // Affichage formulaire création ticket
  app.get('/tickets/new', isAuthenticated, (req, res) => {
    res.render('tickets/form', { ticket: {}, errors: {}, user: req.session.user });
  });

  // Création d'un ticket
  app.post('/tickets/new', isAuthenticated, async (req, res) => {
    const { titre, description } = req.body;
    const errors = {};
    if (!titre || titre.trim() === '') errors.titre = 'Titre obligatoire';
    if (!req.session.user) {
      return res.redirect('/login');
    }
    if (!description || description.trim().length < 3) errors.description = 'Description doit avoir au moins 3 caractères';

    if (Object.keys(errors).length > 0) {
      return res.render('tickets/form', { ticket: req.body, errors, user: req.session.user });
    }

    const ticket = {
      auteur: req.session.user.login,
      titre: titre.trim(),
      description: description.trim(),
    };
    await ticketService.createTicket(db, ticket);
    res.redirect('/');
  });

  // Détail d'un ticket avec ses réponses
  app.get('/tickets/:id', isAuthenticated, async (req, res) => {
    const ticket = await ticketService.getTicketById(db, req.params.id);
    if (!ticket) return res.status(404).send('Ticket introuvable');
    const reponses = await reponseService.getReponsesForTicket(db, req.params.id);
    res.render('tickets/detail', { ticket, reponses, user: req.session.user });
  });

  // Modification ticket (GET)
  app.get('/tickets/:id/edit', isAuthenticated, async (req, res) => {
    const ticket = await ticketService.getTicketById(db, req.params.id);
    if (!ticket) return res.status(404).send('Ticket introuvable');

    // Vérifier si auteur ou formateur
    if (ticket.auteur !== req.session.user.login && req.session.user.role !== 'formateur') {
      return res.status(403).send('Modification interdite');
    }

    res.render('tickets/form', { ticket, errors: {}, user: req.session.user });
  });

  // Modification ticket (POST)
  app.post('/tickets/:id/edit', isAuthenticated, async (req, res) => {
    const ticket = await ticketService.getTicketById(db, req.params.id);
    if (!ticket) return res.status(404).send('Ticket introuvable');

    if (ticket.auteur !== req.session.user.login && req.session.user.role !== 'formateur') {
      return res.status(403).send('Modification interdite');
    }

    const { titre, description, etat } = req.body;
    const errors = {};
    if (!titre || titre.trim() === '') errors.titre = 'Titre obligatoire';
    if (!description || description.trim().length < 3) errors.description = 'Description doit avoir au moins 3 caractères';
    if (etat !== 'ouvert' && etat !== 'clos') errors.etat = 'État invalide';

    if (Object.keys(errors).length > 0) {
      return res.render('tickets/form', { ticket: { ...ticket, titre, description, etat }, errors, user: req.session.user });
    }

    // Mise à jour partielle
    await db.collection('tickets').updateOne(
      { _id: new require('mongodb').ObjectId(req.params.id) },
      { $set: { titre: titre.trim(), description: description.trim(), etat } }
    );

    res.redirect(`/tickets/${req.params.id}`);
  });

  // Suppression (soft delete) d'un ticket
  app.post('/tickets/:id/delete', isAuthenticated, async (req, res) => {
    const ticket = await ticketService.getTicketById(db, req.params.id);
    if (!ticket) return res.status(404).send('Ticket introuvable');

    if (ticket.auteur !== req.session.user.login && req.session.user.role !== 'formateur') {
      return res.status(403).send('Suppression interdite');
    }

    await ticketService.deleteTicket(db, req.params.id);
    res.redirect('/');
  });

  // Ajouter une réponse à un ticket
  app.post('/tickets/:id/reponses', isAuthenticated, async (req, res) => {
    const { texte } = req.body;
    if (!texte || texte.trim().length < 1) {
      return res.redirect(`/tickets/${req.params.id}`);
    }
    await reponseService.addReponseToTicket(db, req.params.id, req.session.user.login, texte.trim());
    res.redirect(`/tickets/${req.params.id}`);
  });

  // Inscription (page)
  app.get('/register', isAuthenticated, isFormateur, async (req, res) => {
    const users = await db.collection('users').find({ role: 'apprenant' }).toArray();
    res.render('auth/register', { users, user: req.session.user, errors: {} });
  });

  // Création utilisateur (inscription)
  app.post('/register', isAuthenticated, isFormateur, async (req, res) => {
    const { login, password, prenom, nom } = req.body;
    const errors = {};
    if (!login || login.trim() === '') errors.login = 'Login obligatoire';
    if (!password || password.length < 6) errors.password = 'Mot de passe trop court (6 caractères min)';
    if (!prenom || prenom.trim() === '') errors.prenom = 'Prénom obligatoire';
    if (!nom || nom.trim() === '') errors.nom = 'Nom obligatoire';

    const existUser = await userService.getUserByLogin(db, login);
    if (existUser) errors.login = 'Login déjà pris';

    if (Object.keys(errors).length > 0) {
      const users = await db.collection('users').find({ role: 'apprenant' }).toArray();
      return res.render('auth/register', { users, user: req.session.user, errors });
    }

    await userService.registerUser(db, { login: login.trim(), password, prenom: prenom.trim(), nom: nom.trim() });
    res.redirect('/register');
  });

  // Validation utilisateur par formateur (activation/désactivation)
  app.post('/register/:id/validate', isAuthenticated, isFormateur, async (req, res) => {
    await userService.validateUser(db, req.params.id);
    res.redirect('/register');
  });

  // Page profil utilisateur (modification login et mot de passe)
  app.get('/profile', isAuthenticated, (req, res) => {
    res.render('users/profile', { user: req.session.user, errors: {} });
  });

  app.post('/profile', isAuthenticated, async (req, res) => {
    const { login, password } = req.body;
    const errors = {};
    if (!login || login.trim() === '') errors.login = 'Login obligatoire';

    if (password && password.length > 0 && password.length < 6) {
      errors.password = 'Mot de passe trop court (6 caractères min)';
    }

    if (Object.keys(errors).length > 0) {
      return res.render('users/profile', { user: req.session.user, errors });
    }

    await userService.updateUserProfile(db, req.session.user._id, login.trim(), password && password.length >= 6 ? password : null);

    // Met à jour session
    req.session.user.login = login.trim();
    res.redirect('/profile');
  });

  app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));
}).catch(err => console.error('Erreur MongoDB :', err));
