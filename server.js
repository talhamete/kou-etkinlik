const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const cookieParser = require("cookie-parser");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;
let db;

// veritabanı ve server başlat
async function startServer() {
  try {
    // db dosyasını aç
    db = await open({
      filename: "kou_etkinlik.db",
      driver: sqlite3.Database,
    });

    console.log("Veritabanı dosyası açıldı.");

    // tabloları oluştur
    await db.exec(`
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT,
                description TEXT,
                date TEXT,
                time TEXT,
                location TEXT,
                capacity INTEGER,
                registered INTEGER DEFAULT 0,
                category TEXT
            )
        `);

    await db.exec(`
            CREATE TABLE IF NOT EXISTS registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                eventId INTEGER,
                userId TEXT,
                date TEXT
            )
        `);

    await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                userId INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                role INTEGER,
                studentNo TEXT UNIQUE,
                password TEXT,
                phoneNo TEXT
            )
        `);

    // admin kullanıcısını ekle
    await db.run(
      "INSERT OR IGNORE INTO users (name, role, studentNo, password, phoneNo) VALUES ('talha', 1, 'admin', '1234', '123456789')"
    );

    // sunucuyu başlat
    app.listen(PORT, () => {
      console.log(`Server çalışıyor: http://localhost:${PORT}`);
      console.log(`Kocaeli Üniversitesi Etkinlik Sistemi`);
    });
  } catch (error) {
    console.error("Veritabanı başlatılırken hata oluştu:", error);
  }
}

startServer();

// etkinlikleri getir
app.get("/api/events", async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM events ORDER BY date, time");
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Veritabanı hatası" });
  }
});

// etkinlik ekle
app.post("/api/events", async (req, res) => {
  const { title, description, date, time, location, capacity, category } =
    req.body;

  if (!title || !date || !time || !location || !capacity) {
    return res
      .status(400)
      .json({ error: "Lütfen tüm zorunlu alanları doldurun." });
  }

  try {
    const result = await db.run(
      `INSERT INTO events (title, description, date, time, location, capacity, category, registered) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        title,
        description || "",
        date,
        time,
        location,
        parseInt(capacity),
        category || "akademik",
      ]
    );
    res
      .status(201)
      .json({ message: "Etkinlik kaydedildi.", id: result.lastID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Etkinlik kaydedilemedi." });
  }
});

// kayıt ol
app.post("/api/registrations", async (req, res) => {
  const { eventId, userId, date } = req.body;
  const cookieData = req.cookies.user ? JSON.parse(req.cookies.user) : null;

  if (!cookieData) return res.status(401).json({ error: "Giriş yapmalısınız" });

  try {
    const event = await db.get("SELECT * FROM events WHERE id = ?", eventId);
    if (!event) return res.status(404).json({ error: "Etkinlik bulunamadı" });
    if (event.registered >= event.capacity)
      return res.status(400).json({ error: "Kontenjan dolu" });

    const existing = await db.get(
      "SELECT * FROM registrations WHERE eventId = ? AND userId = ?",
      [eventId, cookieData.studentNo]
    );
    if (existing) return res.status(400).json({ error: "Zaten kayıtlısınız" });

    const result = await db.run(
      "INSERT INTO registrations (eventId, userId, date) VALUES (?, ?, ?)",
      [eventId, cookieData.studentNo, new Date().toISOString()]
    );
    await db.run(
      "UPDATE events SET registered = registered + 1 WHERE id = ?",
      eventId
    );

    res.status(201).json({ message: "Kayıt başarılı", id: result.lastID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Veritabanı hatası" });
  }
});

// öğrencinin kayıtları
app.get("/api/registrations/student/:studentNumber", async (req, res) => {
  try {
    const rows = await db.all(
      "SELECT * FROM registrations WHERE userId = ? ORDER BY date DESC",
      [req.params.studentNumber]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Veritabanı hatası" });
  }
});

// giriş yap
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await db.get(
      "SELECT * FROM users WHERE studentNo = ? AND password = ?",
      [username, password]
    );

    if (user) {
      const userCookie = {
        name: user.name,
        studentNo: user.studentNo,
        role: user.role,
        phoneNo: user.phoneNo,
      };
      res.cookie("user", JSON.stringify(userCookie), { maxAge: 3600000 });
      res.redirect("/");
    } else {
      res.redirect("/login?error=invalid");
    }
  } catch (e) {
    console.error(e);
    res.status(500).send("Login hatası");
  }
});

app.get("/events", (req, res) => {
  const cookieData = req.cookies.user;
  if (cookieData) {
    res.sendFile(path.join(__dirname, "events", "index.html"));
  } else {
    res.redirect("/");
  }
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login", "index.html"));
});
app.get("/logout", (req, res) => {
  res.clearCookie("user");
  res.redirect("/");
});

app.get("/", (req, res) => {
  const cookieData = req.cookies.user;
  if (cookieData) {
    res.redirect("/events");
  } else {
    res.redirect("/login");
  }
});

// aktif kullanıcı
app.get("/api/currentUser", (req, res) => {
  if (req.cookies.user) {
    res.json(JSON.parse(req.cookies.user));
  } else {
    res.json(null);
  }
});

// öğrenci ekle
app.post("/api/users", async (req, res) => {
  const { name, studentNo, password, phoneNo } = req.body;

  if (!name || !studentNo || !password || !phoneNo) {
    return res
      .status(400)
      .json({ error: "Lütfen tüm zorunlu alanları doldurun." });
  }

  try {
    const result = await db.run(
      `INSERT INTO users (name, role, studentNo, password, phoneNo) VALUES (?, ?, ?, ?, ?)`,

      [name, 0, studentNo, password, phoneNo]
    );
    res.status(201).json({ message: "Öğrenci kaydedildi.", id: result.lastID });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Öğrenci kaydedilemedi." });
  }
});
