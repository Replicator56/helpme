// services/ticketService.js
const { ObjectId } = require('mongodb');

async function getAllTickets(db) {
  return await db.collection('tickets').find({ deleted: { $ne: true } }).sort({ dateCreation: 1 }).toArray();
}

async function getTicketById(db, id) {
  return await db.collection('tickets').findOne({ _id: new ObjectId(id), deleted: { $ne: true } });
}

async function createTicket(db, ticket) {
  ticket.dateCreation = new Date();
  ticket.etat = 'ouvert';
  ticket.deleted = false;
  return await db.collection('tickets').insertOne(ticket);
}

async function closeTicket(db, id) {
  return await db.collection('tickets').updateOne({ _id: new ObjectId(id) }, { $set: { etat: 'clos' } });
}

async function deleteTicket(db, id) {
  return await db.collection('tickets').updateOne({ _id: new ObjectId(id) }, { $set: { deleted: true } });
}

module.exports = { getAllTickets, getTicketById, createTicket, closeTicket, deleteTicket };