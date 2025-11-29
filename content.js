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
    
    // Módszer 1: data-is-streaming div-ek keresése (ezek tartalmazzák a válaszokat)
    const streamingDivs = document.querySelectorAll('div[data-is-streaming]');
    
    streamingDivs.forEach((streamingDiv) => {
        // Claude válasz keresése a streaming div-ben
        const claudeResponse = streamingDiv.querySelector('.font-claude-response');
        if (claudeResponse) {
            // Standard markdown tartalom
            const markdownContent = claudeResponse.querySelector('.standard-markdown, .progressive-markdown');
            let responseText = '';
            
            if (markdownContent) {
                responseText = domToMarkdown(markdownContent);
            } else {
                // Ha nincs markdown konténer, próbáljuk az egész válasz szövegét
                // Keresünk minden szöveges tartalmat a font-claude-response-ben
                const textElements = claudeResponse.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, code, pre');
                if (textElements.length > 0) {
                    textElements.forEach(el => {
                        const text = el.textContent.trim();
                        if (text) {
                            responseText += text + '\n\n';
                        }
                    });
                } else {
                    // Fallback: teljes válasz szöveg
                    responseText = claudeResponse.textContent.trim();
                }
            }
            
            if (responseText.trim()) {
                messages.push({
                    role: 'Claude',
                    text: responseText.trim(),
                    html: claudeResponse.innerHTML
                });
            }
        }
    });
    
    // Módszer 2: Beszélgetési blokkok keresése (általános struktúra)
    const conversationBlocks = document.querySelectorAll('div[data-test-render-count]');
    
    conversationBlocks.forEach((block) => {
        // Felhasználói üzenet keresése
        const userMsg = block.querySelector('[data-testid="user-message"]');
        if (userMsg) {
            const userText = userMsg.textContent.trim();
            if (userText && !messages.some(m => m.role === 'Felhasználó' && m.text === userText)) {
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
            const markdownContent = claudeResponse.querySelector('.standard-markdown, .progressive-markdown');
            let responseText = '';
            
            if (markdownContent) {
                responseText = domToMarkdown(markdownContent);
            } else {
                // Keresünk minden standard-markdown vagy progressive-markdown konténert
                const allMarkdown = claudeResponse.querySelectorAll('.standard-markdown, .progressive-markdown');
                if (allMarkdown.length > 0) {
                    allMarkdown.forEach(md => {
                        responseText += domToMarkdown(md) + '\n\n';
                    });
                } else {
                    // Keresünk szöveges elemeket és konvertáljuk markdown-ra
                    const textElements = claudeResponse.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, ul, ol');
                    if (textElements.length > 0) {
                        textElements.forEach(el => {
                            const converted = domToMarkdown(el);
                            if (converted.trim()) {
                                responseText += converted;
                            }
                        });
                    } else {
                        responseText = claudeResponse.textContent.trim();
                    }
                }
            }
            
            if (responseText.trim() && !messages.some(m => m.role === 'Claude' && m.text === responseText.trim())) {
                messages.push({
                    role: 'Claude',
                    text: responseText.trim(),
                    html: claudeResponse.innerHTML
                });
            }
        }
    });
    
    // Módszer 3: Ha nem találtunk blokkokat, közvetlenül keressük az üzeneteket
    if (messages.length === 0) {
        // Felhasználói üzenetek közvetlenül
        const userMessages = document.querySelectorAll('[data-testid="user-message"]');
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
        
        // Claude válaszok közvetlenül - keressük az összes font-claude-response elemet
        const claudeResponses = document.querySelectorAll('.font-claude-response');
        claudeResponses.forEach((response) => {
            const markdownContent = response.querySelector('.standard-markdown, .progressive-markdown');
            let responseText = '';
            
            if (markdownContent) {
                responseText = domToMarkdown(markdownContent);
            } else {
                // Keresünk minden szöveges elemet
                const textElements = response.querySelectorAll('p.font-claude-response-body, h1, h2, h3, h4, h5, h6, li, blockquote, .standard-markdown p, .progressive-markdown p');
                if (textElements.length > 0) {
                    textElements.forEach(el => {
                        const text = el.textContent.trim();
                        if (text) {
                            responseText += text + '\n\n';
                        }
                    });
                } else {
                    responseText = response.textContent.trim();
                }
            }
            
            if (responseText.trim()) {
                messages.push({
                    role: 'Claude',
                    text: responseText.trim(),
                    html: response.innerHTML
                });
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
                    messages.push({
                        role: 'Felhasználó',
                        text: userText,
                        html: userMsg.innerHTML
                    });
                }
            }
            
            // Claude válasz
            const claudeResponse = group.querySelector('.font-claude-response');
            if (claudeResponse) {
                const markdownContent = claudeResponse.querySelector('.standard-markdown, .progressive-markdown');
                let responseText = '';
                
                if (markdownContent) {
                    responseText = domToMarkdown(markdownContent);
                } else {
                    const textElements = claudeResponse.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
                    if (textElements.length > 0) {
                        textElements.forEach(el => {
                            const text = el.textContent.trim();
                            if (text) {
                                responseText += text + '\n\n';
                            }
                        });
                    } else {
                        responseText = claudeResponse.textContent.trim();
                    }
                }
                
                if (responseText.trim()) {
                    messages.push({
                        role: 'Claude',
                        text: responseText.trim(),
                        html: claudeResponse.innerHTML
                    });
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