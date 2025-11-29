// Content script - ChatGPT, Gemini és Claude beszélgetések gyűjtése

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
    console.log(`ChatGPT, Gemini & Claude Mentő bővítmény betöltve - Platform: ${platform}`);
} else {
    console.log(`ChatGPT, Gemini & Claude Mentő bővítmény betöltve - Platform: ismeretlen (URL: ${window.location.href}, Hostname: ${window.location.hostname})`);
}