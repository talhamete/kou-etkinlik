const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

// In-memory database (Gerçek projede MongoDB veya PostgreSQL kullanılabilir)
let events = [
  {
    id: 1,
    title: "Yapay Zeka ve Makine Öğrenmesi Semineri",
    description:
      "Endüstri profesyonelleri ile yapay zeka teknolojileri üzerine interaktif seminer",
    date: "2024-12-15",
    time: "14:00",
    location: "Mühendislik Fakültesi Konferans Salonu",
    capacity: 150,
    registered: 87,
    category: "akademik",
  },
  {
    id: 2,
    title: "Bahar Şenliği Konseri",
    description: "Ünlü sanatçıların katılımıyla düzenlenecek açık hava konseri",
    date: "2024-12-20",
    time: "18:00",
    location: "Kampüs Açık Hava Alanı",
    capacity: 500,
    registered: 324,
    category: "sosyal",
  },
  {
    id: 3,
    title: "Girişimcilik ve İnovasyon Atölyesi",
    description:
      "Başarılı girişimcilerle networking ve proje geliştirme workshop'u",
    date: "2024-12-18",
    time: "10:00",
    location: "Teknopark Eğitim Merkezi",
    capacity: 80,
    registered: 45,
    category: "kariyer",
  },
  {
    id: 4,
    title: "Spor Turnuvası - Basketbol",
    description: "Fakülteler arası basketbol turnuvası",
    date: "2024-12-22",
    time: "09:00",
    location: "Spor Kompleksi",
    capacity: 200,
    registered: 156,
    category: "spor",
  },
];

let registrations = [];
let nextEventId = 5;
let nextRegistrationId = 1;

// ==================== API ROUTES ====================

// Tüm etkinlikleri getir
app.get("/api/events", (req, res) => {
  res.json(events);
});

// Belirli bir etkinliği getir
app.get("/api/events/:id", (req, res) => {
  const event = events.find((e) => e.id === parseInt(req.params.id));
  if (!event) {
    return res.status(404).json({ error: "Etkinlik bulunamadı" });
  }
  res.json(event);
});

// Yeni etkinlik ekle
app.post("/api/events", (req, res) => {
  const { title, description, date, time, location, capacity, category } =
    req.body;

  if (!title || !date || !time || !location || !capacity) {
    return res.status(400).json({ error: "Tüm alanları doldurun" });
  }

  const newEvent = {
    id: nextEventId++,
    title,
    description: description || "",
    date,
    time,
    location,
    capacity: parseInt(capacity),
    registered: 0,
    category: category || "akademik",
  };

  events.push(newEvent);
  res.status(201).json(newEvent);
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
app.post("/api/registrations", (req, res) => {
  const { eventId, studentName, studentNumber, email, phone } = req.body;

  if (!eventId || !studentName || !studentNumber || !email) {
    return res.status(400).json({ error: "Gerekli alanları doldurun" });
  }

  const event = events.find((e) => e.id === parseInt(eventId));

  if (!event) {
    return res.status(404).json({ error: "Etkinlik bulunamadı" });
  }

  if (event.registered >= event.capacity) {
    return res.status(400).json({ error: "Etkinlik kontenjanı dolu" });
  }

  // Aynı öğrenci aynı etkinliğe birden fazla kayıt olamaz
  const existingRegistration = registrations.find(
    (r) => r.eventId === parseInt(eventId) && r.studentNumber === studentNumber
  );

  if (existingRegistration) {
    return res.status(400).json({ error: "Bu etkinliğe zaten kayıtlısınız" });
  }

  const newRegistration = {
    id: nextRegistrationId++,
    eventId: parseInt(eventId),
    studentName,
    studentNumber,
    email,
    phone: phone || "",
    registeredAt: new Date().toISOString(),
  };

  registrations.push(newRegistration);

  // Etkinliğin kayıtlı kişi sayısını artır
  event.registered++;

  res.status(201).json(newRegistration);
});

// Tüm kayıtları getir
app.get("/api/registrations", (req, res) => {
  res.json(registrations);
});

// Öğrenci numarasına göre kayıtları getir
app.get("/api/registrations/student/:studentNumber", (req, res) => {
  const studentRegistrations = registrations.filter(
    (r) => r.studentNumber === req.params.studentNumber
  );
  res.json(studentRegistrations);
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

// Ana sayfa
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Server başlat
app.listen(PORT, () => {
  console.log(`🚀 Server çalışıyor: http://localhost:${PORT}`);
  console.log(`📚 Kocaeli Üniversitesi Etkinlik Sistemi`);
});
