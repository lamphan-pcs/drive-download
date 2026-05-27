import os
import io
import re
import sys
import shutil
import argparse
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
CREDENTIALS_FILE = 'credentials.json'
TOKEN_FILE = 'token.json'

def get_multiline_input(prompt):
    print(prompt)
    lines = []
    print("(Type 'END' on a new line to finish)")
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line.strip().upper() == 'END':
            break
        if line.strip():  # Skip empty lines
            lines.append(line.strip())
    return lines

def get_links_input(prompt):
    """Like get_multiline_input but splits each line by tabs,
    returning a list of lists (one sublist of links per name)."""
    print(prompt)
    rows = []
    print("(Type 'END' on a new line to finish)")
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line.strip().upper() == 'END':
            break
        if line.strip():
            links = [l.strip() for l in line.split('\t') if l.strip()]
            if links:
                rows.append(links)
    return rows

def get_file_id_from_link(link):
    # Extracts File ID from Google Drive links
    patterns = [
        r'\/d\/([a-zA-Z0-9_-]+)',  # .../d/ID/...
        r'id=([a-zA-Z0-9_-]+)',     # ...?id=ID
        r'open\?id=([a-zA-Z0-9_-]+)' # ...open?id=ID
    ]
    
    for pattern in patterns:
        match = re.search(pattern, link)
        if match:
            return match.group(1)
    return None

def authenticate():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                raise FileNotFoundError(f"Missing '{CREDENTIALS_FILE}'. Please download it from Google Cloud Console.")
            
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
    return creds

def sanitize_filename(name):
    """Remove illegal characters for Windows/Linux filenames"""
    return re.sub(r'[<>:"/\\|?*]', '', name).strip()

def download_file(service, file_id, new_name, dest_folder="."):
    try:
        # Get file metadata - supportsAllDrives=True is needed for Shared Drives
        file_meta = service.files().get(
            fileId=file_id, 
            fields='name, mimeType',
            supportsAllDrives=True
        ).execute()
        
        original_name = file_meta.get('name')
        
        # Determine extension from original filename
        _, ext = os.path.splitext(original_name)
        if not ext:
            # Fallback if no extension in metadata name (unlikely for files)
            ext = "" 
        # supportsAllDrives=True is technically for metadata, but good practice to allow broad access
        
        final_filename = f"{new_name}{ext}"
        final_path = os.path.join(dest_folder, final_filename)
        
        print(f"Downloading '{original_name}' -> '{final_path}'...")
        
        request = service.files().get_media(fileId=file_id)
        fh = io.FileIO(final_path, 'wb')
        downloader = MediaIoBaseDownload(fh, request)
        
        done = False
        while done is False:
            status, done = downloader.next_chunk()
            # print(f"Download {int(status.progress() * 100)}%.")
            
        print(f"Success: {final_path}")
        return final_path

    except HttpError as error:
        print(f"API Error for ID {file_id}: {error}")
    except Exception as e:
        print(f"Error downloading {file_id}: {e}")
    return None

