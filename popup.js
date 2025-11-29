// Popup script - Exportálási logika

const statusDiv = document.getElementById('status');

function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.className = 'status';
        }, 3000);
    }
}

// Use i18n for status messages
function showStatusI18n(key, type) {
    const message = window.i18n ? window.i18n.translate(key) : key;
    showStatus(message, type);
}

// Beszélgetés adatok lekérése
async function getConversationData() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes('chatgpt.com') && 
        !tab.url.includes('chat.openai.com') && 
        !tab.url.includes('gemini.google.com') &&
        !tab.url.includes('claude.ai')) {
        showStatusI18n('status_error', 'error');
        return null;
    }
    
    try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: "collectConversation" });
        if (!response || !response.messages || response.messages.length === 0) {
            showStatusI18n('status_error', 'error');
            return null;
        }
        return response;
    } catch (error) {
        showStatusI18n('status_error_generic', 'error');
        console.error(error);
        return null;
    }
}

// Fájlnév generálás a felhasználó által megadott névvel
function generateFilename(data, extension) {
    const customName = document.getElementById('filenameInput').value.trim();
    const addTimestamp = document.getElementById('addTimestamp').checked;
    
    let filename;
    
    if (customName) {
        // Egyedi név lett megadva
        filename = customName;
    } else {
        // Automatikus név: platform + dátum
        filename = `${data.platform?.toLowerCase() || 'ai'}_${data.date}`;
    }
    
    // Időbélyeg hozzáadása, ha be van pipálva
    if (addTimestamp) {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        filename += `_${hours}-${minutes}-${seconds}`;
    }
    
    return `${filename}.${extension}`;
}

// Markdown export
async function exportAsMarkdown() {
    showStatusI18n('status_loading', 'loading');
    
    const data = await getConversationData();
    if (!data) return;
    
    let markdown = `# Mentett ${data.platform || 'AI'} Beszélgetés\n\n**Dátum:** ${data.date}\n\n---\n\n`;
    
    data.messages.forEach(msg => {
        markdown += `### ${msg.role}\n\n${msg.text}\n\n---\n\n`;
    });
    
    const filename = generateFilename(data, 'md');
    downloadFile(markdown, filename, 'text/markdown');
    showStatusI18n('status_success', 'success');
}

// Markdown -> DOCX formázás konverter
function parseMarkdownToDocx(text) {
    const { Paragraph, TextRun, HeadingLevel } = docx;
    const elements = [];
    const lines = text.split('\n');
    let i = 0;
    
    while (i < lines.length) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // Üres sor
        if (!trimmedLine) {
            elements.push(new Paragraph({ text: "" }));
            i++;
            continue;
        }
        
        // Kódblokk kezdete
        if (trimmedLine.startsWith('```')) {
            const lang = trimmedLine.substring(3).trim();
            const codeLines = [];
            i++;
            
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            i++; // Záró ```
            
            // Kódblokk fejléc (ha van nyelv)
            if (lang) {
                elements.push(new Paragraph({
                    children: [new TextRun({ text: `Kód (${lang}):`, bold: true })],
                    spacing: { before: 200, after: 100 }
                }));
            }
            
            // Kód sorok
            codeLines.forEach(codeLine => {
                elements.push(new Paragraph({
                    children: [new TextRun({ 
                        text: codeLine,
                        font: "Courier New",
                        size: 20
                    })],
                    shading: { fill: "f5f5f5" },
                    spacing: { line: 276 }
                }));
            });
            
            elements.push(new Paragraph({ text: "" }));
            continue;
        }
        
        // Címsorok
        if (trimmedLine.startsWith('####')) {
            elements.push(new Paragraph({
                text: trimmedLine.substring(4).trim(),
                heading: HeadingLevel.HEADING_4
            }));
            i++;
            continue;
        }
        if (trimmedLine.startsWith('###')) {
            elements.push(new Paragraph({
                text: trimmedLine.substring(3).trim(),
                heading: HeadingLevel.HEADING_3
            }));
            i++;
            continue;
        }
        if (trimmedLine.startsWith('##')) {
            elements.push(new Paragraph({
                text: trimmedLine.substring(2).trim(),
                heading: HeadingLevel.HEADING_2
            }));
            i++;
            continue;
        }
        if (trimmedLine.startsWith('#')) {
            elements.push(new Paragraph({
                text: trimmedLine.substring(1).trim(),
                heading: HeadingLevel.HEADING_1
            }));
            i++;
            continue;
        }
        
        // Horizontal rule
        if (trimmedLine === '---' || trimmedLine === '___') {
            elements.push(new Paragraph({
                text: "─".repeat(50),
                spacing: { before: 200, after: 200 }
            }));
            i++;
            continue;
        }
        
        // Idézet
        if (trimmedLine.startsWith('>')) {
            const quoteText = trimmedLine.substring(1).trim();
            const runs = parseInlineMarkdown(quoteText);
            elements.push(new Paragraph({
                children: runs,
                italics: true,
                indent: { left: 720 },
                spacing: { before: 100, after: 100 }
            }));
            i++;
            continue;
        }
        
        // Lista elem (számozatlan)
        if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            const itemText = trimmedLine.substring(2).trim();
            const runs = parseInlineMarkdown(itemText);
            elements.push(new Paragraph({
                children: [
                    new TextRun({ text: "• " }),
                    ...runs
                ],
                indent: { left: 360 }
            }));
            i++;
            continue;
        }
        
        // Lista elem (számozott)
        const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
        if (numberedMatch) {
            const itemText = numberedMatch[2];
            const runs = parseInlineMarkdown(itemText);
            elements.push(new Paragraph({
                children: [
                    new TextRun({ text: `${numberedMatch[1]}. ` }),
                    ...runs
                ],
                indent: { left: 360 }
            }));
            i++;
            continue;
        }
        
        // Normál bekezdés (inline formázással)
        const runs = parseInlineMarkdown(line);
        elements.push(new Paragraph({
            children: runs,
            spacing: { after: 100 }
        }));
        i++;
    }
    
    return elements;
}

