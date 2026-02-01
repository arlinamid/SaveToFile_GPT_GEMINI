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
        !tab.url.includes('claude.ai') &&
        !tab.url.includes('grok.com')) {
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

        // Címsorok - inline formázással (bold, italic, stb.)
        if (trimmedLine.startsWith('####')) {
            const headingText = trimmedLine.substring(4).trim();
            const runs = parseInlineMarkdown(headingText);
            elements.push(new Paragraph({
                children: runs,
                heading: HeadingLevel.HEADING_4
            }));
            i++;
            continue;
        }
        if (trimmedLine.startsWith('###')) {
            const headingText = trimmedLine.substring(3).trim();
            const runs = parseInlineMarkdown(headingText);
            elements.push(new Paragraph({
                children: runs,
                heading: HeadingLevel.HEADING_3
            }));
            i++;
            continue;
        }
        if (trimmedLine.startsWith('##')) {
            const headingText = trimmedLine.substring(2).trim();
            const runs = parseInlineMarkdown(headingText);
            elements.push(new Paragraph({
                children: runs,
                heading: HeadingLevel.HEADING_2
            }));
            i++;
            continue;
        }
        if (trimmedLine.startsWith('#')) {
            const headingText = trimmedLine.substring(1).trim();
            const runs = parseInlineMarkdown(headingText);
            elements.push(new Paragraph({
                children: runs,
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

        // Remove all tab nav indicator classes
        tabNav.classList.remove('workflow-active', 'about-active');

        // Add active class to clicked tab
        button.classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Update tab nav indicator
        if (tabName === 'workflow') {
            tabNav.classList.add('workflow-active');
        } else if (tabName === 'about') {
            tabNav.classList.add('about-active');
        }

        // If workflow tab, initialize Mermaid
        if (tabName === 'workflow') {
            initializeMermaid();
        }
    });
});

// Mermaid initialization and rendering
let mermaidInitialized = false;
let currentMermaidId = 0;

function initializeMermaid() {
    if (!window.mermaid) {
        console.warn('Mermaid library not loaded');
        return;
    }

    if (!mermaidInitialized) {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        mermaid.initialize({
            startOnLoad: false,
            theme: isDark ? 'dark' : 'default',
            securityLevel: 'loose',
            themeVariables: isDark ? {
                primaryColor: '#6366f1',
                primaryTextColor: '#f1f5f9',
                primaryBorderColor: '#818cf8',
                lineColor: '#cbd5e1',
                secondaryColor: '#8b5cf6',
                tertiaryColor: '#1e293b'
            } : {}
        });
        mermaidInitialized = true;
    }

    // Render initial preview if there's code
    const codeInput = document.getElementById('mermaidCode');
    if (codeInput) {
        const code = codeInput.value.trim();
        if (code) {
            renderMermaid(code);
        }
    }
}

async function renderMermaid(code) {
    const preview = document.getElementById('mermaidPreview');

    if (!code.trim()) {
        const placeholder = window.i18n ? window.i18n.translate('workflow_preview_placeholder') : 'Preview will appear here...';
        preview.innerHTML = `<div>${placeholder}</div>`;
        preview.classList.remove('error');
        return;
    }

    if (!window.mermaid || !mermaidInitialized) {
        preview.classList.add('error');
        preview.innerHTML = '<div>Mermaid library not loaded. Please refresh the extension.</div>';
        return;
    }

    preview.classList.remove('error');
    preview.innerHTML = '<div style="text-align: center; color: var(--text-secondary);">Rendering...</div>';

    try {
        currentMermaidId++;
        const id = `mermaid-${currentMermaidId}`;
        const container = document.createElement('div');
        container.className = 'mermaid';
        container.id = id;
        container.textContent = code;
        preview.innerHTML = '';
        preview.appendChild(container);

        // Try mermaid.run() for v10+ first, fallback to render() for older versions
        if (typeof mermaid.run === 'function') {
            await mermaid.run({
                nodes: [container]
            });
        } else if (typeof mermaid.render === 'function') {
            const result = await mermaid.render(id, code);
            container.innerHTML = result.svg;
        } else {
            throw new Error('Mermaid API not available');
        }
    } catch (error) {
        console.error('Mermaid error:', error);
        preview.classList.add('error');
        const errorMsg = error.message || error.toString() || 'Invalid Mermaid syntax';
        preview.innerHTML = `<div>Error: ${errorMsg}</div>`;
    }
}

// Mermaid code editor event listener
const mermaidCodeInput = document.getElementById('mermaidCode');
if (mermaidCodeInput) {
    let renderTimeout;
    mermaidCodeInput.addEventListener('input', () => {
        clearTimeout(renderTimeout);
        renderTimeout = setTimeout(() => {
            const code = mermaidCodeInput.value.trim();
            renderMermaid(code);
        }, 500); // Debounce rendering
    });
}

// Export SVG
document.getElementById('exportSvg')?.addEventListener('click', async () => {
    const code = mermaidCodeInput.value.trim();
    if (!code) {
        showStatusI18n('workflow_error_empty', 'error');
        return;
    }

    if (!window.mermaid) {
        showStatusI18n('workflow_error_render', 'error');
        return;
    }

    try {
        // Create a temporary element for rendering
        const tempDiv = document.createElement('div');
        tempDiv.className = 'mermaid';
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        let svg;

        // Try mermaid.run() for v10+ first, fallback to render() for older versions
        if (typeof mermaid.run === 'function') {
            tempDiv.textContent = code;
            await mermaid.run({
                nodes: [tempDiv]
            });
            svg = tempDiv.querySelector('svg');
        } else if (typeof mermaid.render === 'function') {
            const id = `mermaid-export-${Date.now()}`;
            const result = await mermaid.render(id, code);
            const parser = new DOMParser();
            const doc = parser.parseFromString(result.svg, 'image/svg+xml');
            svg = doc.querySelector('svg');
        } else {
            throw new Error('Mermaid API not available');
        }

        if (svg) {
            const svgString = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `mermaid-diagram-${Date.now()}.svg`;
            link.click();
            URL.revokeObjectURL(url);
            showStatusI18n('workflow_export_success', 'success');
        } else {
            showStatusI18n('workflow_error_render', 'error');
        }

        document.body.removeChild(tempDiv);
    } catch (error) {
        showStatusI18n('workflow_error_render', 'error');
        console.error(error);
    }
});

// Export PNG
document.getElementById('exportPng')?.addEventListener('click', async () => {
    const code = mermaidCodeInput.value.trim();
    if (!code) {
        showStatusI18n('workflow_error_empty', 'error');
        return;
    }

    if (!window.mermaid) {
        showStatusI18n('workflow_error_render', 'error');
        return;
    }

    try {
        // Create a temporary element for rendering
        const tempDiv = document.createElement('div');
        tempDiv.className = 'mermaid';
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        let svg;

        // Try mermaid.run() for v10+ first, fallback to render() for older versions
        if (typeof mermaid.run === 'function') {
            tempDiv.textContent = code;
            await mermaid.run({
                nodes: [tempDiv]
            });
            svg = tempDiv.querySelector('svg');
        } else if (typeof mermaid.render === 'function') {
            const id = `mermaid-export-${Date.now()}`;
            const result = await mermaid.render(id, code);
            const parser = new DOMParser();
            const doc = parser.parseFromString(result.svg, 'image/svg+xml');
            svg = doc.querySelector('svg');
        } else {
            throw new Error('Mermaid API not available');
        }

        if (svg) {
            const svgString = new XMLSerializer().serializeToString(svg);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width || 800;
                canvas.height = img.height || 600;
                const ctx = canvas.getContext('2d');

                // White background for PNG
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.drawImage(img, 0, 0);

                canvas.toBlob((blob) => {
                    const downloadUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = downloadUrl;
                    link.download = `mermaid-diagram-${Date.now()}.png`;
                    link.click();
                    URL.revokeObjectURL(downloadUrl);
                    URL.revokeObjectURL(url);
                    showStatusI18n('workflow_export_success', 'success');
                }, 'image/png');
            };

            img.onerror = () => {
                showStatusI18n('workflow_error_render', 'error');
                URL.revokeObjectURL(url);
            };

            img.src = url;
        } else {
            showStatusI18n('workflow_error_render', 'error');
        }

        document.body.removeChild(tempDiv);
    } catch (error) {
        showStatusI18n('workflow_error_render', 'error');
        console.error(error);
    }
});

