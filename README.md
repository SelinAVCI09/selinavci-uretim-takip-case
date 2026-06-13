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
* **Başlangıç:** <br> ![Import Boş Durum](docs/import1.png) <br> Kapsamlı sürükle-bırak (drag & drop) destekli boş dosya yükleme alanı.
* **Önizleme:** <br> ![Import Önizleme](docs/import2.png) <br> Dosya seçildiği an backend'e yollanmadan önce tarayıcıda ilk 5 satırın önizlemesinin gösterildiği aşama.
* **Sonuç Raporu:** <br> ![Import Yükleme Sonucu](docs/import3.png) <br> Dosya yüklendikten sonra; kaç satırın geçerli, kaç satırın şüpheli veya kesin hatalı olduğunu ve kalite sorunlarının detaylı dökümünü gösteren sonuç ekranı.

### 2. Dashboard ve Analitik Raporlar
Üretim verilerinin tüm açılardan analiz edildiği, PDF olarak indirilebilir/yazdırılabilir gelişmiş yönetim paneli:

* **Genel Performans ve Trendler:** <br> ![Dashboard Genel Görünüm](docs/dashboard1.png)
  * **Filtreler ve Dışa Aktarma:** İş istasyonu bazlı dinamik filtreleme, tarih aralığı seçimi ve **PDF İndir/Yazdır** butonu.
  * **Canlı Vardiya Özeti:** Sisteme girilen en son vardiyanın OEE ve Üretim özetini gösteren dikkat çekici bilgi kartı.
  * **Kritik KPI Kartları:** Ortalama OEE, Toplam Üretim, Toplam Fire ve Toplam Duruş (dk) metrikleri.
  * **OEE Trend Grafiği:** Günlük ve Haftalık olarak görünümü değiştirilebilen, geçmişe dönük sayfalama destekli alan grafiği (Area Chart).

* **Detaylı Kırılımlar ve Anomaliler:** <br> ![Dashboard Detaylı Analizler](docs/dashboard2.png)
  * **Vardiya APQ Karşılaştırması:** Kullanılabilirlik, Performans ve Kalite oranlarının vardiya bazlı bar grafiği.
  * **Duruş Nedenleri:** Planlı ve plansız duruşların pasta (pie) grafik ile dağılımı.
  * **OEE Sıralaması ve Fire Dağılımı:** Hangi iş istasyonunun ne kadar verimli çalıştığı ve hangi istasyonun daha çok fire (scrap) verdiğini gösteren sıralı grafikler.
  * **Anomali ve Doğrulama Hataları:** Sistemdeki "Kesin Hatalı" ve "Uyarı" statüsündeki kayıtların listesi. (Sistemik ve tekil hata ayrımı ile).
  * *Not: Tüm grafiklerin sağ üstündeki büyütme butonlarına tıklanarak grafikler tam ekran yapılabilir.*

* **Grafik Büyütme (Modal):** <br> ![Dashboard Büyütülmüş Grafik](docs/dashboard3.png) <br> Herhangi bir grafik büyütüldüğünde, grafiğin detaylı görünümü ve alt kısmında "Bu grafik ne anlama geliyor?" şeklinde yöneticiler için okuma rehberi sunulur.

* **Anomali Detaylı Arama:** <br> ![Dashboard Anomali Filtreleme](docs/dashboard4.png) <br> Anomali tablosu büyütüldüğünde, sistemdeki tüm hatalar içerisinde metin bazlı anlık arama (Search) ve filtreleme yapılabilen özel modal ekranı.

### 3. Dinamik Veri Filtreleme ve Dışa Aktarma
Geniş veri setleri içerisinde anında sorgulama yapabilmenizi sağlayan gelişmiş tablo arayüzü:
* **Gerçek Zamanlı Filtreleme:** <br> ![Filtrelenmiş Veri Görünümü](docs/filter1.png) <br> Tarih aralığı, vardiya, iş istasyonu, ürün adı ve OEE değer aralığına göre **anlık (sayfa yenilenmeden)** filtreleme yapılabilir. İstediğiniz kriterdeki verileri filtreledikten sonra tek tıkla **CSV olarak dışa aktarabilirsiniz.**
* **Hatalı Kayıtları Ayıklama:** <br> ![Hatalı Kayıt Filtresi](docs/filter2.png) <br> Liste üzerinde sadece hatalı, şüpheli veya tamamen temiz (geçerli) kayıtları ekrana getirmek için özel durum filtrelemesi sunar.

### 4. Veri Validasyonu, Kalite Raporu ve Audit Trail
Sistemin kalbini oluşturan, kirli verileri tespit edip onarılmasını sağlayan yönetim paneli:
* **Kalite Kontrol ve Hata Yönetimi:** <br> ![Validasyon Ekranı](docs/validation1.png) <br> Yüklenen veriler 14 farklı kurala göre test edilir ve ekranda raporlanır. Bu ekranda hata tipine veya İş Emri numarasına göre filtreleme yapılıp **tüm rapor CSV olarak indirilebilir.**
  * **Kesin Hatalı (Müdahale Şart):** Mantıksal olarak imkansız olan (Örn: *Üretim 0 iken fire verilmesi veya İş İstasyonunun boş olması*) verilerdir. Sistem tarafından dışlanır ve düzeltilmeden hedef API'ye **asla gönderilmez**.
  * **Uyarı (Şüpheli):** Teorik kapasite aşımı (OEE > %100) gibi fiziksel olarak mümkün ama şüpheli durumlardır. Uyarı niteliği taşır, sisteme kaydedilebilir.
