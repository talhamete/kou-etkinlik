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

const PORT = 3000;

// Middleware
app.use(bodyParser.json());
//app.use(express.static("public"));
//app.use(express.static("public", { index: false }));
app.use(express.static(path.join(__dirname, "public")));

let db;

// Bu fonksiyon sunucu açılınca BİR KEZ çalışır ve tabloları oluşturur
async function initializeDB() {
  db = await open({
    filename: "kou_etkinlik.db", // Bu isimde bir dosya oluşacak
    driver: sqlite3.Database,
  });

  console.log("📂 Veritabanı dosyası açıldı.");

  // 1. Etkinlikler Tablosunu Oluştur (Eğer yoksa)
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

  // 2. Kayıtlar Tablosunu Oluştur
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
            studentNo TEXT,
            password TEXT,
            phoneNo TEXT
        )
    `);

  db.run(
    "INSERT INTO users (name,role, studentNo, password,phoneNo) VALUES ('talha',1, 'admin', '1234','123456789')"
  );
  db.run(
    "INSERT INTO users (name,role, studentNo, password,phoneNo) VALUES ('mete',0, '240229028', '5678','987654321')"
  );
}
// Veritabanını başlat
initializeDB();

// In-memory database (Gerçek projede MongoDB veya PostgreSQL kullanılabilir)
let events = [];

let registrations = [];
let nextEventId = 5;
let nextRegistrationId = 1;
let currentUser = undefined;

// ==================== API ROUTES ====================

// Tüm etkinlikleri getir
app.get("/api/events", async (req, res) => {
  try {
    const rows = await db.all("SELECT * FROM events ORDER BY date, time");
    res.json(rows);
  } catch (error) {
    console.error("Veritabanından etkinlikleri okuma hatası:", error);
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
    console.error("Etkinlik okuma hatası:", error);
    res.status(500).json({ error: "Veritabanı hatası" });
  }
});

// Yeni etkinlik ekle
app.post("/api/events", async (req, res) => {
  const { title, description, date, time, location, capacity, category } =
    req.body;

  // 1. Basit doğrulama
  if (!title || !date || !time || !location || !capacity) {
    return res
      .status(400)
      .json({ error: "Lütfen tüm zorunlu alanları doldurun." });
  }

  try {
    // 2. Veritabanına Ekleme (SQL)
    // registered başlangıçta 0'dır.
    const sql = `
        INSERT INTO events (title, description, date, time, location, capacity, category, registered) 
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
    `;

    const result = await db.run(sql, [
      title,
      description || "",
      date,
      time,
      location,
      parseInt(capacity), // Sayıya çevir
      category || "akademik",
    ]);

    // 3. Başarılı Cevap Dön
    res.status(201).json({
      message: "Etkinlik veritabanına kaydedildi.",
      id: result.lastID, // Yeni oluşan ID'yi döndür
    });
  } catch (error) {
    console.error("Veritabanı yazma hatası:", error);
    res.status(500).json({ error: "Sunucu hatası: Etkinlik kaydedilemedi." });
  }
});

// Etkinliği güncelle
app.put("/api/events/:id", (req, res) => {
  const eventIndex = events.findIndex((e) => e.id === parseInt(req.params.id));

  if (eventIndex === -1) {
    return res.status(404).json({ error: "Etkinlik bulunamadı" });
  }

  const { title, description, date, time, location, capacity, category } =
    req.body;

  events[eventIndex] = {
    ...events[eventIndex],
    title: title || events[eventIndex].title,
    description: description || events[eventIndex].description,
    date: date || events[eventIndex].date,
    time: time || events[eventIndex].time,
    location: location || events[eventIndex].location,
    capacity: capacity ? parseInt(capacity) : events[eventIndex].capacity,
    category: category || events[eventIndex].category,
  };

  res.json(events[eventIndex]);
});

// Etkinliği sil
app.delete("/api/events/:id", (req, res) => {
  const eventIndex = events.findIndex((e) => e.id === parseInt(req.params.id));

  if (eventIndex === -1) {
    return res.status(404).json({ error: "Etkinlik bulunamadı" });
  }

  events.splice(eventIndex, 1);
  res.json({ message: "Etkinlik silindi" });
});

// Etkinliğe kayıt ol
app.post("/api/registrations", async (req, res) => {
  const { eventId, userId, date } = req.body;

  // 1. Cookie'den kullanıcıyı doğrula (Güvenlik)
  const cookieData = req.cookies.user ? JSON.parse(req.cookies.user) : null;
  if (!cookieData) {
    return res.status(401).json({ error: "Giriş yapmalısınız" });
  }

  try {
    // 2. Etkinlik var mı ve kontenjan dolu mu?
    const event = await db.get("SELECT * FROM events WHERE id = ?", eventId);

    if (!event) {
      return res.status(404).json({ error: "Etkinlik bulunamadı" });
    }
    if (event.registered >= event.capacity) {
      return res.status(400).json({ error: "Etkinlik kontenjanı dolu" });
    }

    // 3. Zaten kayıtlı mı?
    const existing = await db.get(
      "SELECT * FROM registrations WHERE eventId = ? AND userId = ?",
      [eventId, cookieData.studentNo]
    );

    if (existing) {
      return res.status(400).json({ error: "Bu etkinliğe zaten kayıtlısınız" });
    }

    // 4. KAYIT İŞLEMİ (Veritabanına Ekle)
    const result = await db.run(
      "INSERT INTO registrations (eventId, userId, date) VALUES (?, ?, ?)",
      [eventId, cookieData.studentNo, new Date().toISOString()]
    );

    // 5. Etkinliğin sayacını artır
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
// Tüm kayıtları getir (SQLite)
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
    console.error("Kayıtları okuma hatası:", error);
    res.status(500).json({ error: "Veritabanı hatası" });
  }
});

// Etkinliğe göre kayıtları getir
app.get("/api/registrations/event/:eventId", (req, res) => {
  const eventRegistrations = registrations.filter(
    (r) => r.eventId === parseInt(req.params.eventId)
  );
  res.json(eventRegistrations);
});

// Kayıt iptal et
app.delete("/api/registrations/:id", (req, res) => {
  const regIndex = registrations.findIndex(
    (r) => r.id === parseInt(req.params.id)
  );

  if (regIndex === -1) {
    return res.status(404).json({ error: "Kayıt bulunamadı" });
  }

  const registration = registrations[regIndex];
  const event = events.find((e) => e.id === registration.eventId);

  if (event) {
    event.registered--;
  }

  registrations.splice(regIndex, 1);
  res.json({ message: "Kayıt iptal edildi" });
});

//login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  currentUser = await db.get(
    "SELECT * FROM users WHERE studentNo = ? AND password = ?",
    [username, password]
  );

  console.log(currentUser);
  if (currentUser) {
    const userCookie = {
      studentNo: currentUser.studentNo,
      role: currentUser.role,
      phoneNo: currentUser.phoneNo,
    };

    // 2. Bu paketi STRING (Yazı) haline getirip Cookie'ye basıyoruz
    // JSON.stringify() -> Objeyi yazıya çevirir.
    res.cookie("user", JSON.stringify(userCookie), { maxAge: 3600000 }); // 1 saatlik
  }
  res.redirect("/");
});

app.get("/events", (req, res) => {
  res.sendFile(path.join(__dirname, "events", "index.html"));
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login", "index.html"));
});
app.get("/logout", (req, res) => {
  res.clearCookie("user");
  res.redirect("/");
});

// Ana sayfa
app.get("/", (req, res) => {
  const cookieData = req.cookies.user;
  if (cookieData) {
    // Cookie verisi string gelir, onu tekrar objeye çevireli

    // İstersek role göre farklı dosya gönderebiliriz
    // Şimdilik herkesi index.html'e atıyoruz
    res.redirect("/events");
  } else {
    res.redirect("/login");
  }
});

app.get("/api/currentUser", (req, res) => {
  res.json(currentUser);
});

app.get("/api/users/:id", async (req, res) => {
  const id = req.params.id;

  try {
    // Hem ID'ye hem de Öğrenci Numarasına bakıyoruz, hangisi tutarsa.
    // Şifreyi (password) güvenlik gereği çekmiyoruz!
    const user = await db.get(
      "SELECT name, studentNo, role, phoneNo FROM users WHERE userId = ?",
      [id]
    );

    if (user) {
      res.json(user);
    } else {
      res.status(404).json({ error: "Kullanıcı bulunamadı" });
    }
  } catch (error) {
    res.status(500).json({ error: "Veritabanı hatası" });
  }
});

// Server başlat
app.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
  console.log(`📚 Kocaeli Üniversitesi Etkinlik Sistemi`);
});
