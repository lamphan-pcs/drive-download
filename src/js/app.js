// This is the entry point for the JavaScript application.
// It handles user interactions, such as submitting links for conversion and clearing the input fields.
// It also manages the display of results.

document.addEventListener('DOMContentLoaded', () => {
    const linkInput = document.getElementById('linkInput');
    const convertButton = document.getElementById('convertButton');
    const clearButton = document.getElementById('clearButton');
    const resultsContainer = document.getElementById('resultsContainer');

    convertButton.addEventListener('click', () => {
        const link = linkInput.value.trim();
        if (link) {
            convertLink(link);
        } else {
            alert('Please enter a link to convert.');
        }
    });

    clearButton.addEventListener('click', () => {
        linkInput.value = '';
        resultsContainer.innerHTML = '';
    });

    function convertLink(link) {
        // Call the converter function from converter.js
        // Assuming convertToDirectLink is a function defined in converter.js
        convertToDirectLink(link)
            .then((result) => {
                displayResult(result);
            })
            .catch((error) => {
                displayError(error);
            });
    }

    function displayResult(result) {
        const resultElement = document.createElement('div');
        resultElement.className = 'result';
        resultElement.innerHTML = `
            <p><strong>Original Link:</strong> ${result.originalLink}</p>
            <p><strong>Direct Link:</strong> <a href="${result.directLink}" target="_blank">${result.directLink}</a></p>
            <p><strong>Status:</strong> ${result.success ? '✅ Success' : '❌ Failed'}</p>
            <p>${result.message}</p>
        `;
        resultsContainer.appendChild(resultElement);
    }

    function displayError(error) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error';
        errorElement.innerHTML = `<p>Error: ${error.message}</p>`;
        resultsContainer.appendChild(errorElement);
    }
});

let converter = new GoogleDriveConverter();
let conversionResults = null;

function clearAll() {
    clearAllLinks();
}

async function convertLinks() {
    const inputField = document.getElementById('links-input');
    const verifyCheckbox = document.getElementById('verify-links');
    const resultsSection = document.getElementById('results-section');
    const convertBtn = document.getElementById('convert-btn');
    const downloadBtn = document.getElementById('download-btn');

    const inputText = inputField.value.trim();

    if (!inputText) {
        alert('Please paste some Google Drive links first!');
        return;
    }

    // Parse links from input
    const links = inputText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (links.length === 0) {
        alert('No valid links found!');
        return;
    }

    // Disable convert button and show processing state
    convertBtn.disabled = true;
    convertBtn.textContent = 'Converting...';
    downloadBtn.disabled = true;

    // Show results section with processing indicator
    resultsSection.style.display = 'block';
    document.getElementById('summary').innerHTML = `
        <div class="processing">
            <div class="spinner"></div>
            Processing ${links.length} links...
        </div>
    `;
    document.getElementById('results-container').innerHTML = '';

    try {
        const verifyLinks = verifyCheckbox.checked;

        // Process links with progress updates
        conversionResults = await converter.processLinks(
            links,
            verifyLinks,
            (current, total, currentLink) => {
                document.getElementById('summary').innerHTML = `
                <div class="processing">
                    <div class="spinner"></div>
                    Processing ${current} of ${total} links...<br>
                    <small style="word-break: break-all;">${currentLink.substring(0, 40)}${currentLink.length > 40 ? '...' : ''}</small>
                </div>
            `;
            }
        );

        displayResults(conversionResults);
        downloadBtn.disabled = false;
    } catch (error) {
        console.error('Error during conversion:', error);
        document.getElementById('summary').innerHTML = `
            <div style="color: red; text-align: center;">
                ❌ Error during conversion: ${error.message}
            </div>
        `;
    } finally {
        // Re-enable convert button
        convertBtn.disabled = false;
        convertBtn.textContent = 'Convert Links';
    }
}

function openAllDirectLinks() {
    if (!conversionResults || conversionResults.success.length === 0) {
        alert('No successful conversions to open!');
        return;
    }

    const successfulResults = conversionResults.all_results.filter(
        (result) => result.success && result.direct_link !== result.original_link
    );

    if (successfulResults.length === 0) {
        alert('No direct download links available!');
        return;
    }

    // Debug: Log what we're trying to open
    console.log(
        'Opening links:',
        successfulResults.map((r) => r.direct_link)
    );

    // Ask user permission for multiple tabs (helps with popup blocking)
    const confirmed = confirm(`This will open ${successfulResults.length} new tabs. Continue?`);
    if (!confirmed) return;

    // Open ALL links in new tabs immediately (no delay needed if user confirmed)
    successfulResults.forEach((result, index) => {
        try {
            const newWindow = window.open(result.direct_link, '_blank', 'noopener,noreferrer');
            if (!newWindow) {
                console.warn(`Failed to open tab ${index + 1}: ${result.direct_link}`);
            }
        } catch (error) {
            console.error(`Error opening tab ${index + 1}:`, error);
        }
    });

    // Show success message
    alert(`Attempted to open ${successfulResults.length} direct download links in new tabs!`);
}