def main():
    parser = argparse.ArgumentParser(description='Google Drive Bulk Downloader')
    parser.add_argument('--pref', action='store_true',
                        help='Treat the first link on each row as a separate preferred file '
                             'that must also appear among the other links.')
    args = parser.parse_args()

    print("--- Google Drive Bulk Downloader ---")
    
    # Authenticate first
    try:
        creds = authenticate()
    except Exception as e:
        print(f"Authentication Failed: {e}")
        return

    service = build('drive', 'v3', credentials=creds)

    # Get Inputs
    print("\n--- STEP 1: Paste Filenames ---")
    names = get_multiline_input("Paste the column of filenames:")
    
    print("\n--- STEP 2: Paste Drive Links ---")
    print("For each name, paste all links on ONE line separated by TABS.")
    if args.pref:
        print("The FIRST link on each line is the preferred video (must also appear in the other links).")
    else:
        print("The first link on each line will be treated as the preferred video.")
    link_rows = get_links_input("Paste the rows of Google Drive links:")

    # Validate counts
    if not names:
        print("No inputs provided.")
        return

    if len(names) != len(link_rows):
        print(f"\nERROR: Count mismatch! Names: {len(names)}, Link rows: {len(link_rows)}")
        print("Each name must have exactly one row of links.")
        return

    # Count total files to download (preferred + others, excluding copies of preferred)
    total_files = 0
    for row in link_rows:
        pref_id = get_file_id_from_link(row[0])
        total_files += 1  # preferred
        for lnk in row[1:]:
            fid = get_file_id_from_link(lnk)
            if fid and fid != pref_id:
                total_files += 1
    print(f"\nReady to process {len(names)} entries ({total_files} total files)...")

    dest_folder = r"D:\ruby-video\shop"
    if not os.path.exists(dest_folder):
        try:
            os.makedirs(dest_folder)
            print(f"Created destination folder: {dest_folder}")
        except OSError as e:
            print(f"Error creating destination folder {dest_folder}: {e}")
            return

    # Process
    success_count = 0
    downloaded_cache = {}  # Map file_id -> local_path

    for i, (name, links) in enumerate(zip(names, link_rows)):
        print(f"\n[{i+1}/{len(names)}] Processing '{name}' ({len(links)} link(s))...")

        safe_name = sanitize_filename(name).lower()

        preferred_link = links[0]
        preferred_id = get_file_id_from_link(preferred_link)
        if not preferred_id:
            print(f"  ERROR: Could not extract file ID from preferred link: {preferred_link}")
            continue

        other_links = links[1:]

        # Validate: preferred ID must appear in at least one of the other links (--pref mode only)
        if args.pref and other_links:
            other_ids = [get_file_id_from_link(l) for l in other_links]
            if preferred_id not in other_ids:
                print(f"  ERROR: Preferred link ID '{preferred_id}' not found in the other links for '{name}'.")
                print(f"  Skipping this entry.")
                continue

        # --- Download preferred file ---
        preferred_filename = f"{safe_name}-preferred-{preferred_id}"
        if preferred_id in downloaded_cache:
            existing_path = downloaded_cache[preferred_id]
            _, ext = os.path.splitext(existing_path)
            new_path = os.path.join(dest_folder, f"{preferred_filename}{ext}")
            print(f"  Preferred ID already downloaded. Copying to '{preferred_filename}{ext}'...")
            try:
                shutil.copy2(existing_path, new_path)
                print(f"  Success (Copy): {preferred_filename}{ext}")
                success_count += 1
            except Exception as e:
                print(f"  Error copying file: {e}")
        else:
            final_path = download_file(service, preferred_id, preferred_filename, dest_folder)
            if final_path:
                downloaded_cache[preferred_id] = final_path
                success_count += 1

        # --- Download other files (skip duplicates of preferred) ---
        for link in other_links:
            file_id = get_file_id_from_link(link)
            if not file_id:
                print(f"  Skipping invalid link: {link}")
                continue
            if file_id == preferred_id:
                continue  # already saved as preferred, don't duplicate

            other_filename = f"{safe_name}-{file_id}"

            if file_id in downloaded_cache:
                existing_path = downloaded_cache[file_id]
                _, ext = os.path.splitext(existing_path)
                new_path = os.path.join(dest_folder, f"{other_filename}{ext}")
                print(f"  File ID {file_id} already downloaded. Copying to '{other_filename}{ext}'...")
                try:
                    shutil.copy2(existing_path, new_path)
                    print(f"  Success (Copy): {other_filename}{ext}")
                    success_count += 1
                except Exception as e:
                    print(f"  Error copying file: {e}")
            else:
                final_path = download_file(service, file_id, other_filename, dest_folder)
                if final_path:
                    downloaded_cache[file_id] = final_path
                    success_count += 1

    print(f"\nCompleted: {success_count}/{total_files} files downloaded.")

if __name__ == '__main__':
    main()
