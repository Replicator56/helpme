const express = require("express");
const session = require("express-session");
const path = require("path");
const { connectToDb } = require("./config/db");

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "eni-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.render("home");
});

(async () => {
  try {
    const db = await connectToDb();

    // Enregistrement des routes
    const authRoutes = require("./routes/auth")(db);
    const userRoutes = require("./routes/users")(db);
    const ticketRoutes = require("./routes/tickets")(db);


    app.use("/", authRoutes);
    app.use("/users", userRoutes);
    app.use("/tickets", ticketRoutes);


    app.listen(PORT, () => {
      console.log(`Serveur lancé sur http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Erreur de connexion à la base de données:", err);
  }
})();
