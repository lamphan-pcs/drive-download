function isValidLink(link) {
    // More comprehensive regex to match the Python patterns
    const patterns = [
        /drive\.google\.com\/file\/d\/[a-zA-Z0-9-_]+/,
        /drive\.google\.com\/open\?id=[a-zA-Z0-9-_]+/,
        /^[a-zA-Z0-9-_]+$/ // Direct file ID
    ];
    
    return patterns.some(pattern => pattern.test(link.trim()));
}

function clearAllLinks() {
    const inputField = document.getElementById('links-input');
    const resultsSection = document.getElementById('results-section');
    const downloadBtn = document.getElementById('download-btn');
    
    inputField.value = '';
    resultsSection.style.display = 'none';
    downloadBtn.disabled = true;
    
    // Clear any stored results
    window.conversionResults = null;
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Could add a temporary success message here
        console.log('Copied to clipboard:', text);
    }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
    });
}

function downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function formatDateTime() {
    const now = new Date();
    return now.toLocaleString();
}