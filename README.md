# 🏭 Üretim Performans Takip Sistemi (MVP)

Bu proje, otomotiv yan sanayi enjeksiyon kalıplama (injection molding) hatlarındaki performansı vardiya bazında takip etmek için geliştirilmiş Full-Stack bir web uygulamasıdır. 

## 📌 Projenin Amacı
MES (Manufacturing Execution System) sisteminden otomatik üretilen ham `.csv` formatındaki günlük üretim raporlarını içeri aktarmak, bu verileri detaylı kalite süzgeçlerinden geçirerek **anomalileri/hataları tespit etmek** ve %100 temizlenmiş onaylı veriyi OEE metrikleriyle birlikte **harici bir REST API (Magna)** hedefine senkronize etmektir.

---

## 🚀 Hızlı Kurulum Talimatları

Projeyi bilgisayarınızda çalıştırmak için aşağıdaki adımları sırasıyla terminalinizde uygulayın:

**1. Repoyu Klonlayın ve Klasöre Girin:**
```bash
git clone https://github.com/<kullanici-adiniz>/selinavci-uretim-takip-case.git
cd selinavci-uretim-takip-case
```

**2. Çevresel Değişkenleri (.env) Ayarlayın:**
```bash
cp .env.example .env
```
*(Not: `.env` dosyasını bir metin editörüyle açıp `API_KEY` kısmına size verilen gizli anahtarı giriniz.)*

---

## ⚡ Hızlı Çalıştırma Talimatları

Proje iki katmandan (Backend ve Frontend) oluşmaktadır. İki ayrı terminal penceresi açmanız gerekmektedir.

**Terminal 1: Backend (FastAPI)**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```
*(Backend `http://localhost:8000` adresinde çalışmaya başlayacaktır. API Dokümantasyonu için `http://localhost:8000/docs` adresini ziyaret edebilirsiniz.)*

**Terminal 2: Frontend (React & Vite)**
```bash
cd frontend
npm install
npm run dev
```
*(Frontend `http://localhost:5173` adresinde çalışacaktır. Tarayıcınızdan bu adrese giderek uygulamayı kullanmaya başlayabilirsiniz.)*

---

## 📸 Uygulama Ekran Görüntüleri

### 1. CSV Veri Yükleme (Import)
Uygulama, verileri içe aktarırken kullanıcıya adım adım rehberlik eder:
* **Başlangıç:** <br> !Import - Boş Durum <br> Kapsamlı sürükle-bırak (drag & drop) destekli boş dosya yükleme alanı.
* **Önizleme:** <br> !Import - Önizleme <br> Dosya seçildiği an backend'e yollanmadan önce tarayıcıda ilk 5 satırın önizlemesinin gösterildiği aşama.
* **Sonuç Raporu:** <br> !Import - Yükleme Sonucu <br> Dosya yüklendikten sonra; kaç satırın geçerli, kaç satırın şüpheli veya kesin hatalı olduğunu ve kalite sorunlarının detaylı dökümünü gösteren sonuç ekranı.

### 2. Dashboard ve Analitik Raporlar
Üretim verilerinin tüm açılardan analiz edildiği, PDF olarak indirilebilir/yazdırılabilir gelişmiş yönetim paneli:

* **Genel Performans ve Trendler:** <br> !Dashboard - Genel Görünüm
  * **Filtreler ve Dışa Aktarma:** İş istasyonu bazlı dinamik filtreleme, tarih aralığı seçimi ve **PDF İndir/Yazdır** butonu.
  * **Canlı Vardiya Özeti:** Sisteme girilen en son vardiyanın OEE ve Üretim özetini gösteren dikkat çekici bilgi kartı.
  * **Kritik KPI Kartları:** Ortalama OEE, Toplam Üretim, Toplam Fire ve Toplam Duruş (dk) metrikleri.
  * **OEE Trend Grafiği:** Günlük ve Haftalık olarak görünümü değiştirilebilen, geçmişe dönük sayfalama destekli alan grafiği (Area Chart).

* **Detaylı Kırılımlar ve Anomaliler:** <br> !Dashboard - Detaylı Analizler
  * **Vardiya APQ Karşılaştırması:** Kullanılabilirlik, Performans ve Kalite oranlarının vardiya bazlı bar grafiği.
  * **Duruş Nedenleri:** Planlı ve plansız duruşların pasta (pie) grafik ile dağılımı.
  * **OEE Sıralaması ve Fire Dağılımı:** Hangi iş istasyonunun ne kadar verimli çalıştığı ve hangi istasyonun daha çok fire (scrap) verdiğini gösteren sıralı grafikler.
  * **Anomali ve Doğrulama Hataları:** Sistemdeki "Kesin Hatalı" ve "Uyarı" statüsündeki kayıtların listesi. (Sistemik ve tekil hata ayrımı ile).
  * *Not: Tüm grafiklerin sağ üstündeki büyütme butonlarına tıklanarak grafikler tam ekran yapılabilir.*

