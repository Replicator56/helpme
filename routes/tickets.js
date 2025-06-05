const express = require('express');
const { ObjectId } = require('mongodb');

module.exports = (db) => {
  const router = express.Router();

  // Middleware pour vérifier que l'utilisateur est connecté
  function isLoggedIn(req, res, next) {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    next();
  }

  // Liste des tickets (les non supprimés)
  router.get('/', isLoggedIn, async (req, res) => {
    const tickets = await db.collection('tickets')
      .find({ deleted: { $ne: true } })
      .sort({ dateCreation: 1 })
      .toArray();
    res.render('tickets/list', { tickets, user: req.session.user });
  });

  // Afficher le formulaire de création
  router.get('/create', isLoggedIn, (req, res) => {
    res.render('tickets/form', { ticket: {}, errors: {} });
  });

  // Création du ticket
  router.post('/create', isLoggedIn, async (req, res) => {
    const { titre, description } = req.body;
    const errors = {};

    if (!titre || titre.trim() === '') errors.titre = 'Le titre est obligatoire';
    if (!description || description.length < 3) errors.description = 'La description doit faire au moins 3 caractères';

    if (Object.keys(errors).length > 0) {
      return res.render('tickets/form', { ticket: { titre, description }, errors });
    }

    await db.collection('tickets').insertOne({
      auteur: req.session.user.login,
      titre,
      description,
      dateCreation: new Date(),
      etat: 'ouvert',
      deleted: false
    });
    res.redirect('/tickets');
  });

  // Afficher un ticket avec ses réponses
  router.get('/:id', isLoggedIn, async (req, res) => {
    const ticket = await db.collection('tickets').findOne({ _id: new ObjectId(req.params.id) });
    if (!ticket || ticket.deleted) {
      return res.status(404).send('Ticket non trouvé');
    }
    const reponses = await db.collection('reponses').find({ ticketId: ticket._id }).toArray();
    res.render('tickets/detail', { ticket, reponses, user: req.session.user });
  });

  // Formulaire édition ticket
  router.get('/:id/edit', isLoggedIn, async (req, res) => {
    const ticket = await db.collection('tickets').findOne({ _id: new ObjectId(req.params.id) });
    if (!ticket || ticket.deleted) {
      return res.status(404).send('Ticket non trouvé');
    }
    if (req.session.user.login !== ticket.auteur) {
      return res.status(403).send('Accès refusé');
    }
    res.render('tickets/form', { ticket, errors: {} });
  });

  // Modifier un ticket
  router.post('/:id/edit', isLoggedIn, async (req, res) => {
    const { titre, description, etat } = req.body;
    const ticketId = new ObjectId(req.params.id);
    const ticket = await db.collection('tickets').findOne({ _id: ticketId });

    if (!ticket || ticket.deleted) {
      return res.status(404).send('Ticket non trouvé');
    }
    if (req.session.user.login !== ticket.auteur) {
      return res.status(403).send('Accès refusé');
    }

    const errors = {};
    if (!titre || titre.trim() === '') errors.titre = 'Le titre est obligatoire';
    if (!description || description.length < 3) errors.description = 'La description doit faire au moins 3 caractères';
    if (etat !== 'ouvert' && etat !== 'clos') errors.etat = 'État invalide';

    if (Object.keys(errors).length > 0) {
      return res.render('tickets/form', { ticket: { ...ticket, titre, description, etat }, errors });
    }

    await db.collection('tickets').updateOne(
      { _id: ticketId },
      { $set: { titre, description, etat } }
    );

    res.redirect(`/tickets/${req.params.id}`);
  });

  // Répondre à un ticket
  router.post('/:id/repondre', isLoggedIn, async (req, res) => {
    await db.collection('reponses').insertOne({
      ticketId: new ObjectId(req.params.id),
      auteur: req.session.user.login,
      texte: req.body.texte,
      dateCreation: new Date()
    });
    res.redirect(`/tickets/${req.params.id}`);
  });

  // Fermer un ticket
  router.post('/:id/close', isLoggedIn, async (req, res) => {
    await db.collection('tickets').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { etat: 'clos' } }
    );
    res.redirect('/tickets');
  });

  // Supprimer un ticket (soft delete)
  router.post('/:id/delete', isLoggedIn, async (req, res) => {
    const ticket = await db.collection('tickets').findOne({ _id: new ObjectId(req.params.id) });
    if (!ticket || ticket.deleted) {
      return res.redirect('/tickets');
    }
    if (req.session.user.login === ticket.auteur || req.session.user.role === 'formateur') {
      await db.collection('tickets').updateOne(
        { _id: ticket._id },
        { $set: { deleted: true } }
      );
    }
    res.redirect('/tickets');
  });

  return router;
};