// Open in Mermaid Live
document.getElementById('openMermaidLive')?.addEventListener('click', () => {
    const code = mermaidCodeInput.value.trim();
    // Mermaid Live uses base64 encoded code in the URL
    try {
        const encoded = btoa(unescape(encodeURIComponent(code)));
        const url = `https://mermaid.live/edit#pako:${encoded}`;
        chrome.tabs.create({ url: url });
    } catch (error) {
        console.error('Error encoding for Mermaid Live:', error);
        // Fallback: just open Mermaid Live
        chrome.tabs.create({ url: 'https://mermaid.live' });
    }
});

// Example buttons
document.querySelectorAll('.example-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const example = btn.getAttribute('data-example');
        let code = '';

        switch (example) {
            case 'flowchart':
                code = `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`;
                break;
            case 'sequence':
                code = `sequenceDiagram
    participant A as User
    participant B as System
    A->>B: Request
    B-->>A: Response`;
                break;
            case 'gantt':
                code = `gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    section Phase 1
    Task 1 :a1, 2024-01-01, 30d
    Task 2 :a2, after a1, 20d
    section Phase 2
    Task 3 :a3, after a2, 15d`;
                break;
            case 'class':
                code = `classDiagram
    class Animal {
        +String name
        +int age
        +eat()
        +sleep()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog`;
                break;
        }

        mermaidCodeInput.value = code;
        renderMermaid(code);
    });
});