* **Grafik Büyütme (Modal):** <br> !Dashboard - Büyütülmüş Grafik <br> Herhangi bir grafik büyütüldüğünde, grafiğin detaylı görünümü ve alt kısmında "Bu grafik ne anlama geliyor?" şeklinde yöneticiler için okuma rehberi sunulur.

* **Anomali Detaylı Arama:** <br> !Dashboard - Anomali Filtreleme <br> Anomali tablosu büyütüldüğünde, sistemdeki tüm hatalar içerisinde metin bazlı anlık arama (Search) ve filtreleme yapılabilen özel modal ekranı.

### 3. Veri Validasyonu, Kalite Raporu ve Audit Trail
!Validasyon Ekranı

### 4. Hedef API Senkronizasyonu ve Gün/Vardiya Matrisi
!API Sync Ekranı

---

## 🕵️ Tespit Edilen Hata Tipleri ve Validasyon Kuralları
Sistem, her bir üretim kaydı için **14 farklı kalite ve anomali kuralı** işletir.

| Hata Sınıfı | Kontrol Edilen Kural | Hata Örneği / Senaryo | Aksiyon |
| :--- | :--- | :--- | :--- |
| **Eksik Veri** | İş Emri ve İş İstasyonu Doluluk | `İş İstasyonu bilgisi eksik.` | Reddet |
| **Format Hatası** | İş Emri Formati | `İş Emri 302 ile başlamalı ve 10 hane olmalıdır.` | Düzelt |
| **Kritik Değer** | Vardiya Kontrolü | `Geçersiz Vardiya: 4 (Sadece 1,2,3 olabilir)` | Düzelt |
| **Geçersiz Miktar** | Toplam Üretim Miktarı | `Hedef sistem 0 veya negatif üretimi kabul etmez.` | Düzelt |
| **Mantıksal Hata** | Fire (Scrap) Tutarlılığı | `Fire miktarı (60), Toplam üretimden (50) büyük.` | Düzelt |
| **Aralık Hatası** | Yüzdelik Limitler | `Kalite (Q) değeri %100'den büyük olamaz.` | Düzelt |
| **Tutarsızlık** | Duruş Süresi Dengesi | `Planlı(10) + Plansız(5) != Toplam Duruş(30)` | Düzelt |
| **Fiziksel İmkansızlık**| Süresiz Üretim | `Çalışma süresi 0 iken 500 adet parça üretilmiş.` | Düzelt |
| **Mantıksal Hata** | Duruş varken %100 A (Avail) | `Makine duruş yapmasına rağmen Kullanılabilirlik %100.` | Düzelt |
| **Matematiksel Hata** | OEE Çapraz Kontrol | `OEE (%70) değeri A*P*Q (%85) çarpımına eşit değil.` | Düzelt |
| **Uyarı (Kapasite)** | Performans Aşımı | `Performans (P) %105 - Makine teorik hızını aştı.` | Uyar |

---

## 🔄 API Entegrasyon Akışı (Hedef Sisteme Gönderim)
Validasyonu başarıyla geçen veriler API üzerinden aşağıdaki mimariyle gönderilir:

1. **Grouping (Gruplama):** Temizlenen veriler "Tarih ve Vardiya" kırılımında gruplanıp OEE ve Toplam Üretim ortalamaları hesaplanarak tek JSON objesi haline getirilir.
2. **Idempotency (Çift Kayıt Koruması):** Veri dış API'ye gönderilmeden önce `SyncLog` (Geçmiş) tablosu kontrol edilir. Aynı verilerin (Aynı Vardiya + Aynı OEE/Üretim rakamı) ikinci kez hedefe yollanması engellenir.
3. **Batch & Fallback (Toplu ve Tekil Gönderim):** Hedef sisteme 20'li listeler (Batch) halinde istek atılır. Hedef sistem listeyi kabul etmeyip `422 Unprocessable Entity` dönerse, sistem **Fallback** moduna geçip listeyi parçalayarak tek tek (Single) gönderir.
4. **Exponential Backoff & Pacing:** Ağ hatalarında (`5xx`) veya Rate Limit aşımında (`429`), sistem hedef sunucuyu yormamak için katlanarak artan (2s, 4s, 8s veya 60s) bekleme süreleri uygulayarak (Circuit Breaker) isteği tekrar eder.
5. **Background Tasks (Asenkron Gönderim):** Aktarım işlemi FastAPI arkaplan görevleriyle yürütülür, kullanıcı arayüzü (UI) kilitlenmez. İşlem sonuçları `sync_logs` tablosuna (HTTP Status, Request/Response payload) kalıcı olarak yazılır.

