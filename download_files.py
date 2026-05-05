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
    links = get_multiline_input("Paste the column of Google Drive links:")

    # Validate
    if len(names) != len(links):
        print(f"\nERROR: Count mismatch! Names: {len(names)}, Links: {len(links)}")
        print("Lists must be the same length.")
        return
    
    if not names:
        print("No inputs provided.")
        return

    print(f"\nReady to download {len(names)} files...")
    
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
    downloaded_cache = {} # Map file_id -> local_path

    for i, (name, link) in enumerate(zip(names, links)):
        print(f"\n[{i+1}/{len(names)}] Processing...")
        
        file_id = get_file_id_from_link(link)
        if not file_id:
            print(f"Skipping invalid link: {link}")
            continue
            
        safe_name = sanitize_filename(name)
        
        # Check if we already downloaded this file ID in this session
        if file_id in downloaded_cache:
            existing_path = downloaded_cache[file_id]
            # Determine extension from existing path
            _, ext = os.path.splitext(existing_path)
            new_filename = f"{safe_name}{ext}"
            new_path = os.path.join(dest_folder, new_filename)
            
            print(f"File ID {file_id} already downloaded. Copying to '{new_filename}'...")
            try:
                shutil.copy2(existing_path, new_path)
                print(f"Success (Copy): {new_filename}")
                success_count += 1
            except Exception as e:
                print(f"Error copying file: {e}")
            continue

        # If not in cache, download it
        final_path = download_file(service, file_id, safe_name, dest_folder)
        if final_path:
            downloaded_cache[file_id] = final_path
            success_count += 1
            
    print(f"\nCompleted: {success_count}/{len(names)} files downloaded.")

if __name__ == '__main__':
    main()
