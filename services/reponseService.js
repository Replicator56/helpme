// services/reponseService.js
const { ObjectId } = require('mongodb');

async function getReponsesForTicket(db, ticketId) {
  return await db.collection('reponses').find({ ticketId: new ObjectId(ticketId) }).sort({ dateCreation: 1 }).toArray();
}

async function addReponseToTicket(db, ticketId, auteur, texte) {
  const reponse = {
    ticketId: new ObjectId(ticketId),
    auteur,
    texte,
    dateCreation: new Date()
  };
  return await db.collection('reponses').insertOne(reponse);
}

module.exports = { getReponsesForTicket, addReponseToTicket };
