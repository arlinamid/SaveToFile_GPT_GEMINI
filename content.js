// Content script - ChatGPT, Gemini, Claude és Grok beszélgetések gyűjtése

// HTML -> Markdown konvertáló segédfüggvény
function domToMarkdown(node) {
    if (!node) return "";

    // Ha szöveges csomópont
    if (node.nodeType === 3) {
        return node.nodeValue;
    }

    // Ha nem elem, ugorjuk át
    if (node.nodeType !== 1) return "";
    let content = "";

    // Kódblokkok kezelése
    if (node.tagName === 'PRE') {
        const codeElem = node.querySelector('code');
        if (codeElem) {
            const langMatch = codeElem.className.match(/language-(\w+)/);
            const lang = langMatch ? langMatch[1] : "";
            return `\n\`\`\`${lang}\n${codeElem.textContent}\n\`\`\`\n\n`;
        }
    }

    // Gyerek elemek feldolgozása
    node.childNodes.forEach(child => {
        content += domToMarkdown(child);
    });

    // Markdown formázás
    switch (node.tagName) {
        case 'H1': return `# ${content}\n\n`;
        case 'H2': return `## ${content}\n\n`;
        case 'H3': return `### ${content}\n\n`;
        case 'H4': return `#### ${content}\n\n`;
        case 'P': return `${content}\n\n`;
        case 'STRONG': case 'B': return `**${content}**`;
        case 'EM': case 'I': return `*${content}*`;
        case 'CODE':
            if (node.parentElement.tagName !== 'PRE') return `\`${content}\``;
            return content;
        case 'A': return `[${content}](${node.getAttribute('href')})`;
        case 'UL': return `${content}\n`;
        case 'OL': return `${content}\n`;
        case 'LI':
            const parent = node.parentElement;
            let prefix = '-';

            if (parent.tagName === 'OL') {
                // Megkeressük, hányadik LI elem ez a szülőben
                const siblings = Array.from(parent.children).filter(child => child.tagName === 'LI');
                const index = siblings.indexOf(node) + 1;
                prefix = `${index}.`;
            }
            return `${prefix} ${content.trim()}\n`;

        case 'BLOCKQUOTE': return `> ${content}\n\n`;
        case 'BR': return `\n`;
        case 'TABLE': return `\n${content}\n`;
        case 'TR': return `| ${content} |\n`;
        case 'TH': case 'TD': return `${content} | `;
        case 'DIV':
            // Ha a div-nek nincs gyereke, vagy csak szöveg van benne, ne adjunk hozzá extra sortörést
            if (node.childNodes.length === 0 || (node.childNodes.length === 1 && node.childNodes[0].nodeType === 3)) {
                return content;
            }
            return `${content}\n`;
        case 'IMG':
            const alt = node.getAttribute('alt') || 'image';
            const src = node.getAttribute('src');
            if (src) {
                return `\n![${alt}](${src})\n\n`;
            }
            return '';
        default: return content;
    }
}

// Detektálja, hogy ChatGPT vagy Gemini oldalon vagyunk-e
// Detect which platform we're on
function detectPlatform() {
    const url = window.location.href;
    const hostname = window.location.hostname;

    console.log('Platform detection - URL:', url);
    console.log('Platform detection - Hostname:', hostname);

    // ChatGPT detection
    if (url.includes('chatgpt.com') || url.includes('chat.openai.com') ||
        hostname.includes('chatgpt') || hostname.includes('openai')) {
        console.log('Detected platform: chatgpt');
        return 'chatgpt';
    }

    // Gemini detection
    if (url.includes('gemini.google.com') || hostname.includes('gemini')) {
        console.log('Detected platform: gemini');
        return 'gemini';
    }

    // Claude detection - több módszerrel
    if (url.includes('claude.ai') ||
        hostname === 'claude.ai' ||
        hostname.includes('claude') ||
        hostname.endsWith('.claude.ai')) {
        console.log('Detected platform: claude');
        return 'claude';
    }

    // Grok detection
    if (url.includes('grok.com') || hostname.includes('grok')) {
        console.log('Detected platform: grok');
        return 'grok';
    }

    console.log('Platform detection failed - returning null');
    console.log('URL check - claude.ai:', url.includes('claude.ai'));
    console.log('Hostname check - claude.ai:', hostname === 'claude.ai');
    console.log('Hostname check - includes claude:', hostname.includes('claude'));
    return null;
}

