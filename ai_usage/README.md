# AI Kullanım Detayları (Gemini Code Assist)

Projenin geliştirilme sürecinde **Gemini Code Assist** aracından aktif olarak destek alınmıştır. Bu aracı; projeyi sıradan bir CRUD uygulamasından çıkarıp gerçek üretim sahası (shop-floor) mantığına oturtmak, "Reddet/Düzelt" gibi aksiyon bazlı mimari kararlar almak ve karmaşık sorunları (API 429/422 hataları, Idempotency vb.) kıdemli (senior) bir yazılım mimarı ile beyin fırtınası yapar gibi çözmek amacıyla kullandım.

**Sohbet Geçmişi Hakkında Önemli Not:**
Gemini'nin sisteminde sadece son 20 konuşmanın kaydedildiğini projenin son aşamasında öğrendim. Bu durumu önceden bilmediğim için, maalesef iki tam günlük yoğun ve detaylı sohbet geçmişimizin tamamını buraya ekleyemedim. Kurtarabildiğim örnekler ve son durumu özetleyen dosyalar şu şekildedir:

- **`1.md` ve `2.md`**: Proje boyunca yaşadığımız sorunlara (örneğin filtrelemeler ve validasyonlar) nasıl yaklaştığımızı gösteren örnek konuşmalarımız.
- **`aiözet.md`**: Geçmiş konuşmalar silindiği için, projeyi baştan sona nasıl geliştirdiğimizi, veritabanı kurgusunu, hata hiyerarşisini ve API senkronizasyonunu genel olarak özetlediğimiz son konuşmamızın detaylı dökümü.

### Başlangıç için verdiğim promptlar:

https://gemini.google.com/share/671a1e5c2e3a
https://gemini.google.com/share/b019c0a735ed

### Veritabanı hakkında:
https://gemini.google.com/share/bc18bdbe5556
