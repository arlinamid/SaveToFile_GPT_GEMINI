// Töltsd be ezt a konzolba. Utána használhatod a `GrokDebug` parancsokat.

window.GrokDebug = {
    _boundClickHandler: null,

    // 1. Átfogó elemzés az oldalról
    scan: function () {
        console.group("--- GrokDebug: Teljes vizsgálat ---");
        const bubbles = document.querySelectorAll('.message-bubble');
        console.log(`Talált Üzenet Buborékok (.message-bubble): ${bubbles.length}`);

        if (bubbles.length === 0) {
            console.warn("NINCSENEK üzenetek! Ellenőrizd:");
            console.warn("- Be van töltve a beszélgetés?");
            console.warn("- Nem változtak az osztálynevek?");
        }

        bubbles.forEach((b, i) => {
            const analysis = this.analyzeNode(b);
            console.groupCollapsed(`Buborék #${i + 1} (${analysis.role})`);
            console.log("Szöveg töredék:", analysis.preview);
            console.log("Detektálás oka:", analysis.reason);
            console.log("DOM Elem:", b);
            console.groupEnd();
        });
        console.groupEnd();
    },

    // 2. Egy specifikus node elemzése
    check: function (node) {
        if (!node) {
            console.error("Hiba: Nincs elem megadva!");
            return;
        }

        // Ha a user nem pont a buborékra kattintott, keressük meg a legközelebbi buborékot
        const bubble = node.classList.contains('message-bubble') ? node : node.closest('.message-bubble');
        const container = node.closest('[class*="items-"]');

        console.group("--- GrokDebug: Elem Elemzés ---");
        console.log("Kattintott/Kiválasztott elem:", node);

        if (container) {
            console.log("Talált konténer igazítással:", container.className);
        } else {
            console.log("Nincs 'items-*' osztályú szülő.");
        }

        if (!bubble) {
            console.warn("Ez az elem NEM része egy .message-bubble-nek (vagy nem találta meg a szülőt).");
        } else {
            console.log("Megtalált buborék szülő:", bubble);
            const result = this.analyzeNode(bubble);
            console.log("Eredmény:", result);

            // Vizuális visszajelzés (border)
            const originalBorder = bubble.style.border;
            bubble.style.border = "3px solid red";
            setTimeout(() => { bubble.style.border = originalBorder; }, 1000);
        }
        console.groupEnd();
    },

    // 3. Kattintásos vizsgálat indítása
    startInspect: function () {
        if (this._boundClickHandler) return; // Már fut

        this._boundClickHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.check(e.target);
        };

        document.addEventListener('click', this._boundClickHandler, { capture: true });
        console.log("%c[GrokDebug] Kattintásos vizsgálat AKTÍV!", "color: green; font-weight: bold; font-size: 14px;");
        console.log("Most kattints bármelyik üzenetre az oldalon az elemzéshez.");
        console.log("Kikapcsoláshoz: GrokDebug.stopInspect()");
    },

    // 4. Kattintásos vizsgálat leállítása
    stopInspect: function () {
        if (!this._boundClickHandler) return;

        document.removeEventListener('click', this._boundClickHandler, { capture: true });
        this._boundClickHandler = null;
        console.log("%c[GrokDebug] Kattintásos vizsgálat LEÁLLÍTVA.", "color: red; font-weight: bold;");
    },

    // Belső logika
    analyzeNode: function (bubble) {
        const parentEnd = bubble.closest('.items-end');
        const parentStart = bubble.closest('.items-start');
        let role = "Ismeretlen";
        let reason = "Nincs egyértelmű jel";

        if (parentEnd) {
            role = "Felhasználó";
            reason = "Szülő osztály: .items-end";
        } else if (parentStart) {
            role = "Grok";
            reason = "Szülő osztály: .items-start";
        } else {
            if (bubble.classList.contains('bg-surface-l1')) {
                role = "Felhasználó";
                reason = "Háttérszín fallback: .bg-surface-l1";
            } else {
                role = "Grok";
                reason = "Fallback (egyéb)";
            }
        }

        return {
            role: role,
            reason: reason,
            preview: bubble.innerText ? bubble.innerText.substring(0, 50).replace(/\n/g, ' ') + '...' : "Üres szöveg"
        };
    },

    help: function () {
        console.log("Használat:");
        console.log("  GrokDebug.scan()         -> Összes üzenet listázása");
        console.log("  GrokDebug.startInspect() -> Kattintásos mód BEKAPCSOLÁSA (Egérrel jelölj ki)");
        console.log("  GrokDebug.stopInspect()  -> Kattintásos mód KIKAPCSOLÁSA");
        console.log("  GrokDebug.check($0)      -> Kézi elemzés ($0 = kiválasztott elem)");
    }
};

console.log("GrokDebug v2 betöltve! Írd be: GrokDebug.help()");
window.GrokDebug.help();
