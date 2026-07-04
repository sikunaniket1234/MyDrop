# MyDrop User Manual

Everything stays on your infrastructure. No cloud, no third party.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Desktop App](#2-desktop-app)
3. [Mobile App](#3-mobile-app)
4. [Pairing Devices](#4-pairing-devices)
5. [Sharing Content](#5-sharing-content)
6. [Syncing & Status](#6-syncing--status)
7. [Conflict Resolution](#7-conflict-resolution)
8. [Android Share Intent](#8-android-share-intent)
9. [Vault & Security](#9-vault--security)
10. [Keyboard Shortcuts](#10-keyboard-shortcuts)
11. [Troubleshooting](#11-troubleshooting)
12. [FAQ](#12-faq)

---

## 1. Getting Started

### What You Need

| Device | Requirements |
|--------|-------------|
| Desktop (hub) | Windows, macOS, or Linux with Node.js 22+ |
| Mobile | Android 7.0+ (iOS support coming soon) |
| Network | All devices on the same LAN, or connected via IP |

### Install & Launch

**Desktop:**

1. Clone the repo and install dependencies:
   ```
   corepack enable
   pnpm install
   pnpm --filter @mydrop/core build
   ```
2. Double-click **`Start-MyDrop.bat`** in the project root, or run:
   ```
   pnpm --filter @mydrop/desktop dev
   ```
3. The desktop app opens at `http://localhost:1420`. The API server runs on port `4317`.

**Mobile (Android):**

1. Install the APK (`MyDrop.apk`) on your Android device.
2. Open the MyDrop app.
3. The vault screen appears on first launch (see [Vault & Security](#9-vault--security)).

---

## 2. Desktop App

The desktop app is your always-on sync hub. It uses a three-panel dark-themed layout.

### Layout

```
┌──────────┬────────────────────┬────────────────────┐
│          │                    │                    │
│ Sidebar  │    Inbox Panel     │   Detail Panel     │
│          │                    │   (when item       │
│  Logo    │  Filters + List    │    selected)       │
│  Inbox   │                    │                    │
│  Devices │  Composer          │                    │
│          │                    │                    │
│  Status  │                    │                    │
│  + Quick │                    │                    │
│    Share │                    │                    │
└──────────┴────────────────────┴────────────────────┘
```

### Sidebar

- **Logo:** "MyDrop" brand at the top.
- **Inbox:** View all synced items. Click to switch to the inbox panel.
- **Devices:** View paired devices and their online/offline status. A badge shows the count (e.g., "2/3" means 2 of 3 devices are online).
- **Status dot:** Green = connected to sync engine. Gray = disconnected.
- **+ button:** Opens the Quick Share popup (see [Sharing Content](#5-sharing-content)).

### Inbox Panel

- **Filters:** Click "All", "Text", "Link", "File", "Image", or "Voice" to filter items by type.
- **Item list:** Each row shows a colored badge (T/L/F/I/V), title, and timestamp. Click any item to open the detail panel.
- **Composer:** Type text and click "Share text" to create a new item. Click "Share file" to attach any file from your computer.
- **Empty state:** "No items yet. Drop something in."

### Detail Panel

Opens to the right of the inbox when you select an item.

- **Metadata:** Title, type, source device, timestamp.
- **Content:** Full text or file info displayed in a styled box.
- **Actions:**
  - **Download** — Save the item to your computer.
  - **Share** — Share externally (e.g., copy to clipboard).
  - **Delete** — Remove the item.
- **Conflict section:** If the item has conflicting versions from different devices, a yellow warning banner appears. See [Conflict Resolution](#7-conflict-resolution).

### Devices Page

Click "Devices" in the sidebar to see a grid of paired device cards. Each card shows:
- Green/gray status dot (online/offline)
- Device name
- Status: Online or Offline
- Software version
- Trusted since date

Click "Pair new device" to start the pairing flow (see [Pairing Devices](#4-pairing-devices)).

---

## 3. Mobile App

The mobile app is a tabbed interface with a dark theme.

### Tab Bar

Four tabs at the bottom:

| Tab | Icon | Purpose |
|-----|------|---------|
| Inbox | 📥 | View and manage synced items |
| Devices | 📱 | See paired devices and their status |
| Conflicts | ⚠️ | Resolve version conflicts (badge shows count) |
| Pair | 🔗 | Start pairing a new device |

### Inbox Screen

- **Filters:** Horizontal scrollable pills — "All", "Texts", "Links", "Files", "Images", "Voices". Tap to filter.
- **Item list:** Each row shows a colored left border, icon, title, content preview, and relative time (e.g., "5m", "2h"). Tap any item to open the detail view.
- **Composer:** A text input at the top with "Share text..." placeholder. Type content and tap "Send" to create a new item. Tap "Connect" to manually enter a desktop hub IP address.

### Detail Screen

Tap any item in the inbox to view details:

- **Header:** Colored icon and item type.
- **Info:** Title, content, type, source device, sync status.
- **Tags:** Display tags (e.g., #work, #mydrop). Note: tag editing is not yet available.
- **Actions:**
  - **Download** — Save to your device's Downloads folder. For files, the full file is downloaded. For text with data URLs, the content is decoded and saved.
  - **Share** — Opens the system share sheet (SMS, email, etc.) with the item content.
  - **Delete** — Prompts "Are you sure?" then removes the item.

### Devices Screen

Shows a list of paired devices with:
- Green/gray status dot (online/offline, with pulsing animation during sync)
- Device name and version
- Status badge: "online" (green) or "offline" (gray)
- Stats: Storage used, pending sync events, last seen time
- "+ Pair new device" button at the bottom

---

## 4. Pairing Devices

Pairing connects a new mobile device to your desktop hub. It uses a secure 3-step process.

### From Mobile

1. Tap the **Pair** tab.
2. **Step 1 — Scan QR:** A QR code appears with a 5-minute countdown. Open MyDrop on the other device and scan this code.
3. **Step 2 — Confirm Code:** Both devices display a 4-digit code. Verify they match, then tap "Confirm".
4. **Step 3 — Syncing:** A progress bar shows historical sync progress. When complete, tap "Go to devices".

### From Desktop

1. Click **Devices** in the sidebar.
2. Click **"Pair new device"**.
3. The same 3-step flow begins.

### Pairing Details

- Pairing codes expire after **5 minutes**.
- After confirmation, the new device is marked as "trusted" and begins syncing all historical items.
- You can pair multiple devices (phone, tablet, another computer).
- To revoke a device's access, use the server API: `POST /v1/devices/{id}/revoke`.

---

## 5. Sharing Content

### Desktop — Quick Share

Press **Ctrl+Shift+M** (Windows/Linux) or click the **+** button in the sidebar to open the Quick Share popup.

- **Share text:** Type or paste text, then click "Share text".
- **Share file:** Click "Choose file", select a file, then click "Share file".
- **Keyboard shortcuts:** Ctrl+Enter to submit. Escape to close. Click the backdrop to dismiss.

### Desktop — Composer

On the Inbox panel, use the built-in composer:
- Type text and click "Share text".
- Click "Share file" to attach a file from your computer.

### Mobile — Composer

On the Inbox tab, type text in the "Share text..." field and tap "Send". The item is created locally and synced to the desktop hub.

### Mobile — Android Share Intent

Share from **any Android app** directly into MyDrop:

1. In any app (browser, gallery, file manager, etc.), tap the Share button.
2. Select **MyDrop** from the share sheet.
3. The content (text, file, or image) is automatically added to your MyDrop inbox.

Supported content types: text, files, images.

### Item Types

| Type | Created From | Example |
|------|-------------|---------|
| text | Typed text, shared text | Notes, messages |
| link | URLs | Web pages |
| file | File uploads, file sharing | Documents, PDFs |
| image | Image sharing, photo picks | Screenshots, photos |
| voice | Voice recordings | Audio memos |
| clipboard | Clipboard monitoring | Copied text |

---

## 6. Syncing & Status

### How Sync Works

- The **desktop hub** is the always-on sync server.
- **Mobile devices** connect via WebSocket (`ws://{host}:{port}/sync`).
- Items are synced using a **CRDT-based engine** with vector clocks — edits from multiple devices merge automatically without data loss.
- Real-time updates: when a new item is created on any device, all connected peers receive it instantly via Socket.IO.

### Status Indicators

**Mobile header:**
| Status | Meaning |
|--------|---------|
| Synced | All items up to date |
| Syncing... | Actively transferring events |
| Connected | WebSocket connected, idle |
| Disconnected | No connection to desktop hub |

**Desktop sidebar:**
| Status | Meaning |
|--------|---------|
| Green dot + "Connected" | Hub is running and reachable |
| Gray dot + "Disconnected" | Hub is not running or unreachable |

### mDNS Auto-Discovery

On launch, the mobile app automatically discovers desktop hubs on your local network using mDNS (`_mydrop._tcp.local.`). No manual IP entry needed on the same LAN. If auto-discovery fails, tap "Connect" in the mobile composer to enter the desktop IP manually.

---

## 7. Conflict Resolution

Conflicts occur when the same item is edited on two devices while offline. MyDrop detects and presents these for manual resolution.

### On Mobile

1. Tap the **Conflicts** tab. A badge shows the number of unresolved conflicts.
2. Each conflict shows:
   - A yellow warning banner: "2 versions found"
   - Two version cards with device name, timestamp, and content preview
3. Choose an action:
   - **Keep A** — Keep version A, discard version B.
   - **Keep B** — Keep version B, discard version A. (Recommended)
   - **Keep both** — Save both as separate items.
4. A green confirmation screen appears. Tap "Back" to return to the inbox.

### On Desktop

1. Items with conflicts show a yellow **"Conflict"** tag in the inbox list.
2. Click the item to open the detail panel.
3. A yellow warning section shows each conflicting version with:
   - Version ID and source device
   - Content preview
   - **"Keep this"** button — Keep this version.
   - **"Keep both"** button — Retain both versions as separate items.
4. After resolution, a green "Resolved" banner confirms the action.

---

## 8. Android Share Intent

When you share content from another Android app to MyDrop:

1. **Text sharing:** The shared text becomes a new "text" item in your inbox. Title is the first 80 characters.
2. **File sharing:** The shared file becomes a "file" or "image" item. The filename is used as the title.
3. **Image sharing:** Shared images are stored as "image" items.

The content is added to your local inbox and automatically synced to all paired devices.

**Note:** iOS Share Extension is planned but not yet available.

---

## 9. Vault & Security

### First Launch — Vault Setup

When you first open the mobile app, the vault screen appears:

**Option 1: Set a Passphrase**
1. Enter a passphrase (minimum 4 characters) in both fields.
2. Tap **"Set Passphrase"**.
3. Your data is encrypted with AES-256. You'll need this passphrase on every launch.

**Option 2: Auto-Generated Key**
1. Tap **"Use Auto-Generated Key (No Passphrase)"**.
2. A random encryption key is generated and stored on your device.
3. The app unlocks automatically on future launches — no passphrase needed.

**Option 3: Skip**
1. Tap **"Skip for now"**.
2. Your database is **not encrypted**. You'll see the vault screen again on next launch.

### Returning Users

If you set a passphrase, the vault screen appears on every launch:
1. Enter your passphrase.
2. Tap **"Unlock"**.

If you chose auto-generated key, the app unlocks silently — no action needed.

### Desktop Security

- The desktop server stores data in `~/.mydrop/v1.sqlite` (encrypted if vault is configured).
- Files are stored in `~/.mydrop/files/`.
- Optional TLS encryption is available by setting `MYDROP_TLS=1` (requires OpenSSL installed).
- Device pairing uses Ed25519 keypairs for identity verification.

### Transport Encryption

- WebSocket sync connections are authenticated via pairing tokens.
- TLS is optional for the HTTP server. Enable with environment variable `MYDROP_TLS=1`.

---

## 10. Keyboard Shortcuts

### Desktop

| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+M | Open/close Quick Share popup |
| Ctrl+Enter | Submit Quick Share (when popup is open) |
| Escape | Close Quick Share popup |

---

## 11. Troubleshooting

### "Disconnected" on mobile

1. Make sure the desktop app is running (`Start-MyDrop.bat` or `pnpm dev`).
2. Ensure both devices are on the same network.
3. If auto-discovery fails, tap "Connect" and enter the desktop IP manually (e.g., `http://192.168.1.100:4317`).

### Pairing fails

- Pairing codes expire after 5 minutes. Generate a new one if expired.
- Make sure both devices can reach each other on the network.
- Check that the desktop server is running and not blocked by a firewall.

### Items not syncing

- Check the status indicator in the mobile header or desktop sidebar.
- If "Syncing..." persists, the connection may be slow. Wait a moment.
- If "Disconnected", reconnect by tapping "Connect" on mobile or restarting the desktop server.

### Android share intent not working

- Ensure you're running Android 7.0 or later.
- MyDrop must have been opened at least once for the share intent handler to be active.
- The shared content is processed when the app returns to the foreground.

### Vault locked out

- If you forgot your passphrase, you'll need to clear the app data and start fresh. This deletes all local data.
- Auto-generated keys are stored on the device — uninstalling the app loses the key.

### Desktop server won't start

- Ensure Node.js 22+ is installed: `node --version`
- Ensure dependencies are installed: `pnpm install`
- Ensure core is built: `pnpm --filter @mydrop/core build`
- Check if port 4317 is already in use.

---

## 12. FAQ

**Q: Is my data sent to the cloud?**
A: No. MyDrop is entirely self-hosted. All data stays on your devices and your desktop hub.

**Q: Can I use MyDrop over the internet?**
A: Yes, if your desktop hub is accessible via a public IP or VPN. The mobile app supports manual IP entry.

**Q: How many devices can I pair?**
A: There is no limit. Pair as many devices as you need.

**Q: What happens if two devices edit the same item offline?**
A: MyDrop detects the conflict and presents both versions for you to choose from. You can keep one or keep both.

**Q: Is the data encrypted?**
A: On mobile, yes — if you set a passphrase or use auto-generated key, the local database is encrypted with AES-256. Transport encryption (TLS) is optional on the desktop server.

**Q: Does this work on iOS?**
A: The mobile app is built with React Native and supports Android. iOS support is planned but the Share Extension is not yet available.

**Q: Can I share files from my phone?**
A: Yes. Use the Android share sheet from any app (gallery, file manager, browser) and select MyDrop as the target. Direct file upload from the mobile composer is not yet available.

**Q: What file types are supported?**
A: Any file type. MyDrop stores files as content-addressed chunks (4 MB each) with SHA-256 hashing.

**Q: How much storage does MyDrop use?**
A: The desktop hub stores all synced items in a SQLite database and files in a local directory. You can check storage usage on the mobile Devices screen.

**Q: Can I change my passphrase?**
A: Not yet. This feature is planned for a future release.

---

*MyDrop v1.0.0 — Self-hosted sync for people who care about their data.*
