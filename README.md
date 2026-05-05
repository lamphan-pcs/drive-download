# Google Drive Bulk Downloader

This tool allows you to paste a list of filenames and a list of Google Drive links to download files in bulk, renaming them automatically.

## Prerequisites

1.  **Python** installed.
2.  **Dependencies** installed:
    ```bash
    pip install -r requirements.txt
    ```

## Setup (One-time only)

You need to create a Google Cloud Project to get a `credentials.json` file.

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a **New Project**.
3.  Search for **"Google Drive API"** and **Enable** it.
4.  Go to **Credentials** -> **Create Credentials** -> **OAuth client ID**.
    *   *Note: If it asks you to configure the "OAuth consent screen", choose **External**, give it a name (e.g., "Downloader"), and add your email as a "Test User".*
5.  Application type: **Desktop app**.
6.  Click **Create**, then **Download JSON**.
7.  Rename the downloaded file to **`credentials.json`** and place it in this folder.

## How to Use

1.  Run the script:
    ```bash
    python download_files.py
    ```
2.  Follow the prompts:
    *   **First Paste**: Copy your column of **New Filenames** from Excel and paste it into the terminal. Type `END` on a new line.
    *   **Second Paste**: Copy your column of **Google Drive Links** and paste it. Type `END` on a new line.
3.  A browser window will open asking you to log in to Google. Allow access.
4.  The script will download all files to this folder, renaming them as specified while keeping their original extensions.

## Troubleshooting

*   **"Authentication Failed"**: Delete the `token.json` file and try running the script again to re-login.
*   **"Mismatch in counts"**: Ensure you copied the exact same number of rows for filenames and links.
