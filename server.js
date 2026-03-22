const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3000;

app.use(express.json());

// --- Connexion à SQLite ---
const db = new sqlite3.Database('./blog.db', (err) => {
    if (err) console.error(err.message);
    else console.log('Connecté à SQLite.');
});

// --- Création de la table articles ---
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titre TEXT NOT NULL,
        contenu TEXT,
        auteur TEXT NOT NULL,
        categorie TEXT,
        tags TEXT,
        date TEXT
    )`);
});

// --- CRÉER un article ---
app.post('/api/articles', (req, res) => {
    const { titre, contenu, auteur, categorie, tags } = req.body;
    if (!titre || !auteur) return res.status(400).json({ message: "Titre et auteur obligatoires" });

    const date = new Date().toISOString().split('T')[0];
    const tagsString = tags ? JSON.stringify(tags) : null;

    const sql = `INSERT INTO articles (titre, contenu, auteur, categorie, tags, date)
                 VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [titre, contenu, auteur, categorie, tagsString, date], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        db.get(`SELECT * FROM articles WHERE id = ?`, [this.lastID], (err, row) => {
            res.status(201).json(row);
        });
    });
});

// --- LIRE tous les articles ---
app.get('/api/articles', (req, res) => {
    db.all(`SELECT * FROM articles`, [], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.status(200).json(rows);
    });
});

// --- FILTRER par catégorie/date ---
app.get('/api/articles/filter', (req, res) => {
    const { categorie, date } = req.query;
    let sql = "SELECT * FROM articles WHERE 1=1";
    let params = [];
    if (categorie) {
        sql += " AND categorie = ?";
        params.push(categorie);
    }
    if (date) {
        sql += " AND date = ?";
        params.push(date);
    }
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.status(200).json(rows);
    });
});

// --- RECHERCHER par texte ---
app.get('/api/articles/search', (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(400).json({ message: "Query manquant" });

    const sql = `SELECT * FROM articles WHERE titre LIKE ? OR contenu LIKE ?`;
    const param = `%${query}%`;
    db.all(sql, [param, param], (err, rows) => {
        if (err) return res.status(500).json({ message: err.message });
        res.status(200).json(rows);
    });
});

// --- LIRE un article par ID ---
app.get('/api/articles/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM articles WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: "Article non trouvé" });
        res.status(200).json(row);
    });
});

// --- MODIFIER un article ---
app.put('/api/articles/:id', (req, res) => {
    const { id } = req.params;
    const { titre, contenu, categorie, tags } = req.body;

    db.get(`SELECT * FROM articles WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ message: err.message });
        if (!row) return res.status(404).json({ message: "Article non trouvé" });

        const updatedTitre = titre || row.titre;
        const updatedContenu = contenu || row.contenu;
        const updatedCategorie = categorie || row.categorie;
        const updatedTags = tags ? JSON.stringify(tags) : row.tags;

        const sql = `UPDATE articles SET titre=?, contenu=?, categorie=?, tags=? WHERE id=?`;
        db.run(sql, [updatedTitre, updatedContenu, updatedCategorie, updatedTags, id], function(err) {
            if (err) return res.status(500).json({ message: err.message });
            db.get(`SELECT * FROM articles WHERE id = ?`, [id], (err, updatedRow) => {
                res.status(200).json({ message: "Article modifié", article: updatedRow });
            });
        });
    });
});

// --- SUPPRIMER un article ---
app.delete('/api/articles/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM articles WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: "Article non trouvé" });
        res.status(200).json({ message: "Article supprimé" });
    });
});

// --- Test serveur ---
app.get('/', (req, res) => {
    res.send("API Blog opérationnelle");
});

// --- Lancer le serveur ---
app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