// Inline Markdown elemek feldolgozása (félkövér, dőlt, kód)
function parseInlineMarkdown(text) {
    const { TextRun } = docx;
    const runs = [];
    
    // Regex minták FONTOS SORREND: leghosszabbtól a legrövidebbig!
    const patterns = [
        { regex: /\*\*\*(.+?)\*\*\*/g, bold: true, italics: true, marker: '***' },  // ***félkövér és dőlt***
        { regex: /__(.+?)__/g, bold: true, marker: '__' },                           // __félkövér__
        { regex: /\*\*(.+?)\*\*/g, bold: true, marker: '**' },                       // **félkövér**
        { regex: /_(.+?)_/g, italics: true, marker: '_' },                           // _dőlt_
        { regex: /\*(.+?)\*/g, italics: true, marker: '*' },                         // *dőlt*
        { regex: /`(.+?)`/g, font: "Courier New", shading: true, marker: '`' }       // `kód`
    ];
    
    // Találjuk meg az összes formázott szakaszt
    const matches = [];
    patterns.forEach(pattern => {
        let match;
        const regex = new RegExp(pattern.regex);
        while ((match = regex.exec(text)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                text: match[1],
                fullMatch: match[0],
                options: pattern
            });
        }
    });
    
    // Ha nincs formázás, egyszerű szöveg
    if (matches.length === 0) {
        return [new TextRun({ text: text })];
    }
    
    // Rendezés: először pozíció szerint, majd hossz szerint (leghosszabb először)
    matches.sort((a, b) => {
        if (a.start !== b.start) {
            return a.start - b.start;
        }
        return (b.end - b.start) - (a.end - a.start);
    });
    
    // Átfedő matchek kiszűrése - csak a leghosszabbat/külsőt tartjuk meg
    const filteredMatches = [];
    const usedRanges = [];
    
    matches.forEach(match => {
        // Ellenőrizzük, hogy átfed-e már használt szakasszal
        const overlaps = usedRanges.some(range => 
            (match.start >= range.start && match.start < range.end) ||
            (match.end > range.start && match.end <= range.end) ||
            (match.start <= range.start && match.end >= range.end)
        );
        
        if (!overlaps) {
            filteredMatches.push(match);
            usedRanges.push({ start: match.start, end: match.end });
        }
    });
    
    // Rendezés pozíció szerint
    filteredMatches.sort((a, b) => a.start - b.start);
    
    // Szöveg feldarabolása formázott részekkel
    let lastEnd = 0;
    filteredMatches.forEach(match => {
        // Szöveg a formázás előtt
        if (match.start > lastEnd) {
            const plainText = text.substring(lastEnd, match.start);
            if (plainText) {
                runs.push(new TextRun({ text: plainText }));
            }
        }
        
        // Formázott szöveg
        const runOptions = { text: match.text };
        if (match.options.bold) runOptions.bold = true;
        if (match.options.italics) runOptions.italics = true;
        if (match.options.font) {
            runOptions.font = match.options.font;
            runOptions.size = 20;
        }
        if (match.options.shading) {
            runOptions.shading = { fill: "f0f0f0" };
        }
        
        runs.push(new TextRun(runOptions));
        lastEnd = match.end;
    });
    
    // Maradék szöveg
    if (lastEnd < text.length) {
        runs.push(new TextRun({ text: text.substring(lastEnd) }));
    }
    
    return runs;
}

// DOCX export (docx könyvtár használatával)
async function exportAsDocx() {
    showStatusI18n('status_loading', 'loading');
    
    const data = await getConversationData();
    if (!data) return;
    
    try {
        const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = docx;
        
        const children = [
            new Paragraph({
                text: `${data.platform || 'AI'} Beszélgetés`,
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
                text: `Dátum: ${data.date}`,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 }
            }),
        ];
        
        data.messages.forEach(msg => {
            // Szerepkör
            children.push(
                new Paragraph({
                    text: msg.role,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 300, after: 200 }
                })
            );
            
            // Üzenet szöveg - Markdown -> DOCX konverzió
            const parsedElements = parseMarkdownToDocx(msg.text);
            children.push(...parsedElements);
            
            // Elválasztó
            children.push(
                new Paragraph({ 
                    text: "─".repeat(50),
                    spacing: { before: 200, after: 200 }
                })
            );
        });
        
        const doc = new Document({
            sections: [{
                properties: {},
                children: children,
            }],
        });
        
        const filename = generateFilename(data, 'docx');
        
        Packer.toBlob(doc).then(blob => {
            downloadBlob(blob, filename);
            showStatusI18n('status_success', 'success');
        });
    } catch (error) {
        showStatusI18n('status_error_generic', 'error');
        console.error(error);
    }
}

// Fájl letöltés helper függvények
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

// Event listeners
document.getElementById('exportMd').addEventListener('click', exportAsMarkdown);
document.getElementById('exportDocx').addEventListener('click', exportAsDocx);

// Tab switching
const tabNav = document.getElementById('tabNav');
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        
        // Remove active class from all tabs and buttons
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab
        button.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Update tab nav indicator
        if (tabName === 'about') {
            tabNav.classList.add('about-active');
        } else {
            tabNav.classList.remove('about-active');
        }
    });
});