// ChatGPT beszélgetés gyűjtése
function collectChatGPTConversation() {
    const articles = document.querySelectorAll('article');

    if (articles.length === 0) {
        return null;
    }

    const messages = [];

    articles.forEach((article) => {
        const turn = article.getAttribute('data-turn');
        let role = "Ismeretlen";
        let messageText = "";
        let messageHtml = "";

        // Képek keresése az üzenetben (Text után)
        const images = article.querySelectorAll('img');
        let imageMarkdown = "";
        const seenSrcs = new Set();

        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src && !seenSrcs.has(src)) {
                // Szűrjük a profilképeket és egyéb ikonokat (pl. 24x24, avatar)
                if (img.width < 50 || img.height < 50 || src.includes('avatar') || src.includes('profile')) {
                    return;
                }

                // Ellenőrizzük, hogy ez a kép már benne van-e a messageText-ben (ha a markdown konvertálás már megtalálta)
                if (messageText.includes(src)) {
                    seenSrcs.add(src);
                    return;
                }

                const alt = img.getAttribute('alt') || 'image';
                imageMarkdown += `\n![${alt}](${src})\n\n`;
                seenSrcs.add(src);
            }
        });

        if (turn === 'user') {
            role = "Felhasználó";
            const contentDiv = article.querySelector('.whitespace-pre-wrap');
            if (contentDiv) {
                // Próbáljuk meg markdown formátumban, hogy megőrizzük a formázást
                messageText = domToMarkdown(contentDiv);
                // Ha üres, akkor sima szöveg
                if (!messageText.trim()) {
                    messageText = contentDiv.innerText;
                }
                messageHtml = contentDiv.innerHTML;
            }
        } else if (turn === 'assistant') {
            role = "ChatGPT";
            const contentDiv = article.querySelector('.markdown');
            if (contentDiv) {
                // Először az egész markdown div-et konvertáljuk (kezeli a beágyazott tag-eket)
                messageText = domToMarkdown(contentDiv);
                // Ha üres, próbáljuk meg más módszerekkel
                if (!messageText.trim()) {
                    // Keressük az összes markdown elemet
                    const markdownElements = contentDiv.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, code');
                    if (markdownElements.length > 0) {
                        messageText = '';
                        markdownElements.forEach(el => {
                            const converted = domToMarkdown(el);
                            if (converted.trim()) {
                                messageText += converted;
                            }
                        });
                    } else {
                        // Végül: teljes szöveg
                        messageText = contentDiv.textContent.trim();
                    }
                }
                messageHtml = contentDiv.innerHTML;
            }
        }

        // Képek hozzáadása a szöveghez
        if (imageMarkdown) {
            messageText = messageText ? messageText + "\n" + imageMarkdown : imageMarkdown;
        }

        // Fallback: ha még mindig nincs szöveg, az egész article-t próbáljuk
        if (!messageText.trim()) {
            messageText = domToMarkdown(article);
            if (!messageText.trim()) {
                messageText = article.innerText;
            }
            messageHtml = article.innerHTML;
        }

        if (messageText.trim()) {
            messages.push({
                role: role,
                text: messageText.trim(),
                html: messageHtml
            });
        }
    });

    return {
        platform: 'ChatGPT',
        messages: messages
    };
}

