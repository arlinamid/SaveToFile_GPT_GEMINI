# 💾 ChatGPT & Gemini Beszélgetés Mentő - Chrome Bővítmény

Ez a Chrome bővítmény lehetővé teszi, hogy a ChatGPT és Gemini beszélgetéseidet **Markdown (MD)** és **DOCX** formátumban is elmentsd.

## ✨ Funkciók

- 📝 **Markdown export** - Tökéletes formázással, kódblokkokkal, listákkal
- 📘 **DOCX export** - Szerkeszthető Word dokumentum valódi formázással
- 🎯 **Egyedi fájlnevek** - Saját fájlnév megadása
- ⏰ **Időbélyeg opció** - Automatikus időbélyeg hozzáadása (HH-MM-SS)
- 🤖 **Dual platform** - ChatGPT és Gemini támogatás
- 🚀 **Egyszerű használat** - Egy kattintással mentsz
- 🎨 **Modern dizájn** - Letisztult, felhasználóbarát felület

## 📦 Telepítés

### 1. Fájlok előkészítése

Győződj meg róla, hogy az alábbi fájlok és könyvtárak léteznek:

```
ChatGPT-Gemini-Saver/
├── manifest.json
├── popup.html
├── popup.js
├── content.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── libs/
    └── docx.js
```

### 2. Chrome-ba töltés

1. Nyisd meg a Chrome böngészőt
2. Írd be a címsorba: `chrome://extensions/`
3. Kapcsold be a **"Fejlesztői mód"** kapcsolót (jobb felső sarokban)
4. Kattints a **"Kibővítmények kicsomagolt mappáinak betöltése"** gombra
5. Válaszd ki a bővítmény mappáját
6. Kész! A bővítmény most már elérhető a Chrome eszköztárán 💾

## 📖 Használat

1. **Nyisd meg a ChatGPT-t** (https://chatgpt.com) **vagy Gemini-t** (https://gemini.google.com)
2. **Kattints a bővítmény ikonra** az eszköztárban
3. **Opcionális: Add meg a fájlnevet** (üresen hagyva automatikus lesz)
4. **Opcionális: Időbélyeg** (pipáld be/ki igény szerint)
5. **Válassz formátumot:**
   - 📝 Markdown (`.md`)
   - 📘 DOCX (`.docx`)
6. **Kész!** A fájl automatikusan letöltődik

### Fájlnév példák:

- **Automatikus + időbélyeg:** `chatgpt_2025-11-29_14-35-22.md`
- **Egyedi név:** `projekt_meeting.md`
- **Egyedi + időbélyeg:** `brainstorm_14-35-22.docx`

## 🔧 Technikai részletek

### Használt technológiák

- **Chrome Extensions API** - Manifest V3
- **docx.js** - DOCX dokumentum készítés Unicode támogatással
- **Vanilla JavaScript** - Nincs framework függőség

### Támogatott oldalak

- https://chatgpt.com/*
- https://chat.openai.com/*
- https://gemini.google.com/*

### Markdown konverzió támogatja

- ✅ Címsorok (H1-H4) → Word Heading stílusok
- ✅ **Félkövér** és *dőlt* szöveg → Valódi Word formázás
- ✅ Kódblokkok szintaxis nyelvvel → Courier New + háttér
- ✅ Inline kód → `Courier New` + szürke háttér
- ✅ Listák (számozott és számozatlan) → Behúzott elemek
- ✅ Linkek → Megmaradnak
- ✅ Idézetek → Dőlt + behúzott
- ✅ Táblázatok → Markdown formátum (MD-ben)
- ✅ Elválasztók → Vonal karakterek

## 🐛 Hibaelhárítás

### ❌ "Nem találtam beszélgetést"
- Frissítsd az oldalt (F5)
- Várj, amíg a beszélgetés betöltődik
- Ellenőrizd, hogy van-e üzenet az oldalon

### ❌ A bővítmény nem jelenik meg
- Ellenőrizd, hogy a **Fejlesztői mód** be van-e kapcsolva
- Próbáld újratölteni a bővítményt a `chrome://extensions/` oldalon

### ❌ Rossz formázás DOCX-ben
- Ellenőrizd, hogy tényleg Word-ben nyitottad meg (nem jegyzettömbben)
- Próbáld újra exportálni
- Töröld a böngésző cache-t

### ❌ Az ikonok nem jelennek meg
- Hozd létre a hiányzó ikonokat PNG formátumban (16x16, 48x48, 128x128)
- Használj online konvertert: https://www.favicon-generator.org/

## 📝 Licensz

Ez a projekt nyílt forráskódú és szabadon használható személyes célokra.

## 🤝 Közreműködés

Hibát találtál vagy fejlesztési ötleted van? Nyugodtan nyiss egy issue-t vagy pull requestet!

---

**Készítette:** AI Assistant  
**Verzió:** 1.4.0  
**Utolsó frissítés:** 2025. november  
**Platformok:** ChatGPT, Google Gemini
