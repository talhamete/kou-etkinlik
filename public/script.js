const API_URL = "/api";
let currentUser = undefined;
// sayfa açılınca çalışacak
document.addEventListener("DOMContentLoaded", async () => {
  // etkinlikleri çek
  loadEvents();

  // kullanıcı bilgisi al
  try {
    const response = await fetch(`${API_URL}/currentUser`);
    if (response.ok) {
      currentUser = await response.json();
      console.log("Aktif Kullanıcı:", currentUser);
    }
  } catch (err) {
    console.log("Kullanıcı oturumu yok.");
  }
  // formları dinle
  document
    .getElementById("addEventForm")
    .addEventListener("submit", handleAddEvent);
  document
    .getElementById("addStudentForm")
    .addEventListener("submit", handleAddStudent);

  if (currentUser.role == 0) {
    document.getElementById("addEventTab").style.display = "none";
    document.getElementById("event-add-nav").style.display = "none";
    document.getElementById("addStudentTab").style.display = "none";
    document.getElementById("student-add-nav").style.display = "none";
  }
});

// sekme değiştir
function showTab(tabName) {
  // önce hepsini gizle
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });

  // butonları pasif yap
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // seçili sekmeyi aç
  const tabs = {
    events: "eventsTab",
    myRegistrations: "myRegistrationsTab",
    addEvent: "addEventTab",
    addStudent: "addStudentTab",
  };

  document.getElementById(tabs[tabName]).classList.add("active");

  // tıklanan butona aktif class ekle
  const buttons = document.querySelectorAll(".nav-btn");
  const tabIndex = Object.keys(tabs).indexOf(tabName);
  if (buttons[tabIndex]) {
    buttons[tabIndex].classList.add("active");
  }
}

// etkinlikleri getir
async function loadEvents() {
  try {
    const response = await fetch(`${API_URL}/events`);
    const events = await response.json();
    displayEvents(events);
  } catch (error) {
    console.error("Etkinlikler yüklenemedi:", error);
    alert("Etkinlikler yüklenirken bir hata oluştu!");
  }
}

// ekrana yazdır
function displayEvents(events) {
  console.log("displayevent");
  const container = document.getElementById("eventsContainer");

  if (events.length === 0) {
    container.innerHTML =
      '<p style="color: white; text-align: center; padding: 2rem;">Henüz etkinlik bulunmamaktadır.</p>';
    return;
  }

  container.innerHTML = events
    .map(
      (event) => `
        <div class="event-card">
            <div class="event-header">
                <h3 class="event-title">${event.title}</h3>
                <span class="category-badge category-${event.category}">
                    ${getCategoryName(event.category)}
                </span>
            </div>
            <p class="event-description">${event.description}</p>
            <div class="event-info">
                <div class="info-item">📅 ${formatDate(event.date)}</div>
                <div class="info-item">🕐 ${event.time}</div>
                <div class="info-item">📍 ${event.location}</div>
                <div class="info-item">👥 ${event.registered} / ${
        event.capacity
      } katılımcı</div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${
                  (event.registered / event.capacity) * 100
                }%"></div>
            </div>
            <button 
                class="btn btn-primary" 
                onclick="registerToEvent(${event.id})"
                ${event.registered >= event.capacity ? "disabled" : ""}
            >
                ${
                  event.registered >= event.capacity
                    ? "Kontenjan Dolu"
                    : "Kayıt Ol"
                }
            </button>
        </div>
    `
    )
    .join("");
}

// kategori ismini döndür
function getCategoryName(category) {
  const names = {
    akademik: "Akademik",
    sosyal: "Sosyal",
    kariyer: "Kariyer",
    spor: "Spor",
  };
  return names[category] || category;
}