function openAllDirectLinksExceptFirst() {
    if (!conversionResults || conversionResults.success.length === 0) {
        alert('No successful conversions to open!');
        return;
    }

    const successfulResults = conversionResults.all_results.filter(
        (result) => result.success && result.direct_link !== result.original_link
    );

    if (successfulResults.length <= 1) {
        alert('Need at least 2 direct download links!');
        return;
    }

    // Get all links except the first one
    const linksToOpen = successfulResults.slice(1);

    console.log(
        'Opening links (except first):',
        linksToOpen.map((r) => r.direct_link)
    );

    // Ask user permission for multiple tabs
    const confirmed = confirm(
        `This will open ${linksToOpen.length} new tabs (excluding the first link). Continue?`
    );
    if (!confirmed) return;

    // Open all links EXCEPT the first in new tabs
    linksToOpen.forEach((result, index) => {
        try {
            const newWindow = window.open(result.direct_link, '_blank', 'noopener,noreferrer');
            if (!newWindow) {
                console.warn(`Failed to open tab ${index + 2}: ${result.direct_link}`); // index+2 because we're skipping first
            }
        } catch (error) {
            console.error(`Error opening tab ${index + 2}:`, error);
        }
    });

    // Show success message
    alert(
        `Opened ${linksToOpen.length} direct download links in new tabs! (First link was skipped)`
    );
}

function displayResults(results) {
    const summaryDiv = document.getElementById('summary');
    const resultsContainer = document.getElementById('results-container');

    // Display summary
    const successRate =
        results.total_processed > 0
            ? ((results.success.length / results.total_processed) * 100).toFixed(1)
            : 0;

    const successfulDirectLinks = results.all_results.filter(
        (result) => result.success && result.direct_link !== result.original_link
    ).length;

    summaryDiv.innerHTML = `
        <div class="summary-stats">
            <div class="stat">
                <div class="stat-number">${results.total_processed}</div>
                <div class="stat-label">Total</div>
            </div>
            <div class="stat">
                <div class="stat-number" style="color: #28a745;">${results.success.length}</div>
                <div class="stat-label">Success</div>
            </div>
            <div class="stat">
                <div class="stat-number" style="color: #dc3545;">${results.failures.length}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat">
                <div class="stat-number" style="color: #007bff;">${successRate}%</div>
                <div class="stat-label">Rate</div>
            </div>
        </div>
        ${
            successfulDirectLinks > 0
                ? `
            <div style="margin-top: 10px; text-align: center; display: flex; gap: 8px; justify-content: center;">
                <button onclick="openAllDirectLinks()" style="background: #17a2b8; color: white; padding: 6px 12px; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">
                    Open All Links (${successfulDirectLinks})
                </button>
                ${
                    successfulDirectLinks > 1
                        ? `
                <button onclick="openAllDirectLinksExceptFirst()" style="background: #6610f2; color: white; padding: 6px 12px; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">
                    Open All Except First (${successfulDirectLinks - 1})
                </button>
                `
                        : ''
                }
            </div>
        `
                : ''
        }
    `;

    // Display individual results
    resultsContainer.innerHTML = '';

    results.all_results.forEach((result, index) => {
        const resultDiv = document.createElement('div');
        resultDiv.className = `result-item ${result.success ? 'success' : 'failed'}`;

        const statusIcon = result.success ? '✅' : '❌';

        // Make links clickable
        const originalLinkHTML = `<a href="${result.original_link}" target="_blank" rel="noopener">${result.original_link}</a>`;
        const directLinkHTML =
            result.success && result.direct_link !== result.original_link
                ? `<a href="${result.direct_link}" target="_blank" rel="noopener">${result.direct_link}</a>`
                : result.direct_link;

        resultDiv.innerHTML = `
            <div class="result-header">
                <span class="status-icon">${statusIcon}</span>
                <strong>${index + 1}. ${result.message}</strong>
            </div>
            
            <div class="result-links">
                <div class="link-row">
                    <div class="link-label">Original:</div>
                    <div class="link-value">
                        <div class="link-text">${originalLinkHTML}</div>
                        <button class="copy-btn" onclick="copyToClipboard('${result.original_link.replace(/'/g, "\\'")}')">Copy</button>
                    </div>
                </div>
                
                ${
                    result.success && result.direct_link !== result.original_link
                        ? `
                    <div class="link-row">
                        <div class="link-label">Direct:</div>
                        <div class="link-value">
                            <div class="link-text">${directLinkHTML}</div>
                            <button class="copy-btn" onclick="copyToClipboard('${result.direct_link.replace(/'/g, "\\'")}')">Copy</button>
                        </div>
                    </div>
                `
                        : ''
                }
            </div>
        `;

        resultsContainer.appendChild(resultDiv);
    });
}

function downloadResults() {
    if (!conversionResults) {
        alert('No results to download!');
        return;
    }

    const content = converter.generateResultsText();
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const filename = `google-drive-links-${timestamp}.txt`;

    downloadTextFile(content, filename);
}

// Initialize page
document.addEventListener('DOMContentLoaded', function () {
    // Add sample links for testing
    const sampleBtn = document.createElement('button');
    sampleBtn.textContent = 'Sample';
    sampleBtn.style.background = '#6c757d';
    sampleBtn.style.color = 'white';
    sampleBtn.onclick = () => {
        document.getElementById('links-input').value =
            `https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing
https://drive.google.com/open?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
https://drive.google.com/file/d/1ABC123def456/view`;
    };

    document.querySelector('.button-group').appendChild(sampleBtn);
});
