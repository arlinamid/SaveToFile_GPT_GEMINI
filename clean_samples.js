const fs = require('fs');
const path = require('path');

const filesToClean = ['sample.html', 'sample2.html'];
const targetDir = 'd:\\tool\\SaveToFile_GPT_GEMINI';

function cleanHtml(html) {
    let cleaned = html;
    // Remove scripts
    cleaned = cleaned.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
    // Remove styles
    cleaned = cleaned.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, "");
    // Remove SVGs
    cleaned = cleaned.replace(/<svg\b[^>]*>([\s\S]*?)<\/svg>/gim, "");
    // Remove links
    cleaned = cleaned.replace(/<link\b[^>]*>/gim, "");
    // Remove meta
    cleaned = cleaned.replace(/<meta\b[^>]*>/gim, "");
    // Remove comments
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/gim, "");
    // Remove empty lines left over
    cleaned = cleaned.replace(/^\s*[\r\n]/gm, "");

    return cleaned;
}

filesToClean.forEach(file => {
    const inputPath = path.join(targetDir, file);
    const outputPath = path.join(targetDir, file.replace('.html', '_clean.html'));

    if (fs.existsSync(inputPath)) {
        try {
            const content = fs.readFileSync(inputPath, 'utf8');
            const cleanedContent = cleanHtml(content);
            fs.writeFileSync(outputPath, cleanedContent);
            console.log(`Successfully created ${outputPath}`);
        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    } else {
        console.log(`File not found: ${inputPath}`);
    }
});
