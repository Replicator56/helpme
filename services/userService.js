const { ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const { getDb } = require("../config/db");

async function loginUser(login, password) {
  const db = await getDb();
  const user = await db.collection("users").findOne({ login });
  if (!user) return null;
  const match = await bcrypt.compare(password, user.password);
  return match ? user : null;
}

async function getUserByLogin(login) {
  const db = await getDb();
  return await db.collection("users").findOne({ login });
}

async function registerUser(user) {
  const db = await getDb();
  const hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  user.active = false;
  user.role = "apprenant";
  return await db.collection("users").insertOne(user);
}

async function validateUser(id) {
  const db = await getDb();
  return await db
    .collection("users")
    .updateOne({ _id: new ObjectId(id) }, { $set: { active: true } });
}

async function updateUserProfile(id, newLogin, newPassword) {
  const db = await getDb();
  const update = { login: newLogin };
  if (newPassword) {
    update.password = await bcrypt.hash(newPassword, 10);
  }
  return await db
    .collection("users")
    .updateOne({ _id: new ObjectId(id) }, { $set: update });
}

module.exports = {
  loginUser,
  getUserByLogin,
  registerUser,
  validateUser,
  updateUserProfile,
};
