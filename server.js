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

// ==================== VERİTABANI VE SERVER BAŞLATMA ====================
async function startServer() {
  try {
    // 1. Veritabanını Aç
    db = await open({
      filename: "kou_etkinlik.db",
      driver: sqlite3.Database,
    });

    console.log("📂 Veritabanı dosyası açıldı.");

    // 2. Tabloları Oluştur
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
                studentNo TEXT UNIQUE, -- Aynı öğrenci no tekrar eklenmesin diye UNIQUE
                password TEXT,
                phoneNo TEXT
            )
        `);

    // 3. Varsayılan Kullanıcıları Ekle (Hata vermemesi için try-catch içinde)

    // Sadece yoksa ekle mantığı veya insert or ignore
    await db.run(
      "INSERT OR IGNORE INTO users (name, role, studentNo, password, phoneNo) VALUES ('talha', 1, 'admin', '1234', '123456789')"
    );

    // 4. VERİTABANI HAZIR OLDUKTAN SONRA SERVER'I BAŞLAT
    app.listen(PORT, () => {
      console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
      console.log(`📚 Kocaeli Üniversitesi Etkinlik Sistemi`);
    });
  } catch (error) {
    console.error("Veritabanı başlatılırken hata oluştu:", error);
  }
}

// Sistemi Başlat
startServer();

// ==================== API ROUTES ====================

// Tüm etkinlikleri getir
app.get("/api/events", async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM events ORDER BY date, time");
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Veritabanı hatası" });
  }
});

// Belirli bir etkinliği getir
app.get("/api/events/:id", async (req, res) => {
  try {
    const event = await db.get("SELECT * FROM events WHERE id = ?", [
      req.params.id,
    ]);
    if (!event) return res.status(404).json({ error: "Etkinlik bulunamadı" });
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: "Veritabanı hatası" });
  }
});

// Yeni etkinlik ekle
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

// Etkinliği güncelle (DÜZELTİLDİ: Artık DB kullanıyor)
app.put("/api/events/:id", async (req, res) => {
  const { title, description, date, time, location, capacity, category } =
    req.body;
  const id = req.params.id;

  try {
    // Önce etkinlik var mı bak
    const event = await db.get("SELECT * FROM events WHERE id = ?", id);
    if (!event) return res.status(404).json({ error: "Etkinlik bulunamadı" });

    // Güncelle
    await db.run(
      `UPDATE events SET title=?, description=?, date=?, time=?, location=?, capacity=?, category=? WHERE id=?`,
      [
        title || event.title,
        description || event.description,
        date || event.date,
        time || event.time,
        location || event.location,
        capacity ? parseInt(capacity) : event.capacity,
        category || event.category,
        id,
      ]
    );

    const updatedEvent = await db.get("SELECT * FROM events WHERE id = ?", id);
    res.json(updatedEvent);
  } catch (error) {
    res.status(500).json({ error: "Güncelleme hatası" });
  }
});

// Etkinliği sil (DÜZELTİLDİ: Artık DB kullanıyor)
app.delete("/api/events/:id", async (req, res) => {
  try {
    const result = await db.run(
      "DELETE FROM events WHERE id = ?",
      req.params.id
    );
    if (result.changes === 0)
      return res.status(404).json({ error: "Etkinlik bulunamadı" });
    res.json({ message: "Etkinlik silindi" });
  } catch (error) {
    res.status(500).json({ error: "Silme hatası" });
  }
});

// Etkinliğe kayıt ol
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

// Tüm kayıtları getir
app.get("/api/registrations", async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM registrations");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Öğrenci numarasına göre kayıtları getir
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

// Etkinliğe göre kayıtları getir (DÜZELTİLDİ: DB Kullanıyor)
app.get("/api/registrations/event/:eventId", async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM registrations WHERE eventId = ?", [
      req.params.eventId,
    ]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "Veritabanı hatası" });
  }
});

// Kayıt iptal et (DÜZELTİLDİ: DB Kullanıyor)
app.delete("/api/registrations/:id", async (req, res) => {
  try {
    // Önce kaydı bul ki hangi event olduğunu bilelim
    const registration = await db.get(
      "SELECT * FROM registrations WHERE id = ?",
      req.params.id
    );
    if (!registration)
      return res.status(404).json({ error: "Kayıt bulunamadı" });

    // Kaydı sil
    await db.run("DELETE FROM registrations WHERE id = ?", req.params.id);

    // Event sayacını düşür
    await db.run(
      "UPDATE events SET registered = registered - 1 WHERE id = ?",
      registration.eventId
    );

    res.json({ message: "Kayıt iptal edildi" });
  } catch (error) {
    res.status(500).json({ error: "İptal hatası" });
  }
});

// Login
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
      res.redirect("/login?error=invalid"); // Hatalı giriş yönlendirmesi
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

// Mevcut kullanıcı bilgisi
app.get("/api/currentUser", (req, res) => {
  if (req.cookies.user) {
    res.json(JSON.parse(req.cookies.user));
  } else {
    res.json(null);
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await db.get(
      "SELECT name, studentNo, role, phoneNo FROM users WHERE userId = ?",
      [req.params.id]
    );
    if (user) res.json(user);
    else res.status(404).json({ error: "Kullanıcı bulunamadı" });
  } catch (error) {
    res.status(500).json({ error: "Veritabanı hatası" });
  }
});

app.get("/api/users", async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM users");
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Veritabanı hatası" });
  }
});

// Yeni etkinlik ekle
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
