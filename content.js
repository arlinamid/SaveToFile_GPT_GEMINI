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
        case 'DIV': return `${content}\n`;
        default: return content;
    }
}

// Detektálja, hogy ChatGPT vagy Gemini oldalon vagyunk-e
function detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
        return 'chatgpt';
    } else if (hostname.includes('gemini.google.com')) {
        return 'gemini';
    }
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
    
    // Claude felhasználói üzenetek: .group.relative.inline-flex elemeiben
    const userMessages = document.querySelectorAll('[data-testid="user-message"]');
    const assistantContainers = document.querySelectorAll('[data-is-streaming], .font-claude-response');
    
    // Összegyűjtjük az összes beszélgetési blokkot időrendi sorrendben
    const conversationBlocks = document.querySelectorAll('.relative.w-full.min-h-full > .mx-auto > .flex-1 > div');
    
    conversationBlocks.forEach((block) => {
        // Felhasználói üzenet keresése
        const userMsg = block.querySelector('[data-testid="user-message"]');
        if (userMsg) {
            const userText = userMsg.textContent.trim();
            if (userText) {
                messages.push({
                    role: 'Felhasználó',
                    text: userText,
                    html: userMsg.innerHTML
                });
            }
        }
        
        // Claude válasz keresése
        const claudeResponse = block.querySelector('.font-claude-response');
        if (claudeResponse) {
            // Standard markdown tartalom
            const markdownContent = claudeResponse.querySelector('.standard-markdown, .progressive-markdown');
            let responseText = '';
            
            if (markdownContent) {
                responseText = domToMarkdown(markdownContent);
            } else {
                // Fallback: teljes válasz szöveg
                responseText = claudeResponse.textContent.trim();
            }
            
            if (responseText) {
                messages.push({
                    role: 'Claude',
                    text: responseText,
                    html: claudeResponse.innerHTML
                });
            }
        }
    });
    
    // Ha nem találtunk blokkokat, próbáljuk az egyszerűbb megközelítést
    if (messages.length === 0) {
        // Felhasználói üzenetek
        userMessages.forEach((userMsg) => {
            const userText = userMsg.textContent.trim();
            if (userText) {
                messages.push({
                    role: 'Felhasználó',
                    text: userText,
                    html: userMsg.innerHTML
                });
            }
        });
        
        // Claude válaszok
        document.querySelectorAll('.font-claude-response').forEach((response) => {
            const markdownContent = response.querySelector('.standard-markdown, .progressive-markdown');
            let responseText = '';
            
            if (markdownContent) {
                responseText = domToMarkdown(markdownContent);
            } else {
                responseText = response.textContent.trim();
            }
            
            if (responseText) {
                messages.push({
                    role: 'Claude',
                    text: responseText,
                    html: response.innerHTML
                });
            }
        });
    }
    
    if (messages.length === 0) {
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
console.log(`ChatGPT, Gemini & Claude Mentő bővítmény betöltve - Platform: ${platform || 'ismeretlen'}`);
