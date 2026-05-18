# Çöp Kutusu Modülü — QA Checklist

Kısa manuel doğrulama listesi. Sahte veri kullanmayın; gerçek API ve DB ile test edin.

## Soft delete

- [ ] Dokümanlar sayfasından “Çöp Kutusuna Taşı” çalışır
- [ ] Normal `/documents` listesinde doküman kaybolur
- [ ] Dashboard listesinde doküman kaybolur
- [ ] `DELETE /documents/:id` hard delete yapmaz (DB’de `deletedAt` dolu)

## Trash listesi

- [ ] `/trash` silinen dokümanı gösterir
- [ ] Arama ve sıralama çalışır
- [ ] Workspace filtresi çalışır
- [ ] Boş çöp kutusu empty state doğru
- [ ] Filtre sonucu yoksa “Sonuç bulunamadı” + filtre temizle

## Restore

- [ ] Tekli geri yükleme çalışır
- [ ] Bulk geri yükleme çalışır
- [ ] Geri yüklenen doküman normal listede görünür
- [ ] Çöp kutusundan kaybolur

## Permanent delete

- [ ] Onay metni `KALICI OLARAK SİL` olmadan buton aktif değil
- [ ] Tekli kalıcı silme çalışır
- [ ] Bulk kalıcı silme çalışır
- [ ] `/documents/:id` direct URL 404/410 döner
- [ ] Kalıcı silme yalnızca trash endpoint’inden yapılır

## Yetkiler

- [ ] Viewer trash’te yönetemez / listede görmez (yetkisi yoksa)
- [ ] Editor (owner değil) restore/permanent delete yapamaz
- [ ] Document owner silinmiş dokümanı görebilir ve yönetebilir
- [ ] Workspace owner workspace’teki silinmiş dokümanı görebilir
- [ ] Tahmin edilen `documentId` ile yetkisiz restore → 403
- [ ] Çöp kutusunda olmayan doküman restore → 400
- [ ] Çöp kutusunda olmayan doküman permanent delete → 400
- [ ] Bulk’ta yetkisiz id `failures` içinde

## Erişim tutarlılığı (regression)

- [ ] Export silinmiş dokümanda çalışmaz
- [ ] Editor 410 view gösterir
- [ ] Realtime join silinmiş dokümanda reddedilir
- [ ] Messages/comments silinmiş dokümanda reddedilir
- [ ] Media silinmiş dokümanda reddedilir
- [ ] Team/Profile doküman listelerinde silinen yok

## Activity

- [ ] Çöp kutusuna taşıma activity metni doğru
- [ ] Geri yükleme activity metni doğru
- [ ] Kalıcı silme activity metni doğru (title yoksa fallback)
- [ ] Profile’da silinmiş dokümana ölü link yok

## UI

- [ ] Sidebar çöp kutusu badge (sayı > 0)
- [ ] Seçim toolbar ve bulk modallar
- [ ] Kısmi bulk hata toast’ı anlaşılır
- [ ] `npm run build` backend + frontend başarılı
- [ ] `npm test -- --testPathPatterns=trash` geçer
