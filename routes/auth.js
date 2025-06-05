const express = require("express");
const bcrypt = require("bcrypt");
const { loginUser } = require("../services/userService");

module.exports = (db) => {
  const router = express.Router();

  router.get("/login", (req, res) => {
    res.render("auth/login", { error: null });
  });

  router.post("/login", async (req, res) => {
    const { login, password } = req.body;
    if (login === "formateur") {
      console.log("pwd", process.env.FORMATEUR_PWD);
      if (password === process.env.FORMATEUR_PWD) {
        req.session.user = { login: "formateur", role: "formateur" };
        console.log("Formateur connecté :", req.session.user);
        return res.redirect("/tickets");
      } else {
        return res.render("auth/login", {
          error: "Mot de passe formateur incorrect",
        });
      }
    }
    const user = await loginUser(login, password);
    if (!user) {
      return res.render("auth/login", {
        error: "Utilisateur non valide ou mot de passe incorrect",
      });
    }
    if (!user.active) {
      return res.render("auth/login", {
        error: "Votre compte n’est pas encore activé.",
      });
    }
    req.session.user = { login: user.login, id: user._id, role: "apprenant" };
    res.redirect("/tickets");
  });

  router.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/login"));
  });

router.get("/register", async (req, res) => {
    try {
      const users = await db.collection("users").find().toArray();
      res.render("auth/register", {
        errors: {},
        user: req.session.user || null,
        users, // ici tu passes la liste des users à la vue
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Erreur serveur");
    }
  });

  router.post("/register", async (req, res) => {
    const { login, password, prenom, nom } = req.body;
    const errors = {};

    if (!login || login.trim() === "") errors.login = "Le login est requis";
    if (!password || password.length < 6)
      errors.password = "Le mot de passe doit faire au moins 6 caractères";

    if (Object.keys(errors).length > 0) {
      // Recharger la liste des utilisateurs pour l'affichage du tableau en cas d'erreur
      const users = await db.collection("users").find().toArray();
      return res.render("auth/register", {
        errors,
        user: req.session.user || null,
        users,
      });
    }

    // Ici, tu peux hasher le password et insérer l'utilisateur dans la base
    const bcrypt = require("bcrypt");
    const hash = await bcrypt.hash(password, 10);

    try {
      await db.collection("users").insertOne({
        login,
        password: hash,
        prenom,
        nom,
        active: false,
        role: "apprenant",
      });
      res.redirect("/login");
    } catch (err) {
      console.error(err);
      errors.general = "Erreur lors de l'enregistrement";
      const users = await db.collection("users").find().toArray();
      res.render("auth/register", {
        errors,
        user: req.session.user || null,
        users,
      });
    }
  });

  return router;
};