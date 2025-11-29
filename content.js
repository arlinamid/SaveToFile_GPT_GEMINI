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
                messageText = contentDiv.innerText;
                messageHtml = contentDiv.innerHTML;
            }
        } else if (turn === 'assistant') {
            role = "ChatGPT";
            const contentDiv = article.querySelector('.markdown');
            if (contentDiv) {
                messageText = domToMarkdown(contentDiv);
                messageHtml = contentDiv.innerHTML;
            }
        }
        
        if (!messageText) {
            messageText = article.innerText;
            messageHtml = article.innerHTML;
        }
        
        messages.push({
            role: role,
            text: messageText,
            html: messageHtml
        });
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
            // Kérdés szövegének összegyűjtése
            const queryLines = userQuery.querySelectorAll('.query-text-line');
            let queryText = '';
            queryLines.forEach(line => {
                queryText += line.textContent.trim() + '\n';
            });
            
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
            // Válasz szövegének gyűjtése
            const messageContent = modelResponse.querySelector('message-content .markdown');
            let responseText = '';
            
            if (messageContent) {
                responseText = domToMarkdown(messageContent);
            } else {
                // Fallback: ha nincs markdown osztály, próbáljuk az egész message-content-et
                const content = modelResponse.querySelector('message-content');
                if (content) {
                    responseText = content.innerText;
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
        let responseText = '';
        
        // Először keressük az összes standard-markdown vagy progressive-markdown elemet
        const allMarkdown = claudeResponse.querySelectorAll('.standard-markdown, .progressive-markdown');
        
        if (allMarkdown.length > 0) {
            // Ha van markdown konténer, konvertáljuk mindegyiket sorrendben
            // Fontos: ne használjunk querySelectorAll-t, mert az nem garantál DOM sorrendet
            // Helyette közvetlenül a claudeResponse-ből keressük a gyerekeket
            const markdownContainers = Array.from(claudeResponse.children).filter(child => {
                return child.classList.contains('standard-markdown') || 
                       child.classList.contains('progressive-markdown') ||
                       child.querySelector('.standard-markdown, .progressive-markdown');
            });
            
            if (markdownContainers.length > 0) {
                // Ha közvetlenül a claudeResponse gyerekei a markdown konténerek
                markdownContainers.forEach(container => {
                    const markdownDiv = container.classList.contains('standard-markdown') || 
                                       container.classList.contains('progressive-markdown')
                                       ? container 
                                       : container.querySelector('.standard-markdown, .progressive-markdown');
                    
                    if (markdownDiv) {
                        const converted = domToMarkdown(markdownDiv);
                        if (converted.trim()) {
                            responseText += converted;
                            // Csak akkor adjunk hozzá extra sortörést, ha nem heading vagy lista
                            if (!converted.match(/^#{1,6}\s/) && !converted.match(/^[-*+]\s/) && !converted.match(/^\d+\.\s/)) {
                                responseText += '\n\n';
                            }
                        }
                    }
                });
            } else {
                // Ha nincs közvetlen gyerek, akkor querySelectorAll-t használunk
                allMarkdown.forEach(md => {
                    const converted = domToMarkdown(md);
                    if (converted.trim()) {
                        responseText += converted;
                        // Csak akkor adjunk hozzá extra sortörést, ha nem heading vagy lista
                        if (!converted.match(/^#{1,6}\s/) && !converted.match(/^[-*+]\s/) && !converted.match(/^\d+\.\s/)) {
                            responseText += '\n\n';
                        }
                    }
                });
            }
        } else {
            // Ha nincs markdown konténer, keressük közvetlenül a markdown elemeket
            // Fontos: DOM sorrendben, ne querySelectorAll-t használjunk
            const directMarkdown = Array.from(claudeResponse.querySelectorAll('p, h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre'))
                .filter(el => {
                    // Csak azokat, amik közvetlenül a claudeResponse-ben vagy standard-markdown-ban vannak
                    const parent = el.parentElement;
                    return parent === claudeResponse || 
                           parent.classList.contains('standard-markdown') || 
                           parent.classList.contains('progressive-markdown');
                });
            
            if (directMarkdown.length > 0) {
                directMarkdown.forEach(el => {
                    const converted = domToMarkdown(el);
                    if (converted.trim()) {
                        responseText += converted;
                    }
                });
            } else {
                // Fallback: teljes válasz szöveg (de próbáljuk meg markdown formátumban)
                responseText = domToMarkdown(claudeResponse);
                if (!responseText.trim()) {
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