// Gemini beszélgetés gyűjtése
function collectGeminiConversation() {
    // Gemini beszélgetés konténerek
    const conversationContainers = document.querySelectorAll('.conversation-container');

    if (conversationContainers.length === 0) {
        return null;
    }

    const messages = [];

    conversationContainers.forEach((container) => {
        // Felhasználó kérdése (user-query)
        const userQuery = container.querySelector('user-query');
        if (userQuery) {
            // Képek keresése a user query-ben
            const userImages = userQuery.querySelectorAll('img');
            let userImageMarkdown = "";
            const userSeenSrcs = new Set();

            userImages.forEach(img => {
                const src = img.getAttribute('src');
                if (src && !userSeenSrcs.has(src)) {
                    if (img.width < 50 || img.height < 50 || src.includes('avatar') || src.includes('profile')) {
                        return;
                    }
                    // Ellenőrizzük, hogy ez a kép már benne van-e a messageText-ben (ha a markdown konvertálás már megtalálta)
                    // Itt még nincs messageText, de a domToMarkdown később lefuthat
                    const alt = img.getAttribute('alt') || 'User uploaded image';
                    userImageMarkdown += `\n![${alt}](${src})\n\n`;
                    userSeenSrcs.add(src);
                }
            });

            // Próbáljuk meg markdown formátumban, hogy megőrizzük a formázást
            let queryText = domToMarkdown(userQuery);

            // Ha üres, próbáljuk meg a query-text-line elemeket
            if (!queryText.trim()) {
                const queryLines = userQuery.querySelectorAll('.query-text-line');
                if (queryLines.length > 0) {
                    queryText = '';
                    queryLines.forEach(line => {
                        const converted = domToMarkdown(line);
                        if (converted.trim()) {
                            queryText += converted;
                        } else {
                            queryText += line.textContent.trim() + '\n';
                        }
                    });
                } else {
                    // Végül: teljes szöveg
                    queryText = userQuery.textContent.trim();
                }
            }

            // Képek hozzáadása
            if (userImageMarkdown) {
                // Csak akkor adjuk hozzá, ha még nincs benne (bár a domToMarkdown valószínűleg nem rakja bele IMG tag nélkül)
                if (!queryText.includes(userImageMarkdown.trim())) {
                    queryText = queryText ? queryText + "\n" + userImageMarkdown : userImageMarkdown;
                }
            }

            if (queryText.trim()) {
                messages.push({
                    role: 'Felhasználó',
                    text: queryText.trim(),
                    html: userQuery.innerHTML
                });
            }
        }

        // Gemini válasza (model-response)
        const modelResponse = container.querySelector('model-response');
        if (modelResponse) {
            // Képek keresése a model response-ban (generált képek)
            const modelImages = modelResponse.querySelectorAll('img');
            let modelImageMarkdown = "";
            const modelSeenSrcs = new Set();

            modelImages.forEach(img => {
                const src = img.getAttribute('src');
                if (src && !modelSeenSrcs.has(src)) {
                    if (img.width < 50 || img.height < 50 || src.includes('avatar') || src.includes('profile')) {
                        return;
                    }
                    const alt = img.getAttribute('alt') || 'Generated Image';
                    modelImageMarkdown += `\n![${alt}](${src})\n\n`;
                    modelSeenSrcs.add(src);
                }
            });


            // Először próbáljuk meg az egész message-content-et markdown-ra konvertálni
            const messageContent = modelResponse.querySelector('message-content');
            let responseText = '';

            if (messageContent) {
                // Először az egész message-content-et konvertáljuk (kezeli a beágyazott tag-eket)
                responseText = domToMarkdown(messageContent);

                // Ha üres, próbáljuk meg a .markdown elemet
                if (!responseText.trim()) {
                    const markdownDiv = messageContent.querySelector('.markdown');
                    if (markdownDiv) {
                        responseText = domToMarkdown(markdownDiv);
                    }
                }

                // Ha még mindig üres, próbáljuk meg a markdown elemeket
                if (!responseText.trim()) {
                    const markdownElements = messageContent.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, code');
                    if (markdownElements.length > 0) {
                        responseText = '';
                        markdownElements.forEach(el => {
                            const converted = domToMarkdown(el);
                            if (converted.trim()) {
                                responseText += converted;
                            }
                        });
                    } else {
                        // Végül: teljes szöveg
                        responseText = messageContent.textContent.trim();
                    }
                }
            }

            // Képek hozzáadása
            if (modelImageMarkdown) {
                if (!responseText.includes(modelImageMarkdown.trim())) {
                    responseText = responseText ? responseText + "\n" + modelImageMarkdown : modelImageMarkdown;
                }
            }

            if (responseText.trim()) {
                messages.push({
                    role: 'Gemini',
                    text: responseText.trim(),
                    html: modelResponse.innerHTML
                });
            }
        }
    });

    return {
        platform: 'Gemini',
        messages: messages
    };
}

