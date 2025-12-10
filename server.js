const express = require("express");
const app = express();
const port = 3000;

// Veri okuma ayarları
app.use(express.urlencoded({ extended: true }));
// Statik dosyalar (HTML, CSS)
app.use(express.static("public"));

// --- POST İŞLEMİ (Kayıt Ol Butonuna Basılınca) ---
app.post("/kayit-ol", (req, res) => {
  const veri = req.body;

  // Konsola yazdıralım (Gerçek hayatta veritabanına burada kaydedilir)
  console.log("--- YENİ KAYIT ---");
  console.log("Etkinlik:", veri.etkinlikAdi); // HTML'den gelen gizli bilgi
  console.log("Öğrenci:", veri.adsoyad);
  console.log("No:", veri.ogrenciNo);
  console.log("Bölüm:", veri.bolum);
  console.log("------------------");

  // Kullanıcıya şık bir yanıt dönelim
  // (Burada basit HTML dönüyoruz, ileride burayı da güzelleştiririz)
  res.send(`
        <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
            <h1 style="color: #27ae60;">✔ Kayıt Başarılı!</h1>
            <p>Sayın <strong>${veri.adsoyad}</strong>,</p>
            <p><strong>${veri.etkinlikAdi}</strong> için kaydınız alınmıştır.</p>
            <br>
            <a href="/" style="background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Geri Dön</a>
        </div>
    `);
});

app.listen(port, () => {
  console.log(`Uygulama çalışıyor: http://localhost:${port}`);
});
