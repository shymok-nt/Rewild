# Rewild Gelistirme Kurallari

Rewild; Babylon.js ES modules, TypeScript strict mode ve Vite kullanan, First Person
bakis acili stylized realistic bir hayatta kalma oyunudur. Asagidaki kurallar tum
gelistirme gorevlerinde gecerlidir:

1. Tum gelistirmeler `main` dalinda tamamlanmalidir.
2. Gorev baska bir dalda gelistirildiyse, testlerden sonra `main` dalina
   birlestirilmelidir.
3. Her gorev tamamlandiginda `npm run build` calistirilmalidir.
4. Derleme veya test hatalari duzeltilmeden push yapilmamalidir.
5. Mevcut calisan oyun mekanikleri korunmalidir.
6. First Person kamera sistemi korunmalidir.
7. Gorsel hedef stylized realistic olmalidir; kup tabanli gorunumden
   kacinilmalidir.
8. AMD Radeon entegre grafik birimleri icin performans gozetilmelidir.
9. Gereksiz bagimliliklar ve kullanilmayan dosyalar eklenmemelidir.
10. Gorev tamamlaninca degisiklikler commit edilmeli ve `origin/main` dalina
    push edilmelidir.
11. Push oncesinde uzak dalda yeni commit varsa guvenli sekilde senkronize
    edilmeli, baskalarinin degisiklikleri ezilmemelidir.
12. `git push --force` kullanilmamalidir.
13. Her gorev sonunda commit hash'i, degistirilen dosyalar ve test sonuclari
    raporlanmalidir.

Ek mimari kurallar:

- Giris noktasi olan `src/main.ts`, render dongusunu ve uygulama yasam dongusunu
  yonetir; dunya uretimi ve oyun sistemleri ayri modullerde tutulur.
- Dunya uretimi `src/world/`, oyuncu ve First Person kontrolu `src/player/`,
  oyun mekanikleri `src/game/` altinda tutulur.
- Prototype davranislari calisan ozellik gibi gosterilmemeli ve acikca
  belirtilmelidir.
- Yeni bagimlilik eklenirse amaci ve gerekliligi aciklanmalidir.
- Baslangic sahnelerinde basit, performansli geometri ve deterministik
  yerlestirme tercih edilmelidir.
- Oyun kodu `src/` icinde tutulmali; uretilmis `dist/` ve `node_modules/`
  commit edilmemelidir.
