# Dokümanlarım Modülü — QA Checklist

Kısa manuel doğrulama listesi. Sahte veri kullanmayın; gerçek API ve DB ile test edin.

## Oluşturma

- [ ] Yeni Doküman modal açılır ve doküman oluşturulur
- [ ] Oluşturulan doküman listede görünür

## Yeniden adlandırma

- [ ] Owner/Editor yeniden adlandırabilir
- [ ] Viewer yeniden adlandıramaz (menüde görünmez)
- [ ] F5 sonrası yeni ad korunur

## Favori

- [ ] Kart/liste yıldızı toggle çalışır
- [ ] `/favorites` ile senkron
- [ ] Bulk favorilere ekle/çıkar çalışır
- [ ] Kısmi hata mesajı anlaşılır

## Dışa aktarma

- [ ] Karttan Dışa Aktar modal açılır
- [ ] PDF/DOCX/HTML/Markdown indirme çalışır
- [ ] Viewer export yapabilir

## Paylaşım

- [ ] `canShare` olan kullanıcıda Paylaş görünür
- [ ] Paylaş → `/documents/:id?share=open`
- [ ] Viewer’da Paylaş görünmez

## Çöp kutusu

- [ ] Tekli çöp kutusuna taşıma soft delete
- [ ] Bulk çöp kutusuna taşıma çalışır
- [ ] Yetkisiz doküman bulk’ta failed
- [ ] Listedeki doküman kaybolur, `/trash`’te görünür
- [ ] Restore sonrası `/documents`’ta tekrar görünür
- [ ] Hard delete yok

## Bulk aksiyonlar

- [ ] Kart/row checkbox seçimi
- [ ] Tümünü seç
- [ ] Bulk toolbar görünür
- [ ] Seçimi temizle
- [ ] Kısmi trash/favorite toast’ları

## Filtreler ve görünümler

- [ ] View tabs (all/owned/shared/recent/favorites)
- [ ] Search, workspace, role, sort
- [ ] Grid/List toggle
- [ ] `flowdocs.documents.viewMode` F5 sonrası korunur
- [ ] `totalDocuments === 0` → empty state
- [ ] Filtre sonucu boş → no-results

## İzinler

- [ ] Viewer: export, favorite, link copy ✓
- [ ] Viewer: rename, trash, share ✗
- [ ] Owner: tüm uygun aksiyonlar ✓
- [ ] Silinmiş doküman listede yok

## Regression

- [ ] Editor/Yjs/realtime içerik korunur
- [ ] Shared/Favorites/Team/Dashboard bozulmaz
- [ ] `npm run build` backend + frontend
- [ ] `npm test -- --testPathPatterns=documents-list` geçer
