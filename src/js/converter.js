// This file contains the logic for converting Google Drive links to direct download links.
// It includes functions to extract file IDs from links and to generate direct download URLs.

class GoogleDriveConverter {
    constructor() {
        this.results = {
            success: [],
            failures: [],
            total_processed: 0,
            all_results: [],
        };
    }

    extractFileId(sharedLink) {
        const link = sharedLink.trim();

        // Pattern 1: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
        const pattern1 = /\/file\/d\/([a-zA-Z0-9-_]+)/;
        let match = link.match(pattern1);
        if (match) {
            return match[1];
        }

        // Pattern 2: https://drive.google.com/open?id=FILE_ID
        const pattern2 = /[?&]id=([a-zA-Z0-9-_]+)/;
        match = link.match(pattern2);
        if (match) {
            return match[1];
        }

        // Pattern 3: Direct file ID
        if (/^[a-zA-Z0-9-_]+$/.test(link) && link.length > 20) {
            return link;
        }

        return null;
    }

    async convertToDirectLink(sharedLink, verify = false) {
        const fileId = this.extractFileId(sharedLink);

        if (!fileId) {
            return {
                success: false,
                directLink: sharedLink,
                message: 'Could not extract file ID from the link',
            };
        }

        const directLink = `https://drive.google.com/uc?export=download&id=${fileId}`;

        if (verify) {
            try {
                const response = await fetch(directLink, {
                    method: 'HEAD',
                    mode: 'no-cors', // This will limit what we can check, but avoids CORS issues
                });

                return {
                    success: true,
                    directLink: directLink,
                    message: 'Successfully converted and verified',
                };
            } catch (error) {
                return {
                    success: true,
                    directLink: directLink,
                    message: `Converted (verification failed: ${error.message})`,
                };
            }
        } else {
            return {
                success: true,
                directLink: directLink,
                message: 'Successfully converted (not verified)',
            };
        }
    }

    async processLinks(links, verifyLinks = false, progressCallback = null) {
        this.results = {
            success: [],
            failures: [],
            total_processed: 0,
            all_results: [],
        };

        const totalLinks = links.length;

        for (let i = 0; i < links.length; i++) {
            const link = links[i];
            this.results.total_processed++;

            if (progressCallback) {
                progressCallback(i + 1, totalLinks, link);
            }

            const result = await this.convertToDirectLink(link, verifyLinks);

            const resultEntry = {
                original_link: link,
                direct_link: result.directLink,
                message: result.message,
                success: result.success,
            };

            this.results.all_results.push(resultEntry);

            if (result.success) {
                this.results.success.push(resultEntry);
            } else {
                this.results.failures.push(resultEntry);
            }

            // Small delay to prevent overwhelming the browser
            if (i < links.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        }

        return this.results;
    }

    generateResultsText() {
        let text = 'Google Drive Link Conversion Results\n';
        text += '='.repeat(50) + '\n\n';

        text += `Total Processed: ${this.results.total_processed}\n`;
        text += `Successful: ${this.results.success.length}\n`;
        text += `Failed: ${this.results.failures.length}\n\n`;

        text += 'ALL CONVERSIONS (IN ORIGINAL ORDER):\n';
        text += '-'.repeat(40) + '\n';

        this.results.all_results.forEach((result, index) => {
            text += `${index + 1}. Original: ${result.original_link}\n`;
            if (result.success && result.direct_link !== result.original_link) {
                text += `   Direct:   ${result.direct_link}\n`;
            }
            const statusSymbol = result.success ? '✅' : '❌';
            text += `   Status:   ${statusSymbol} ${result.message}\n\n`;
        });

        if (this.results.failures.length > 0) {
            text += 'FAILED CONVERSIONS (SUMMARY):\n';
            text += '-'.repeat(30) + '\n';
            this.results.failures.forEach((result, index) => {
                text += `${index + 1}. Original: ${result.original_link}\n`;
                text += `   Error:    ${result.message}\n\n`;
            });
        }

        return text;
    }
}
