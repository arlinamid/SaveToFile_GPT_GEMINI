// Másold be ezt a kódot a böngésző konzoljába (F12 -> Console) a Grok.com-on
(() => {
    console.log("--- DEBUG START ---");
    const bubbles = document.querySelectorAll('.message-bubble');
    console.log(`Talált .message-bubble elemek száma: ${bubbles.length}`);

    if (bubbles.length === 0) {
        console.warn("NEM találhatók üzenet buborékok! Lehetséges okok:");
        console.warn("1. Az oldal még nem töltött be teljesen.");
        console.warn("2. A Grok megváltoztatta az osztályneveket.");
        console.warn("3. Shadow DOM-ban vannak az elemek.");
    } else {
        bubbles.forEach((b, i) => {
            const parentEnd = b.closest('.items-end');
            const parentStart = b.closest('.items-start');
            let role = "Ismeretlen";

            if (parentEnd) role = "Felhasználó (items-end alapján)";
            else if (parentStart) role = "Grok (items-start alapján)";
            else if (b.classList.contains('bg-surface-l1')) role = "Felhasználó (bg-surface-l1 alapján)";
            else role = "Grok (fallback)";

            console.log(`Buborék #${i + 1}: Szerep autodetektálás: ${role}`);
            console.log(`Tartalom eleje: "${b.innerText.substring(0, 50).replace(/\n/g, ' ')}..."`);
        });
    }
    console.log("--- DEBUG END ---");
})();
