const express = require("express");
const bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");

module.exports = (db) => {
  const router = express.Router();

  router.get("/inscriptions", async (req, res) => {
    const users = await db.collection("users").find().toArray();
    res.render("users/validation", { users });
  });

  router.post("/validate/:id", async (req, res) => {
    await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { active: true } }
      );
    res.redirect("/users/inscriptions");
  });
  router.get("/register", (req, res) => {
    res.render("auth/register", { error: null });
  });

  router.post("/register", async (req, res) => {
  const { login, password, prenom, nom } = req.body;

  if (!login || !password) {
    return res.render("auth/register", { error: "Login et mot de passe obligatoires" });
  }

  const existingUser = await db.collection("users").findOne({ login });
  if (existingUser) {
    return res.render("auth/register", { error: "Login déjà utilisé" });
  }

  const hash = await bcrypt.hash(password, 10);

  await db.collection("users").insertOne({
    login,
    password: hash,
    prenom,
    nom,
    active: false,
    role: "apprenant",
  });

  res.redirect("/login");
});

  router.get("/profil", async (req, res) => {
    const user = await db.collection("users").findOne({
      login: req.session.user.login,
    });
    res.render("users/profile", { user });
  });

  router.post("/profil", async (req, res) => {
    const { login, password } = req.body;
    const updates = { login };
    if (password) updates.password = await bcrypt.hash(password, 10);
    await db
      .collection("users")
      .updateOne({ login: req.session.user.login }, { $set: updates });
    req.session.user.login = login;
    res.redirect("/users/profil");
  });

  return router;
};
