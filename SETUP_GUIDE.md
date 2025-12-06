# 🔑 Singers Dreams - API Setup Guide

Unlock the full **Key Finder** experience by connecting YouTube. This key is free and easy to get.

---


## 📺 1. YouTube Integration
**Search and Play Trending Music videos directly in the app.**

### Step 1: Get a Google Cloud Key
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a **New Project** (e.g., "Singers Dreams").
3.  In the dashboard, click **"Enable APIs and Services"**.
4.  Search for **"YouTube Data API v3"** and click on it.
5.  Click **Enable**.

### Step 2: Create Credentials
1.  Go to the **Credentials** tab (left sidebar).
2.  Click **"Create Credentials"** → **"API Key"**.
3.  Copy the generated **API Key** (starts with `AIza...`).
4.  (Optional) You can restrict the key to "YouTube Data API v3" for security.

### Step 3: Connect to the App
1.  Open **Singers Dreams**.
2.  In **Key Finder** → **Configure APIs**, paste the key into **YouTube Data API Key**.
3.  The app will instantly verify it.

---

## 🎧 2. Audio Loopback (For YouTube Analysis)
Since YouTube does not provide the musical Key of videos, the app analyzes the audio *while it plays*.

1.  **Windows**:
    *   Right-click the Sound icon on your taskbar → **Sound Settings**.
    *   Verify your **Input Device** is set to "Stereo Mix" (if available) OR use a virtual cable (like VB-Audio Cable).
2.  **Mac**:
    *   You will need software like **Loopback** or **BlackHole** to route system audio into the browser.
3.  **In the App**:
    *   Click "Activate Mic / Loopback".
    *   Play the YouTube video.
    *   Watch the **Estimated Key** update in real-time!
