const { MongoClient } = require('mongodb');

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const dbName = 'eni_soft_ticket_app';

let db = null;
let client = null;

async function connectToDb() {
  if (db) return db;

  client = new MongoClient(url);
  await client.connect();

  db = client.db(dbName);
  console.log(`Connecté à la base MongoDB: ${dbName}`);

  return db;
}

async function getDb() {
  if (!db) {
    db = await connectToDb();
  }
  return db;
}

module.exports = { connectToDb, getDb };