* **Dinamik Validasyon Ayarları:** <br> ![Validasyon Ayarları](docs/validation2.png) <br> Sistemin kalite denetimi yaparken hangi kuralları dikkate alıp hangilerini görmezden geleceğini (Örn: *Negatif üretime izin ver/verme*) UI üzerinden anlık olarak yönetmenizi sağlar. Ayarlar kaydedildiğinde sistem tüm kayıtları yeniden test eder.

### 5. Hedef API Senkronizasyonu ve Log Kayıtları
Bu bölüm %100 temizlenmiş verilerin hedef REST API'ye (Magna) aktarılmasını ve izlenmesini sağlar.

* **API Senkronizasyonu ve Vardiya Matrisi:** <br> ![API Senkronizasyonu](docs/api1.png) <br> Geçerli olan tüm üretim kayıtlarını Tarih ve Vardiya (1, 2, 3) bazında gruplayarak gösteren önizleme matrisidir. Kullanıcı, "Bekliyor" (Mavi) veya dış sistemden hata dönmüş "Yeniden Denenecek" (Turuncu) kayıtları manuel veya toplu olarak senkronize edebilir. Gönderilen verilerin OEE, Toplam Üretim ve Makine Listesi detayları matris hücrelerinde incelenebilir.

* **API Gönderim Geçmişi (Log Kayıtları):** <br> ![API İletişim Logları](docs/api2.png) <br> Harici hedef sistemle kurulan tüm ağ iletişimlerinin detaylı olarak kaydedildiği bölümdür. Sistem aşağıdaki hedef API hata kodlarını tanır ve kusursuzca yönetir:
  * **401 (Eksik veya geçersiz API key):** API yetkilendirme hatasıdır. Arayüzdeki "API Ayarları" üzerinden doğru Key girilerek düzeltilir.
  * **413 (İstek gövdesi 10 KB sınırını aştı):** Toplu JSON boyutu çok büyük olduğunda alınır. Sistem bunu algıladığında Batch (Toplu) gönderimden çıkıp Fallback (Tekli/Chunk) moduna geçerek verileri iletir.
  * **422 (Validasyon hatası):** Hedef sistemin kendi iş kurallarına (Örn: Üretim >= 1 olmalıdır) takılan verilerdir. Yanıttaki `detail` alanı loglanarak okunabilir şekilde gösterilir. Sistem bu kayıtları "Yeniden Denenecek" olarak ayırır.
  * **429 (Rate limit aşıldı):** Saniyedeki istek limiti aşıldığında alınır. Sistem bu hatayı aldığında işlemi iptal etmez; **1 dakika bekleyerek** (Circuit Breaker / Pacing) gönderime otomatik olarak kaldığı yerden devam eder.

---

## 🕵️ Tespit Edilen 14 Farklı Hata Tipi ve Validasyon Kuralları
Sistem, her bir üretim kaydı için **14 farklı kalite ve anomali kuralı** işletir. Ayarlar menüsünden açılıp kapatılabilen bu kurallar, hataların ciddiyetine göre **"Kesin Hatalı"** veya **"Uyarı"** olarak sınıflandırılır.

| # | Kontrol Edilen Kural | Hata Örneği / Senaryo | Sınıflandırma | Aksiyon |
| :--- | :--- | :--- | :--- | :--- |
| 1 | **Eksik İş Emri** | İş Emri No boş bırakılamaz. | ❌ Kesin Hatalı | Reddet |
| 2 | **İş Emri Formatı** | İş Emri 302 ile başlamalı ve 10 hane olmalıdır. | ❌ Kesin Hatalı | Düzelt |
| 3 | **Vardiya Kontrolü** | Geçersiz Vardiya: 4 (Sadece 1,2,3 olabilir) | ❌ Kesin Hatalı | Düzelt |
| 4 | **Eksik İş İstasyonu** | İş İstasyonu bilgisi boş bırakılamaz. | ❌ Kesin Hatalı | Reddet |
| 5 | **Geçersiz Miktar** | Hedef sistem 0 veya negatif üretimi/fireyi kabul etmez. | ❌ Kesin Hatalı | Düzelt |
| 6 | **Fire Tutarlılığı**| Fire miktarı (60), Toplam üretimden (50) büyük olamaz. | ❌ Kesin Hatalı | Düzelt |
| 7 | **Yüzdelik Aralık** | A, P, Q veya OEE değeri %100'den büyük veya negatif. | ❌ Kesin Hatalı | Düzelt |
| 8 | **Kapasite Aşımı** | Performans (P) %105 - Makine teorik hızını aştı. | ⚠️ Uyarı | Uyar |
| 9 | **Duruş Tutarsızlığı** | Planlı(10) + Plansız(5) != Toplam Duruş(30) | ❌ Kesin Hatalı | Düzelt |
| 10 | **Duruş > Çalışma** | Toplam Duruş süresi, Çalışma Süresinden büyük. | ❌ Kesin Hatalı | Düzelt |
| 11 | **Süresiz Üretim** | Çalışma süresi 0 iken 500 adet parça üretilmiş. | ❌ Kesin Hatalı | Düzelt |
| 12 | **Kullanılabilirlik Hatası**| Makine duruş yapmasına rağmen Kullanılabilirlik (A) %100. | ❌ Kesin Hatalı | Düzelt |
| 13 | **Geçersiz/Gelecek Tarih** | Tarih bilgisi boş veya gelecek bir güne ait olamaz. | ❌ Kesin Hatalı | Reddet / Düzelt |
| 14 | **OEE Çapraz Kontrol** | OEE değeri A*P*Q çarpımına eşit değil. | ❌ Kesin Hatalı | Düzelt |

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
