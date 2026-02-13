// Background script for handling cross-origin requests

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'fetchImage') {
        handleImageFetch(request.url).then(sendResponse);
        return true; // Keep the message channel open for async response
    }
});

async function handleImageFetch(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const base64Data = await blobToBase64(blob);

        return {
            success: true,
            data: base64Data,
            mimeType: blob.type
        };
    } catch (error) {
        console.error('Image fetch error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}
