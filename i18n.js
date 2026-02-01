// i18n.js - Internationalization
const translations = {
    en: {
        // Tabs
        tab_export: 'Export',
        tab_workflow: 'Workflow',
        tab_about: 'About',
        
        // Export tab
        title: 'ChatGPT, Gemini & Claude',
        subtitle: 'Conversation Saver Extension',
        info_text: 'Choose the export format',
        filename_label: 'Filename',
        filename_placeholder: 'Auto-generated with date',
        timestamp_label: 'Add timestamp (HH-MM-SS)',
        btn_markdown: 'Save as Markdown',
        btn_docx: 'Save as DOCX',
        
        // About tab
        about_title: 'ChatGPT, Gemini & Claude Saver',
        features_title: 'Features',
        feature_1: 'Markdown & DOCX export',
        feature_2: 'ChatGPT, Gemini & Claude support',
        feature_3: 'Custom filenames',
        feature_4: 'Timestamp option',
        feature_5: 'Real Word formatting',
        feature_6: 'Mermaid workflow diagrams',
        support_title: 'Support',
        coffee_btn: 'Buy me a coffee',
        
        // Status messages
        status_loading: 'Loading conversation...',
        status_success: 'File saved successfully!',
        status_error: 'Error: No conversation found',
        status_error_generic: 'An error occurred',
        
        // Workflow tab
        workflow_title: 'Mermaid Workflow',
        workflow_subtitle: 'Create and visualize workflow diagrams',
        workflow_code_label: 'Mermaid Code',
        workflow_code_placeholder: 'Enter Mermaid diagram code here...',
        workflow_preview_placeholder: 'Preview will appear here...',
        workflow_examples_title: 'Examples',
        btn_export_svg: 'Export SVG',
        btn_export_png: 'Export PNG',
        btn_open_live: 'Open in Mermaid Live',
        workflow_error_empty: 'Please enter Mermaid code',
        workflow_error_render: 'Error rendering diagram',
        workflow_export_success: 'Diagram exported successfully!',
        example_flowchart: 'Flowchart',
        example_sequence: 'Sequence Diagram',
        example_gantt: 'Gantt Chart',
        example_class: 'Class Diagram'
    },
    hu: {
        // Tabok
        tab_export: 'Export',
        tab_workflow: 'Workflow',
        tab_about: 'Rólam',
        
        // Export tab
        title: 'ChatGPT, Gemini és Claude',
        subtitle: 'Beszélgetés mentő bővítmény',
        info_text: 'Válaszd ki a mentési formátumot',
        filename_label: 'Fájlnév',
        filename_placeholder: 'Automatikus név dátummal',
        timestamp_label: 'Időbélyeg hozzáadása (ÓÓ-PP-MM)',
        btn_markdown: 'Mentés Markdown-ként',
        btn_docx: 'Mentés DOCX-ként',
        
        // About tab
        about_title: 'ChatGPT, Gemini és Claude Mentő',
        features_title: 'Funkciók',
        feature_1: 'Markdown & DOCX export',
        feature_2: 'ChatGPT, Gemini és Claude támogatás',
        feature_3: 'Egyedi fájlnevek',
        feature_4: 'Időbélyeg opció',
        feature_5: 'Valódi Word formázás',
        feature_6: 'Mermaid workflow diagramok',
        support_title: 'Támogatás',
        coffee_btn: 'Vegyél egy kávét',
        
        // Státusz üzenetek
        status_loading: 'Beszélgetés betöltése...',
        status_success: 'Fájl sikeresen mentve!',
        status_error: 'Hiba: Nem találtam beszélgetést',
        status_error_generic: 'Hiba történt',
        
        // Workflow tab
        workflow_title: 'Mermaid Workflow',
        workflow_subtitle: 'Munkafolyamat diagramok létrehozása és megjelenítése',
        workflow_code_label: 'Mermaid Kód',
        workflow_code_placeholder: 'Írd be a Mermaid diagram kódját...',
        workflow_preview_placeholder: 'Az előnézet itt jelenik meg...',
        workflow_examples_title: 'Példák',
        btn_export_svg: 'SVG exportálás',
        btn_export_png: 'PNG exportálás',
        btn_open_live: 'Megnyitás Mermaid Live-ban',
        workflow_error_empty: 'Kérlek add meg a Mermaid kódot',
        workflow_error_render: 'Hiba a diagram renderelésekor',
        workflow_export_success: 'Diagram sikeresen exportálva!',
        example_flowchart: 'Folyamatábra',
        example_sequence: 'Szekvencia diagram',
        example_gantt: 'Gantt diagram',
        example_class: 'Osztály diagram'
    }
};

// Detect browser language
function detectLanguage() {
    // First check if user has saved preference
    const savedLang = localStorage.getItem('selectedLanguage');
    if (savedLang) {
        return savedLang;
    }
    
    // Otherwise detect from browser
    const browserLang = navigator.language || navigator.userLanguage;
    
    // Check if Hungarian
    if (browserLang.startsWith('hu')) {
        return 'hu';
    }
    
    // Default to English
    return 'en';
}

// Save language preference
function saveLanguage(lang) {
    localStorage.setItem('selectedLanguage', lang);
}

// Apply translations
function applyTranslations(lang) {
    const t = translations[lang] || translations.en;
    
    // Update all elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (t[key]) {
            element.textContent = t[key];
        }
    });
    
    // Update placeholder attributes
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (t[key]) {
            element.placeholder = t[key];
        }
    });
    
    // Update HTML lang attribute
    document.documentElement.lang = lang;
    
    // Update language selector
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        langSelect.value = lang;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    const language = detectLanguage();
    applyTranslations(language);
    
    // Store language for use in popup.js
    window.currentLanguage = language;
    
    // Add event listener to language selector
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            saveLanguage(newLang);
            window.currentLanguage = newLang;
            applyTranslations(newLang);
        });
    }
});

// Export for use in other scripts
window.i18n = {
    getCurrentLanguage: () => window.currentLanguage || 'en',
    translate: (key) => {
        const lang = window.currentLanguage || 'en';
        return translations[lang][key] || translations.en[key] || key;
    }
};

