const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = 3000;

// Set up middleware
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  session({
    secret: "your-secret-key",
    resave: false,
    saveUninitialized: true,
  }),
);

// Middleware to check if the user is logged in
function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
}

const query = (sql, values) => {
  return new Promise((resolve, reject) => {
    db.query(sql, values, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
};

// Route for the homepage
app.get("/", (req, res) => {
  res.render("index");
});

// Route for user registration
app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 8);

  try {
    const results = await query("SELECT * FROM users WHERE email = ?", [email]);

    if (results.length > 0) {
      res.render("register", {
        message: "Email already registered. Please log in.",
      });
    } else {
      await query(
        "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
        [username, email, hashedPassword],
      );
      res.redirect("/login");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route for user login
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const results = await query("SELECT * FROM users WHERE email = ?", [email]);

    if (results.length > 0) {
      const user = results[0];

      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        req.session.user = user;
        res.redirect("/dashboard");
      } else {
        res.render("login", { message: "Incorrect password" });
      }
    } else {
      res.render("login", { message: "User not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route for user dashboard
app.get("/dashboard", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;

  try {
    const notes = await query(
      "SELECT * FROM notes WHERE user_id = ? AND is_deleted = FALSE AND is_archived = FALSE ORDER BY pinned DESC, updated_at DESC",
      [userId],
    );
    const categories = await query(
      "SELECT * FROM categories WHERE user_id = ?",
      [userId],
    );

    const note_categories = await query(
      "SELECT * FROM note_categories WHERE note_id IN (SELECT id FROM notes WHERE user_id = ?)",
      [userId],
    );

    res.render("dashboard", {
      user: req.session.user,
      notes,
      categories,
      note_categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route for filtering notes by category
app.get("/filter-notes", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const categoryId = req.query.category; // Get the selected category ID from the query parameters

  try {
    const notes = await query(
      `SELECT notes.* FROM notes 
       JOIN note_categories ON notes.id = note_categories.note_id
       WHERE notes.user_id = ? AND note_categories.category_id = ? 
       AND notes.is_deleted = FALSE AND notes.is_archived = FALSE
       ORDER BY notes.pinned DESC, notes.updated_at DESC`,
      [userId, categoryId],
    );

    const categories = await query(
      "SELECT * FROM categories WHERE user_id = ?",
      [userId],
    );

    res.render("dashboard", {
      user: req.session.user,
      notes,
      categories,
      note_categories: [],
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route for creating a new note
app.post("/notes", isAuthenticated, async (req, res) => {
  const { title, content, ...categories } = req.body;
  const userId = req.session.user.id;

  try {
    const noteResult = await query(
      "INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)",
      [userId, title, content],
    );
    const noteId = noteResult.insertId;

    for (const category of Object.values(categories)) {
      const [existingCategory] = await query(
        "SELECT id FROM categories WHERE user_id = ? AND category_name = ?",
        [userId, category],
      );

      let categoryId;
      if (existingCategory) {
        categoryId = existingCategory.id;
      } else {
        const categoryResult = await query(
          "INSERT INTO categories (user_id, category_name) VALUES (?, ?)",
          [userId, category],
        );
        categoryId = categoryResult.insertId;
      }

      await query(
        "INSERT INTO note_categories (note_id, category_id) VALUES (?, ?)",
        [noteId, categoryId],
      );
    }

    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Pin a note
app.post("/notes/:id/pin", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user.id;

  try {
    await query(
      "UPDATE notes SET pinned = NOT pinned WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route for updating a note
app.post("/notes/:id/edit", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  const userId = req.session.user.id;

  try {
    await query(
      "UPDATE notes SET title = ?, content = ?, updated_at = NOW() WHERE id = ? AND user_id = ?",
      [title, content, id, userId],
    );
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route to display the archive page
app.get("/archive", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  try {
    const notes = await query(
      "SELECT * FROM notes WHERE user_id = ? AND is_archived = TRUE ORDER BY id DESC",
      [userId],
    );

    res.render("archive", { user: req.session.user, notes });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Move a note to the Archive
app.post("/notes/:id/archive", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user.id;

  try {
    await query(
      "UPDATE notes SET is_archived = TRUE WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Restore a note from the Archive
app.post("/notes/:id/restore-archived", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user.id;

  try {
    await query(
      "UPDATE notes SET is_archived = FALSE WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    res.redirect("/archive");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Move a note to the Recycle Bin
app.post("/notes/:id/delete", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user.id;
  const currentTimestamp = new Date();

  try {
    await query(
      "UPDATE notes SET is_deleted = TRUE, deleted_at = ? WHERE id = ? AND user_id = ?",
      [currentTimestamp, id, userId],
    );
    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Restore a note from the Recycle Bin
app.post("/notes/:id/restore", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user.id;

  try {
    await query(
      "UPDATE notes SET is_deleted = FALSE, deleted_at = NULL WHERE id = ? AND user_id = ?",
      [id, userId],
    );
    res.redirect("/recycle-bin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Permanently delete a note
app.post("/notes/:id/permanent-delete", isAuthenticated, async (req, res) => {
  const { id } = req.params;
  const userId = req.session.user.id;

  try {
    await query("DELETE FROM notes WHERE id = ? AND user_id = ?", [id, userId]);
    res.redirect("/recycle-bin");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route to display the Recycle Bin and auto delete notes older than 30 days
app.get("/recycle-bin", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  try {
    await query(
      "DELETE FROM notes WHERE user_id = ? AND is_deleted = TRUE AND deleted_at <= ?",
      [userId, cutoffDate],
    );

    const notes = await query(
      "SELECT * FROM notes WHERE user_id = ? AND is_deleted = TRUE ORDER BY id DESC",
      [userId],
    );

    res.render("recycle-bin", { user: req.session.user, notes });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route for user profile
app.get("/profile", isAuthenticated, (req, res) => {
  res.render("profile", { user: req.session.user });
});

app.post("/profile/update", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const newUsername = req.body.username;
  const newEmail = req.body.email;

  try {
    await query("UPDATE users SET username = ?, email = ? WHERE id = ?", [
      newUsername,
      newEmail,
      userId,
    ]);

    // Update session information
    req.session.user.username = newUsername;
    req.session.user.email = newEmail;

    res.redirect("/profile");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route to change password
app.post("/profile/change-password", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    return res.send("New password and confirmation password do not match.");
  }

  try {
    const results = await query("SELECT password FROM users WHERE id = ?", [
      userId,
    ]);

    const user = results[0];

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.send("Current password is incorrect.");
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 8);

    await query("UPDATE users SET password = ? WHERE id = ?", [
      hashedNewPassword,
      userId,
    ]);

    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route to delete account
app.post("/profile/delete-account", isAuthenticated, async (req, res) => {
  const userId = req.session.user.id;
  const { password } = req.body;

  try {
    const results = await query("SELECT password FROM users WHERE id = ?", [
      userId,
    ]);
    const user = results[0];

    if (!bcrypt.compareSync(password, user.password)) {
      return res.send("Incorrect password. Account deletion failed.");
    }

    await query("DELETE FROM users WHERE id = ?", [userId]);
    await query("DELETE FROM notes WHERE user_id = ?", [userId]);

    req.session.destroy((err) => {
      if (err) throw err;
      res.redirect("/");
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route for logout
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      res.status(500).send("Server error");
    } else {
      res.redirect("/");
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