// tarihi düzenle
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// kategoriye göre filtrele
async function filterEvents() {
  const category = document.getElementById("categoryFilter").value;

  try {
    const response = await fetch(`${API_URL}/events`);
    const events = await response.json();

    if (category === "all") {
      displayEvents(events);
    } else {
      const filtered = events.filter((e) => e.category === category);
      displayEvents(filtered);
    }
  } catch (error) {
    console.error("Filtreleme hatası:", error);
  }
}
// yeni öğrenci kaydet
async function handleAddStudent(e) {
  e.preventDefault();

  const studentData = {
    name: document.getElementById("studentName").value,
    studentNo: document.getElementById("studentNo").value,
    password: document.getElementById("studentPassword").value,
    phoneNo: document.getElementById("studentPhoneNo").value,
  };

  try {
    const response = await fetch(`${API_URL}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(studentData),
    });

    if (response.ok) {
      alert("Öğrenci başarıyla eklendi!");
      document.getElementById("addStudentForm").reset();
      loadEvents();
      showTab("events");
    } else {
      const error = await response.json();
      alert("Hata: " + error.error);
    }
  } catch (error) {
    console.error("Öğrenci eklenirken hata:", error);
    alert("Öğrenci eklenirken bir hata oluştu!");
  }
}

// etkinlik kaydet
async function handleAddEvent(e) {
  e.preventDefault();

  const eventData = {
    title: document.getElementById("eventTitle").value,
    description: document.getElementById("eventDescription").value,
    date: document.getElementById("eventDate").value,
    time: document.getElementById("eventTime").value,
    location: document.getElementById("eventLocation").value,
    capacity: document.getElementById("eventCapacity").value,
    category: document.getElementById("eventCategory").value,
  };

  try {
    const response = await fetch(`${API_URL}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(eventData),
    });

    if (response.ok) {
      alert("Etkinlik başarıyla eklendi!");
      document.getElementById("addEventForm").reset();
      loadEvents();
      showTab("events");
    } else {
      const error = await response.json();
      alert("Hata: " + error.error);
    }
  } catch (error) {
    console.error("Etkinlik eklenirken hata:", error);
    alert("Etkinlik eklenirken bir hata oluştu!");
  }
}

// etkinliğe kaydol
async function registerToEvent(eventId) {
  // giriş yapmış mı kontrol et
  if (!currentUser) {
    alert("Lütfen önce giriş yapın!");
    window.location.href = "/login";
    return;
  }

  const registrationData = {
    eventId: eventId,
    userId: currentUser.studentNo,
    date: Date.now(),
  };

  try {
    const response = await fetch(`${API_URL}/registrations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registrationData),
    });

    if (response.ok) {
      alert("Kayıt başarıyla tamamlandı!");
      loadEvents();
    } else {
      const error = await response.json();
      alert("Hata: " + error.error);
    }
  } catch (error) {
    console.error("Kayıt hatası:", error);
    alert("Kayıt sırasında bir hata oluştu!");
  }
}

// öğrencinin kayıtlarını getir
async function loadMyRegistrations() {
  const studentNumber = currentUser.studentNo;

  if (!studentNumber) {
    alert("Lütfen öğrenci numaranızı girin!");
    return;
  }

  try {
    console.log("sa");
    const regsResponse = await fetch(
      `${API_URL}/registrations/student/${studentNumber}`
    );
    const eventsResponse = await fetch(`${API_URL}/events`);
    console.log(regsResponse);
    const registrations = await regsResponse.json();
    const events = await eventsResponse.json();
    console.log(registrations);
    displayMyRegistrations(registrations, events);
  } catch (error) {
    console.error("Kayıtlar yüklenemedi:", error);
    alert("Kayıtlar yüklenirken bir hata oluştu!");
  }
}

// kayıtları listele
async function displayMyRegistrations(registrations, events) {
  const container = document.getElementById("myRegistrationsContainer");

  if (registrations.length === 0) {
    container.innerHTML = `
            <div style="background: white; padding: 3rem; text-align: center; border-radius: 12px; margin-top: 2rem;">
                <p style="color: #666; font-size: 1.1rem;">Henüz hiçbir etkinliğe kayıt olmadınız.</p>
            </div>
        `;
    return;
  }

  container.innerHTML = registrations
    .map((reg) => {
      const event = events.find((e) => e.id === reg.eventId);
      if (!event) return "";

      return `
            <div class="registration-card">
                <div class="registration-header">
                    <div>
                        <h3 class="registration-title">${event.title}</h3>
                        <span class="category-badge category-${event.category}">
                            ${getCategoryName(event.category)}
                        </span>
                    </div>
                </div>
                <div class="registration-info">
                    <div><strong>Ad Soyad:</strong> ${currentUser.name}</div>
                    <div><strong>Öğrenci No:</strong> ${
                      currentUser.studentNo
                    }</div>
                    <div><strong>Telefon No:</strong> ${
                      currentUser.phoneNo
                    }</div>
                    <div><strong>Kayıt Tarihi:</strong> ${formatDate(
                      reg.date
                        ? reg.date.split("T")[0]
                        : new Date().toISOString()
                    )}</div>
                    <div><strong>Etkinlik Tarihi:</strong> ${formatDate(
                      event.date
                    )}</div>
                    <div><strong>Saat:</strong> ${event.time}</div>
                    <div><strong>Konum:</strong> ${event.location}</div>
                </div>
            </div>
        `;
    })
    .join("");
}

function logout() {
  window.location.href = `/logout`;
}