---

## 🛠️ Kullanılan Kütüphaneler ve Seçim Gerekçeleri

**Backend:**
* **FastAPI:** Yüksek hızlı, asenkron (`BackgroundTasks`) çalışmayı desteklediği ve otomatik Swagger/OpenAPI dokümantasyonu sunduğu için tercih edilmiştir.
* **Pandas:** Büyük CSV dosyalarını iterasyon (`iterrows`) yerine vektörel olarak belleğe almak (`to_dict('records')`) ve 100K+ veriyi hızla işlemek için kullanılmıştır.
* **SQLAlchemy & SQLite:** Ekstra bir sunucu veya Docker kurulumu gerektirmeden, MVP için en ideal ve taşınabilir SQL çözümünü sunduğu için seçilmiştir.
* **Requests:** Hedef REST API'ye HTTP POST/GET çağrıları atmak için standart ve güvenilir bir çözüm olarak kullanıldı.

**Frontend:**
* **React.js & Vite:** Komponent bazlı geliştirme ve inanılmaz hızlı Hot-Module-Reloading (HMR) avantajı sebebiyle seçilmiştir.
* **Tailwind CSS:** Kapsamlı ve hızlı stil yazımı, hazır utility sınıfları ve mükemmel **Dark Mode (Gece Modu)** uyumu için tercih edilmiştir.
* **Recharts:** Dashboard üzerindeki OEE trendleri, Pareto grafikleri ve Şelale (Waterfall) kayıp analizlerini kolay ve esnek çizmek için kullanılmıştır.
* **Axios:** REST API'den verileri çekerken HTTP isteklerini modüler ve pratik yönetmek için eklenmiştir.

---

## 🌟 Ekstra Geliştirmeler (Bonus İsterler)
Case dokümanındaki taleplere ek olarak aşağıdaki "Senior" seviye mühendislik pratikleri projeye dahil edilmiştir:
* **Audit Trail (İzlenebilirlik):** Hatalı verilerin kullanıcı tarafından değiştirilmesi durumunda eski değer/yeni değer geçmişi tutulmaktadır.
* **Dinamik Validasyon Ayarları:** Sistemin verileri denetlediği kalite kuralları, UI üzerinden dinamik olarak açılıp kapatılabilir.
* **100K+ Satır Performansı:** Pandas `to_dict` ile RAM optimizasyonu sağlanmıştır.
* **Dışa Aktarma (Export):** İlgili raporlar ve gönderilmeyi bekleyen vardiyalar Excel/CSV ve PDF formatında sistemden indirilebilir.
* **Unit Testing:** Validasyon mantığının kalbini test etmek için temel `pytest` modülleri (`test_main.py`) yazılmıştır.

---

## ⏳ Yapılamayan / Vakit Yetmeyen Kısımlar
* Gerçek zamanlı (WebSocket tabanlı) bildirim sistemi tasarlanabilirdi. API'ye gönderim arka planda bittiğinde ekrana anında Toast/Notification basılabilirdi, mevcut durumda Polling (2sn'de bir ping atma) kullanıldı.
* Kullanıcı Yetkilendirme (RBAC): Operatör, Mühendis ve Yönetici bazlı giriş (Login/JWT) modülü eklenemedi.

---

## 🔮 Daha Fazla Zaman Olsaydı Neler Geliştirilirdi?
1. **Kestirimci Bakım (Predictive AI):** Geçmiş duruş süreleri ve OEE trendlerini bir Machine Learning (Makine Öğrenmesi) algoritmasına vererek, "IMM-2700 nolu makine önümüzdeki 3 gün içinde planlı bakıma alınmalı" tahmini üreten bir servis eklenebilirdi.
2. **PostgreSQL/Redis Geçişi:** Çok daha büyük ölçekli ve çoklu fabrika desteği için veritabanı SQLite yerine PostgreSQL'e, arkaplan görevleri ise Celery/Redis ikilisine geçirilirdi.
3. **Dockerize Etmek:** Projenin tek bir komutla (`docker-compose up`) izole bir container içinde tüm modülleriyle ayağa kalkması sağlanırdı.