// Claude beszélgetés gyűjtése
function collectClaudeConversation() {
    const messages = [];
    const seenTexts = new Set(); // Duplikáció elkerülésére

    // Helper függvény Claude válasz szöveg kinyerésére
    function extractClaudeText(claudeResponse) {
        // Először próbáljuk meg az egész claudeResponse-t konvertálni markdown-ra
        // Ez automatikusan kezeli a beágyazott tag-eket (pl. <h3><b>szöveg</b></h3>)
        let responseText = domToMarkdown(claudeResponse);

        // Ha az eredmény üres vagy túl rövid, próbáljuk meg más módszerekkel
        if (!responseText.trim() || responseText.trim().length < 10) {
            // Keressük az összes standard-markdown vagy progressive-markdown elemet
            const allMarkdown = claudeResponse.querySelectorAll('.standard-markdown, .progressive-markdown');

            if (allMarkdown.length > 0) {
                responseText = '';
                // DOM sorrendben feldolgozzuk (querySelectorAll DOM sorrendet ad vissza)
                allMarkdown.forEach(md => {
                    const converted = domToMarkdown(md);
                    if (converted.trim()) {
                        responseText += converted;
                    }
                });
            } else {
                // Ha nincs markdown konténer, keressük közvetlenül a markdown elemeket
                const directMarkdown = claudeResponse.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre');
                if (directMarkdown.length > 0) {
                    responseText = '';
                    directMarkdown.forEach(el => {
                        const converted = domToMarkdown(el);
                        if (converted.trim()) {
                            responseText += converted;
                        }
                    });
                } else {
                    // Végül: teljes szöveg
                    responseText = claudeResponse.textContent.trim();
                }
            }
        }

        return responseText.trim();
    }

    // Helper függvény üzenet hozzáadására duplikáció ellenőrzéssel
    function addMessage(role, text, html) {
        if (!text || seenTexts.has(text)) {
            return false;
        }
        seenTexts.add(text);
        messages.push({ role, text, html });
        return true;
    }

    // Módszer 1: Beszélgetési blokkok keresése (data-test-render-count) - EZ A FŐ MÓDSZER
    // Ezek a blokkok tartalmazzák az összes üzenetet sorrendben
    const conversationBlocks = document.querySelectorAll('div[data-test-render-count]');

    if (conversationBlocks.length > 0) {
        conversationBlocks.forEach((block) => {
            // Felhasználói üzenet keresése
            const userMsg = block.querySelector('[data-testid="user-message"]');
            if (userMsg) {
                const userText = userMsg.textContent.trim();
                if (userText) {
                    addMessage('Felhasználó', userText, userMsg.innerHTML);
                }
            }

            // Claude válasz keresése - lehet data-is-streaming div-ben is
            let claudeResponse = block.querySelector('.font-claude-response');

            // Ha nincs közvetlenül a blokkban, keressük a data-is-streaming div-ben
            if (!claudeResponse) {
                const streamingDiv = block.querySelector('div[data-is-streaming]');
                if (streamingDiv) {
                    claudeResponse = streamingDiv.querySelector('.font-claude-response');
                }
            }

            if (claudeResponse) {
                const responseText = extractClaudeText(claudeResponse);
                if (responseText) {
                    addMessage('Claude', responseText, claudeResponse.innerHTML);
                }
            }
        });
    }

    // Módszer 2: Ha nem találtunk blokkokat, keressük a data-is-streaming div-eket közvetlenül
    if (messages.length === 0) {
        const streamingDivs = document.querySelectorAll('div[data-is-streaming]');

        streamingDivs.forEach((streamingDiv) => {
            const claudeResponse = streamingDiv.querySelector('.font-claude-response');
            if (claudeResponse) {
                const responseText = extractClaudeText(claudeResponse);
                if (responseText) {
                    addMessage('Claude', responseText, claudeResponse.innerHTML);
                }
            }
        });
    }

    // Módszer 3: Ha még mindig nincs elég üzenet, közvetlenül keressük az üzeneteket
    if (messages.length < 2) {
        // Felhasználói üzenetek közvetlenül
        const userMessages = document.querySelectorAll('[data-testid="user-message"]');
        userMessages.forEach((userMsg) => {
            const userText = userMsg.textContent.trim();
            if (userText) {
                addMessage('Felhasználó', userText, userMsg.innerHTML);
            }
        });

        // Claude válaszok közvetlenül
        const claudeResponses = document.querySelectorAll('.font-claude-response');
        claudeResponses.forEach((response) => {
            const responseText = extractClaudeText(response);
            if (responseText) {
                addMessage('Claude', responseText, response.innerHTML);
            }
        });
    }

    // Módszer 4: Alternatív struktúra keresése (group relative inline-flex)
    if (messages.length === 0) {
        const groupMessages = document.querySelectorAll('.group.relative.inline-flex');
        groupMessages.forEach((group) => {
            // Felhasználói üzenet
            const userMsg = group.querySelector('[data-testid="user-message"]');
            if (userMsg) {
                const userText = userMsg.textContent.trim();
                if (userText) {
                    addMessage('Felhasználó', userText, userMsg.innerHTML);
                }
            }

            // Claude válasz
            const claudeResponse = group.querySelector('.font-claude-response');
            if (claudeResponse) {
                const responseText = extractClaudeText(claudeResponse);
                if (responseText) {
                    addMessage('Claude', responseText, claudeResponse.innerHTML);
                }
            }
        });
    }

    if (messages.length === 0) {
        console.log('Claude: No messages found. Debug info:');
        console.log('User messages found:', document.querySelectorAll('[data-testid="user-message"]').length);
        console.log('Claude responses found:', document.querySelectorAll('.font-claude-response').length);
        console.log('Streaming divs found:', document.querySelectorAll('div[data-is-streaming]').length);
        return null;
    }

    return {
        platform: 'Claude',
        messages: messages
    };
}

