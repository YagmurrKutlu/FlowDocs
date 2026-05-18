# Paylaşılanlar Modülü — QA Checklist

Kısa manuel doğrulama listesi. Sahte veri kullanmayın; gerçek API ve DB ile test edin.

## With-me listesi

- [ ] Başka kullanıcının paylaştığı doküman görünür
- [ ] Sahibi olduğunuz doküman with-me’de görünmez
- [ ] Yalnızca workspace üyesi olup document member olmadığınız doküman görünmez
- [ ] `deletedAt` dolu doküman görünmez
- [ ] Rol filtresi yalnızca seçilen rolü döner (Editor / Viewer)
- [ ] Arama, sıralama, workspace filtresi çalışır

## By-me listesi

- [ ] Paylaştığınız ve en az bir başka üyesi olan dokümanlar görünür
- [ ] `sharedUserCount` 0 olan doküman görünmez
- [ ] Document owner değilseniz by-me’de görünmez
- [ ] `deletedAt` dolu doküman görünmez
- [ ] Editor/Viewer kendi paylaştığı olmayan dokümanları by-me’de göremez

## Erişimden ayrıl

- [ ] Editor/Viewer erişimden ayrılabilir
- [ ] Sahip (creator) ayrılamaz
- [ ] Son owner ayrılamaz
- [ ] Workspace kaynaklı erişimde 409 ve anlaşılır mesaj
- [ ] Silinmiş dokümanda 410
- [ ] Başka kullanıcının üyeliği silinemez (yalnızca kendi kaydı)

## Doküman açma / erişim

- [ ] Aç: 403/404 → “Bu dokümana erişiminiz artık yok.”
- [ ] Aç: 410 → “Bu doküman çöp kutusunda.”
- [ ] Link kopyala erişim gerektirmez
- [ ] Kopyalanan link ile açarken erişim kaybı toast’ı görünür

## Favoriler

- [ ] Favori ekle/çıkar shared kartlarda çalışır
- [ ] Erişim kaybında favori toggle doğru hata mesajı verir
- [ ] Favori kişisel kalır; shared listesi başkalarının favorilerini göstermez

## Paylaşımı yönet (`?share=open`)

- [ ] `/documents/:id?share=open` + `canShare` → paylaşım modalı açılır
- [ ] Modal sonrası URL `share` parametresi temizlenir
- [ ] `canShare` false → modal açılmaz, toast gösterilir
- [ ] F5 ile `share=open` editor/Yjs state’ini bozmaz

## Çöp kutusu entegrasyonu

- [ ] Çöp kutusuna taşınan doküman with-me / by-me listelerinden düşer
- [ ] Summary ve sidebar badge sayıları güncellenir

## UI / boş durumlar

- [ ] With-me boş: “Henüz sizinle paylaşılan doküman yok”
- [ ] By-me boş: “Henüz paylaştığınız doküman yok”
- [ ] Filtre sonucu yok: “Sonuç bulunamadı”
- [ ] Summary kartlarında 0 sayı olarak görünür
- [ ] Aktif filtre yokken “Filtreleri temizle” pasif
- [ ] Uzun başlık 2 satır, önizleme 3 satır ellipsis
- [ ] Rol rozetleri: Owner amber, Editor mavi, Viewer gri

## Sidebar badge

- [ ] `withMeCount + byMeCount`, 0 ise badge yok
- [ ] API hatasında sessiz (uygulama çökmez)
- [ ] Logout/login sonrası doğru
- [ ] Erişimden ayrıl / yeni paylaşım sonrası güncellenir
- [ ] Gereksiz her render’da fetch yok (~5 dk stale)

## Build & test

- [ ] `cd backend && npm run build`
- [ ] `cd backend && npm test -- --testPathPatterns=shared`
- [ ] `cd frontend && npm run build`

## Manuel senaryo (10 adım)

1. User A doküman oluşturur.
2. User A, User B’ye EDITOR paylaşır.
3. B `/shared` with-me’de görür.
4. B dokümanı açar.
5. B favoriye ekler/çıkarır.
6. B erişimden ayrılır.
7. B listeden kaybolur.
8. A by-me sayısının azaldığını görür.
9. A “Paylaşımı Yönet” → share modal açılır.
10. Doküman çöp kutusuna taşınınca shared listelerden düşer; arama/filtre/sıralama ve sidebar badge doğru kalır.
