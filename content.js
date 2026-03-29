// Content script - ChatGPT, Gemini, Claude és Grok beszélgetések gyűjtése

// HTML -> Markdown konvertáló segédfüggvény (ctx: imagegen csoportonként egy IMG)
function domToMarkdown(node, ctx) {
    if (!node) return "";
    if (!ctx) {
        ctx = { imagegenEmitted: new WeakSet() };
    }

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
        content += domToMarkdown(child, ctx);
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
            if (node.getAttribute('aria-hidden') === 'true') {
                return '';
            }
            const imagegenGroup = node.closest('[class*="imagegen-image"]');
            if (imagegenGroup) {
                const altTrim = (node.getAttribute('alt') || '').trim();
                if (!altTrim) {
                    return '';
                }
                if (ctx.imagegenEmitted.has(imagegenGroup)) {
                    return '';
                }
                ctx.imagegenEmitted.add(imagegenGroup);
            }
            const alt = (node.getAttribute('alt') || '').trim() || 'image';
            let src = node.getAttribute('src');
            if (src) {
                try {
                    src = new URL(src, window.location.href).href;
                } catch (_) { /* keep */ }
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

// ChatGPT: tartalom-blokkok egy fordulaton belül (új UI: több [data-message-content], régi: egy .markdown / .whitespace-pre-wrap)
function chatgptPickContentRoots(turnEl, authorRole, isLegacyArticle) {
    const byData = turnEl.querySelectorAll('[data-message-content]');
    let roots = Array.from(byData).filter((el, _i, arr) =>
        !arr.some((other) => other !== el && other.contains(el))
    );
    if (roots.length > 0) {
        return roots;
    }
    const styled = turnEl.querySelector('.markdown, .prose, .whitespace-pre-wrap');
    if (styled) {
        return [styled];
    }
    if (isLegacyArticle) {
        if (authorRole === 'user') {
            const u = turnEl.querySelector('.whitespace-pre-wrap');
            if (u) return [u];
        }
        if (authorRole === 'assistant') {
            const a = turnEl.querySelector('.markdown');
            if (a) return [a];
        }
    }
    return [];
}

function chatgptPartHeading(contentNode) {
    const details = contentNode.closest('details');
    if (details) {
        const summary = details.querySelector('summary');
        if (summary && summary.textContent.trim()) {
            return summary.textContent.trim().replace(/\s+/g, ' ').slice(0, 160);
        }
    }
    const aria = contentNode.getAttribute('aria-label');
    if (aria && aria.trim()) {
        return aria.trim().slice(0, 160);
    }
    return null;
}

function chatgptRoleDisplay(raw) {
    if (raw === 'user') return 'Felhasználó';
    if (raw === 'assistant') return 'ChatGPT';
    if (raw === 'system') return 'Rendszer';
    if (raw === 'tool') return 'Eszköz';
    if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1);
    return 'Ismeretlen';
}

function chatgptImgEffectiveSize(img) {
    const wAttr = parseInt(img.getAttribute('width'), 10);
    const hAttr = parseInt(img.getAttribute('height'), 10);
    const nw = img.naturalWidth || wAttr || 0;
    const nh = img.naturalHeight || hAttr || 0;
    const cw = img.clientWidth || img.width || 0;
    const ch = img.clientHeight || img.height || 0;
    const effW = Math.max(nw, cw);
    const effH = Math.max(nh, ch);
    const attrsLarge = wAttr >= 50 && hAttr >= 50;
    const largeEnough = effW >= 50 && effH >= 50;
    return { largeEnough: largeEnough || attrsLarge, attrsLarge };
}

/** Estuary / ugyanazon fájl URL-je eltérhet query sorrendben — dedup id= alapján */
/** A generált kép gyakran NEM a [data-message-author-role] buborékon belül van, hanem testvérként a conversation-turn alatt. */
function chatgptImageSearchRoot(roleEl, scope) {
    if (!roleEl || !scope) {
        return roleEl;
    }
    const turn = roleEl.closest('[data-testid^="conversation-turn"]');
    if (turn && scope.contains(turn)) {
        return turn;
    }
    let n = roleEl.parentElement;
    while (n && n !== scope && scope.contains(n)) {
        if (
            n.querySelector('[class*="imagegen-image"]') ||
            n.querySelector('img[src*="estuary/content"]')
        ) {
            return n;
        }
        n = n.parentElement;
    }
    return roleEl;
}

function chatgptEstuaryDedupKey(href) {
    try {
        const u = new URL(href, window.location.href);
        if (u.pathname.includes('estuary') || u.pathname.includes('backend-api')) {
            const id = u.searchParams.get('id');
            if (id) {
                return `${u.origin}${u.pathname}?id=${id}`;
            }
        }
    } catch (_) { /* ignore */ }
    return href;
}

function chatgptPickRepresentativeImagegenImg(group) {
    const imgs = Array.from(group.querySelectorAll('img'));
    if (imgs.length === 0) {
        return null;
    }
    const scored = imgs.map((img) => {
        const ariaHidden = img.getAttribute('aria-hidden') === 'true';
        const alt = (img.getAttribute('alt') || '').trim();
        const { largeEnough } = chatgptImgEffectiveSize(img);
        return { img, ariaHidden, alt, largeEnough };
    });
    scored.sort((a, b) => {
        if (a.ariaHidden !== b.ariaHidden) {
            return a.ariaHidden ? 1 : -1;
        }
        if (!!a.alt !== !!b.alt) {
            return a.alt ? -1 : 1;
        }
        if (a.largeEnough !== b.largeEnough) {
            return a.largeEnough ? -1 : 1;
        }
        return 0;
    });
    return scored[0].img;
}

function chatgptCollectImagesMarkdown(container, messageText) {
    let imageMarkdown = '';
    const seenSrcs = new Set();
    const seenEstuaryKeys = new Set();

    function considerAppend(img) {
        let src = img.getAttribute('src');
        if (!src) {
            return;
        }
        try {
            src = new URL(src, window.location.href).href;
        } catch (_) { /* keep */ }
        if (seenSrcs.has(src)) {
            return;
        }
        const estKey = chatgptEstuaryDedupKey(src);
        if (estKey !== src && seenEstuaryKeys.has(estKey)) {
            return;
        }
        const { largeEnough } = chatgptImgEffectiveSize(img);
        if (!largeEnough || src.includes('avatar') || src.includes('profile')) {
            return;
        }
        if (messageText.includes(src)) {
            seenSrcs.add(src);
            seenEstuaryKeys.add(estKey);
            return;
        }
        const alt = (img.getAttribute('alt') || '').trim() || 'image';
        imageMarkdown += `\n![${alt}](${src})\n\n`;
        seenSrcs.add(src);
        seenEstuaryKeys.add(estKey);
    }

    // Generált kép: több <img> ugyanazzal a src-vel (sharp / blur / háttér) — egy link / csoport
    container.querySelectorAll('[class*="imagegen-image"]').forEach((group) => {
        const pick = chatgptPickRepresentativeImagegenImg(group);
        if (pick) {
            considerAppend(pick);
        }
    });

    container.querySelectorAll('img').forEach((img) => {
        if (img.closest('[class*="imagegen-image"]')) {
            return;
        }
        considerAppend(img);
    });

    return imageMarkdown;
}

// ChatGPT beszélgetés gyűjtése (új DOM: data-message-author-role + data-message-content; régi: article[data-turn])
function collectChatGPTConversation() {
    const mainEl = document.querySelector('main#main') || document.querySelector('main');
    const scope = mainEl || document;

    let roleNodes = Array.from(scope.querySelectorAll('[data-message-author-role]')).filter(
        (el, _i, arr) => !arr.some((other) => other !== el && other.contains(el))
    );

    let useLegacyArticle = false;
    if (roleNodes.length === 0) {
        const articles = scope.querySelectorAll('article[data-turn]');
        if (articles.length > 0) {
            useLegacyArticle = true;
            roleNodes = Array.from(articles);
        }
    }

    if (roleNodes.length === 0) {
        const testTurns = scope.querySelectorAll('[data-testid^="conversation-turn"]');
        if (testTurns.length > 0) {
            roleNodes = Array.from(testTurns);
        }
    }

    if (roleNodes.length === 0) {
        return null;
    }

    const messages = [];

    roleNodes.forEach((turn) => {
        let el = turn;
        let authorRole = useLegacyArticle
            ? el.getAttribute('data-turn')
            : el.getAttribute('data-message-author-role');

        if (!authorRole && el.matches && el.matches('[data-testid^="conversation-turn"]')) {
            const inner = el.querySelector('[data-message-author-role]');
            if (inner) {
                el = inner;
                authorRole = inner.getAttribute('data-message-author-role');
            }
        }

        if (!authorRole) {
            return;
        }

        const role = chatgptRoleDisplay(authorRole);
        let contentRoots = chatgptPickContentRoots(el, authorRole, useLegacyArticle);

        let messageText = '';
        let messageHtml = '';

        if (contentRoots.length > 0) {
            contentRoots.forEach((root, idx) => {
                let piece = domToMarkdown(root);
                if (!piece.trim()) {
                    piece = root.innerText || '';
                }
                piece = piece.trim();
                if (!piece) {
                    return;
                }
                if (contentRoots.length > 1) {
                    const label = chatgptPartHeading(root) || `Rész ${idx + 1}`;
                    messageText += (messageText ? '\n\n' : '') + `#### ${label}\n\n${piece}`;
                    messageHtml += (messageHtml ? '<hr/>' : '') + root.outerHTML;
                } else {
                    messageText = piece;
                    messageHtml = root.innerHTML;
                }
            });
        }

        const imageRoot = chatgptImageSearchRoot(el, scope);
        const imageMarkdown = chatgptCollectImagesMarkdown(imageRoot, messageText);
        if (imageMarkdown) {
            messageText = messageText ? messageText + '\n' + imageMarkdown : imageMarkdown.trim();
        }

        if (!messageText.trim()) {
            messageText = domToMarkdown(el);
            if (!messageText.trim()) {
                messageText = el.innerText || '';
            }
            messageHtml = el.innerHTML;
        }

        if (messageText.trim()) {
            messages.push({
                role,
                authorRole,
                text: messageText.trim(),
                html: messageHtml
            });
        }
    });

    return {
        platform: 'ChatGPT',
        messages
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
        platform: data.platform,
        sourceUrl: window.location.href
    };
}

function blobToBase64Data(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Popup / DOCX: ChatGPT generált képek (backend-api/estuary) csak bejelentkezési sütikkel tölthetők le —
// a háttér-szkript fetch() nem küldi ezeket; ugyanazon lap originjén credentials: 'include' kell.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "collectConversation") {
        sendResponse(collectConversation());
        return false;
    }
    if (request.action === "fetchBlobWithCredentials") {
        (async () => {
            try {
                const rawUrl = request.url;
                if (!rawUrl || typeof rawUrl !== "string") {
                    sendResponse({ success: false, error: "Invalid URL" });
                    return;
                }
                const u = new URL(rawUrl, window.location.href);
                if (u.origin !== window.location.origin) {
                    sendResponse({ success: false, error: "Cross-origin blocked" });
                    return;
                }
                // same-origin + credentials: a böngésző CORS szerint olvasható választ ad (nem opaque)
                const res = await fetch(u.href, {
                    credentials: "include",
                    redirect: "follow",
                    mode: "cors",
                    cache: "default",
                    referrerPolicy: "strict-origin-when-cross-origin"
                });
                if (res.type === "opaque" || res.type === "opaqueredirect") {
                    sendResponse({ success: false, error: "CORS: nem olvasható válasz (opaque)" });
                    return;
                }
                if (!res.ok) {
                    sendResponse({ success: false, error: `HTTP ${res.status}` });
                    return;
                }
                const blob = await res.blob();
                const base64Data = await blobToBase64Data(blob);
                sendResponse({
                    success: true,
                    data: base64Data,
                    mimeType: blob.type || "application/octet-stream"
                });
            } catch (e) {
                sendResponse({ success: false, error: e.message || String(e) });
            }
        })();
        return true;
    }
    return false;
});

const platform = detectPlatform();
if (platform) {
    console.log(`ChatGPT, Gemini, Claude & Grok Mentő bővítmény betöltve - Platform: ${platform}`);
} else {
    console.log(`ChatGPT, Gemini & Claude Mentő bővítmény betöltve - Platform: ismeretlen (URL: ${window.location.href}, Hostname: ${window.location.hostname})`);
}