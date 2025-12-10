const API_URL = "http://localhost:3000/api";

// Sayfa yüklendiğinde
document.addEventListener("DOMContentLoaded", () => {
  loadEvents();

  // Form submit handlers
  document
    .getElementById("addEventForm")
    .addEventListener("submit", handleAddEvent);
  document
    .getElementById("registrationForm")
    .addEventListener("submit", handleRegistration);
});

// Tab değiştirme
function showTab(tabName) {
  // Tüm tabları gizle
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });

  // Tüm nav butonlarını pasif yap
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // İlgili tabı göster
  const tabs = {
    events: "eventsTab",
    myRegistrations: "myRegistrationsTab",
    addEvent: "addEventTab",
  };

  document.getElementById(tabs[tabName]).classList.add("active");

  // Tıklanan butonu aktif yap
  const buttons = document.querySelectorAll(".nav-btn");
  const tabIndex = Object.keys(tabs).indexOf(tabName);
  if (buttons[tabIndex]) {
    buttons[tabIndex].classList.add("active");
  }
}

// Etkinlikleri yükle
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

// Etkinlikleri göster
function displayEvents(events) {
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
                onclick="openRegistrationModal(${event.id})"
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

// Kategori adı
function getCategoryName(category) {
  const names = {
    akademik: "Akademik",
    sosyal: "Sosyal",
    kariyer: "Kariyer",
    spor: "Spor",
  };
  return names[category] || category;
}

// Tarih formatla
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Etkinlik filtrele
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

// Yeni etkinlik ekle
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

// Kayıt modalını aç
function openRegistrationModal(eventId) {
  document.getElementById("modalEventId").value = eventId;
  document.getElementById("registrationModal").classList.add("active");
}

// Modalı kapat
function closeModal() {
  document.getElementById("registrationModal").classList.remove("active");
  document.getElementById("registrationForm").reset();
}

// Kayıt işlemi
async function handleRegistration(e) {
  e.preventDefault();

  const registrationData = {
    eventId: document.getElementById("modalEventId").value,
    studentName: document.getElementById("studentName").value,
    studentNumber: document.getElementById("studentNumber").value,
    email: document.getElementById("studentEmail").value,
    phone: document.getElementById("studentPhone").value,
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
      closeModal();
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

// Öğrenci kayıtlarını yükle
async function loadMyRegistrations() {
  const studentNumber = document
    .getElementById("studentNumberLookup")
    .value.trim();

  if (!studentNumber) {
    alert("Lütfen öğrenci numaranızı girin!");
    return;
  }

  try {
    const [regsResponse, eventsResponse] = await Promise.all([
      fetch(`${API_URL}/registrations/student/${studentNumber}`),
      fetch(`${API_URL}/events`),
    ]);

    const registrations = await regsResponse.json();
    const events = await eventsResponse.json();

    displayMyRegistrations(registrations, events);
  } catch (error) {
    console.error("Kayıtlar yüklenemedi:", error);
    alert("Kayıtlar yüklenirken bir hata oluştu!");
  }
}

// Kayıtları göster
function displayMyRegistrations(registrations, events) {
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
                    <div><strong>Ad Soyad:</strong> ${reg.studentName}</div>
                    <div><strong>Öğrenci No:</strong> ${reg.studentNumber}</div>
                    <div><strong>E-posta:</strong> ${reg.email}</div>
                    <div><strong>Kayıt Tarihi:</strong> ${formatDate(
                      reg.registeredAt.split("T")[0]
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

// Modal dışına tıklanınca kapat
window.onclick = function (event) {
  const modal = document.getElementById("registrationModal");
  if (event.target === modal) {
    closeModal();
  }
};