// Grok beszélgetés gyűjtése
// Grok beszélgetés gyűjtése
function collectGrokConversation() {
    console.log('[SaveToFile] collectGrokConversation started');
    const messages = [];
    const bubbles = document.querySelectorAll('.message-bubble');
    console.log(`[SaveToFile] Found ${bubbles.length} message bubbles`);

    if (bubbles.length === 0) {
        console.log('[SaveToFile] No bubbles found, returning null');
        return null;
    }

    bubbles.forEach((bubble, index) => {
        let role = "Ismeretlen"; // Default
        let text = "";

        // Logika a debug snippet alapján (ez bizonyítottan működött a felhasználónál)
        // 1. Próbáljuk a szülő igazítása alapján (biztosabb pont)
        const parentEnd = bubble.closest('.items-end');
        const parentStart = bubble.closest('.items-start');

        if (parentEnd) {
            role = "Felhasználó";
        } else if (parentStart) {
            role = "Grok";
        } else {
            // 2. Fallback: háttérszín alapján
            if (bubble.classList.contains('bg-surface-l1')) {
                role = "Felhasználó";
            } else {
                role = "Grok";
            }
        }

        // Képek keresése a buborékban
        // Grok specifikus képek (.group/grok-image)
        // A slash karaktert escape-elni kell a querySelector-ban: .group\/grok-image -> .group\\/grok-image
        const grokImages = bubble.querySelectorAll('.group\\/grok-image img');
        let imageMarkdown = "";
        const seenSrcs = new Set();

        grokImages.forEach(img => {
            const src = img.getAttribute('src');
            if (src) {
                // Szűrjük a 24x24 ikonokat, de a generált képeket megtartjuk
                if (img.width < 50 || img.height < 50 || src.includes('avatar') || src.includes('profile')) {
                    return;
                }

                // A generált képeknél általában van egy háttérkép (blur) és egy előtérkép (z-[200]).
                // A háttérkép src-je ugyanaz lehet. Ha már láttuk, ne adjuk hozzá mégegyszer.
                if (seenSrcs.has(src)) return;

                const alt = img.getAttribute('alt') || 'Grok Generated Image';
                imageMarkdown += `\n![${alt}](${src})\n\n`;
                seenSrcs.add(src);
            }
        });

        // Szöveg kinyerése
        const markdownDiv = bubble.querySelector('.markdown');
        if (markdownDiv) {
            text = domToMarkdown(markdownDiv);
        } else {
            text = domToMarkdown(bubble);
        }

        // Ha a domToMarkdown üres stringet adna vissza (pl. parse hiba),
        // akkor fallback az innerText-re, hogy biztosan legyen tartalom.
        if (!text || !text.trim()) {
            console.warn(`[SaveToFile] Bubble ${index}: domToMarkdown returned empty, using innerText fallback.`);
            text = bubble.innerText;
        }

        // Képek hozzáadása
        if (imageMarkdown) {
            // Csak akkor adjuk hozzá, ha még nincs benne (bár a domToMarkdown valószínűleg nem rakja bele IMG tag nélkül)
            // A domToMarkdown alapból kezeli az IMG tag-eket, de lehet, hogy nem érte el őket (pl. markdownDiv-en kívül voltak).
            // Itt ellenőrizzük, hogy benne vannak-e a szövegben.

            // Az ellenőrzés kicsit trükkös, mert a domToMarkdown lehet hogy már hozzáadta máshogy.
            // De mivel a seenSrcs-ben benne vannak a most talált képek, végigiterálhatunk rajtuk.

            seenSrcs.forEach(src => {
                if (!text.includes(src)) {
                    // Keressük meg a hozzá tartozó alt textet és markdown formátumot
                    // (vagy egyszerűen csak fűzzük hozzá az összes újat, amit nem találtunk meg)
                    // Egyszerűbb, ha újraépítjük az imageMarkdown-t csak a hiányzókból, de a fenti ciklusban már építettük.
                    // Ha a szöveg nem tartalmazza az imageMarkdown-t EGYBEN, az nem jelent semmit.
                    // Jobb megközelítés:
                }
            });

            // Egyszerűbb megközelítés:
            // Ha a szöveg NEM tartalmazza az első kép URL-jét, akkor valószínűleg egyiket sem tartalmazza (feltételezve, hogy egy blokkban vannak).
            // De lehet, hogy a domToMarkdown megtalálta az egyiket, a másikat nem? Nem valószínű.
            // A biztonság kedvéért fűzzük hozzá azokat, amik hiányoznak.

            // Újrageneráljuk a hiányzókat
            let missingImagesMarkdown = "";
            grokImages.forEach(img => {
                const src = img.getAttribute('src');
                if (src && !text.includes(src)) {
                    // Még ellenőrizzük, hogy ehhez a körhöz már hozzáadtuk-e (seenSrcs duplikáció szűrés miatt)
                    // De itt a `missingImagesMarkdown`-ba kell gyűjteni.

                    // Trükk: a seenSrcs-ben már benne van minden, amit ebben a körben találtunk.
                    // Csak azt kell tudni, hogy a `text`-ben benne van-e.
                    if (img.width < 50 || img.height < 50 || src.includes('avatar') || src.includes('profile')) return;

                    // Kerüljük a duplikációt a missingImagesMarkdown-on belül is
                    if (!missingImagesMarkdown.includes(src)) {
                        const alt = img.getAttribute('alt') || 'Grok Generated Image';
                        missingImagesMarkdown += `\n![${alt}](${src})\n\n`;
                    }
                }
            });

            if (missingImagesMarkdown) {
                text = text ? text + "\n" + missingImagesMarkdown : missingImagesMarkdown;
            }
        }

        console.log(`[SaveToFile] Bubble ${index}: Role=${role}, TextLength=${text ? text.length : 0}`);

        if (text && text.trim()) {
            messages.push({
                role: role,
                text: text.trim(),
                html: bubble.innerHTML
            });
        }
    });

    console.log(`[SaveToFile] Collected ${messages.length} messages`);

    return {
        platform: 'Grok',
        messages: messages
    };
}

// Beszélgetés adatok gyűjtése (univerzális)
function collectConversation() {
    const platform = detectPlatform();
    const date = new Date().toISOString().slice(0, 10);
    let data = null;

    if (platform === 'chatgpt') {
        data = collectChatGPTConversation();
    } else if (platform === 'gemini') {
        data = collectGeminiConversation();
    } else if (platform === 'claude') {
        data = collectClaudeConversation();
    } else if (platform === 'grok') {
        data = collectGrokConversation();
    }

    if (!data || !data.messages || data.messages.length === 0) {
        return null;
    }

    return {
        date: date,
        messages: data.messages,
        title: document.title || `${data.platform} Beszélgetés`,
        platform: data.platform
    };
}

// Üzenet fogadása a popup-tól
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "collectConversation") {
        const data = collectConversation();
        sendResponse(data);
    }
    return true;
});

const platform = detectPlatform();
if (platform) {
    console.log(`ChatGPT, Gemini, Claude & Grok Mentő bővítmény betöltve - Platform: ${platform}`);
} else {
    console.log(`ChatGPT, Gemini & Claude Mentő bővítmény betöltve - Platform: ismeretlen (URL: ${window.location.href}, Hostname: ${window.location.hostname})`);
}