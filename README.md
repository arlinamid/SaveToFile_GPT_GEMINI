# 💾 ChatGPT, Gemini, Claude & Grok Beszélgetés Mentő — Chrome bővítmény

Ez a Chrome bővítmény lehetővé teszi, hogy **ChatGPT**, **Gemini**, **Claude** és **Grok** beszélgetéseidet **Markdown (MD)** és **DOCX** formátumban elmentsd.

## ✨ Funkciók

- 📝 **Markdown export** — Formázás, kódblokkok, listák; képeknél **URL a forráson** (nincs beágyazott base64).
- 📘 **DOCX export** — Word-kompatibilis dokumentum; **képek beágyazva**, max. szélesség ~500 px (különösen ChatGPT `estuary` / generált képek a lap sessionjével).
- 🎯 **Egyedi fájlnevek** — Saját fájlnév megadása
- ⏰ **Időbélyeg** — Opcionális `HH-MM-SS` utótag
- 🤖 **Többféle oldal** — chatgpt.com, Gemini, Claude, Grok
- 🔗 **Forrás URL** — Az export fejlécében a beszélgetés webcíme (ahol elérhető)
- 📊 **Mermaid** — A felugró ablakban diagram-szerkesztő és SVG/PNG export (külön fül)
- 🚀 **Frissítés ellenőrzés** — GitHub release összehasonlítás (About fül)

## 📦 Telepítés

### 1. Fájlok

Győződj meg róla, hogy megvannak a repo fájlai (pl. `manifest.json`, `popup.*`, `content.js`, `background.js`, `i18n.js`, `icons/`, `libs/`).

### 2. Chrome-ba töltés

1. `chrome://extensions/`
2. **Fejlesztői mód** be
3. **Kibővítmény betöltése** — válaszd ki a projekt mappát
4. A beszédmentéshez nyisd meg a támogatott AI oldalt, majd kattints a bővítmény ikonjára

## 📖 Használat

1. Nyisd meg a **ChatGPT** / **Gemini** / **Claude** / **Grok** beszélgetést, és várj meg, amíg az üzenetek megjelennek.
2. Kattints a **bővítmény ikonra** (érdemes **azon a lapon** maradni, ahol a chat van — DOCX képekhez kell a bejelentkezett session).
3. Opcionálisan: fájlnév, időbélyeg.
4. **Markdown** vagy **DOCX** export.

### Különbség MD és DOCX között (képek)

| | Markdown | DOCX |
|---|----------|------|
| ChatGPT generált / estuary kép | `![alt](https://...)` link a fájlban | Kép beágyazva (letöltés ugyanabból a tabból, sütikkel) |
| Offline / másik gépen | A linkhez be kell jelentkezni ugyanarra a szolgáltatásra | A fájl önmagában tartalmazza a képet |

## 🔧 Technikai részletek

- **Manifest V3**, content script + service worker (`background.js`)
- **docx.js** — DOCX generálás
- **Vanilla JS** — nincs build lépés

### Támogatott URL-ek (content script)

- `https://chatgpt.com/*`, `https://chat.openai.com/*`
- `https://gemini.google.com/*`
- `https://claude.ai/*`
- `https://grok.com/*`

### ChatGPT kinyerés (röviden)

- Elsődlegesen `[data-message-author-role]` (user / assistant / system / tool), tartalom: `[data-message-content]` vagy `.markdown` / `.prose` / `.whitespace-pre-wrap`.
- Generált kép blokkok: `group/imagegen-image` és/vagy `estuary/content` képek — a **teljes conversation-turn** konténerben keresünk, nem csak a szövegbuborékban.

## 🐛 Hibaelhárítás

### „Nem található beszélgetés”

- Frissíts (F5), görgess végig a beszélgetésen, hogy ki legyen renderelve.
- A statikus „View source” / mentett HTML nem tartalmazza a React üzenet-DOM-ot — export **élő** lapon.

### DOCX-ben hiányzik a generált kép

- Ugyanaz a Chrome-profil legyen bejelentve ChatGPT-re.
- Export közben a **ChatGPT lap legyen aktív** (u. abból a tabból gyűjt a bővítmény a sessionös letöltést).

### Rossz DOCX formázás

- Nyisd Word-del; próbáld újra exportálni.

## 📝 Licensz

Nyílt forráskódú, személyes használatra szabadon használható.

## 🤝 Közreműködés

Issue / pull request: [GitHub](https://github.com/arlinamid/SaveToFile_GPT_GEMINI).

---

**Verzió:** 1.9.0  
**Utolsó frissítés:** 2026. március  
**Platformok:** ChatGPT, Gemini, Claude, Grok
