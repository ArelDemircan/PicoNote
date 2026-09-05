# PicoNote 📝

A lightweight, fast, and feature-rich desktop note-taking application built with **Tauri v2**, **React**, **TypeScript**, and **Rust**.

PicoNote features real-time rich text editing, seamless cross-device local network synchronization (built-in WebDAV HTTP server), file export/backup capabilities, and light/dark theme support.

---

## ✨ Features

- **⚡ Fast & Lightweight**: Powered by Tauri v2 and Rust core for minimal memory usage and instant startup.
- **📱 Local Network Cross-Device Sync**: Built-in HTTP/WebDAV server allowing seamless bidirectional sync between your PC and mobile devices over Wi-Fi.
- **🌓 Light & Dark Theme**: Toggle between dark mode and light mode with persistent theme preference.
- **📝 Rich Text Editor**: Clean and responsive editor powered by Tiptap with support for bold, italic, headings, and bulleted lists.
- **💾 Export & Backup**: Export single or all notes to `.txt` files or back up your complete dataset in `.json` format.
- **🔐 Privacy First**: All data is stored locally on your machine. No mandatory third-party cloud services required.

---

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Tiptap Editor, Lucide Icons
- **Backend**: Rust, Tauri v2, `tiny_http` (Local Sync Server), `reqwest`
- **Styling**: CSS Custom Properties / CSS Variables (Dynamic Theme Switching)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) for Windows/macOS/Linux

### Installation & Running

1. **Clone the repository**:
   ```bash
   git clone [https://github.com/ArelDemircan/PicoNote.git](https://github.com/ArelDemircan/PicoNote.git)
   cd PicoNote
Install frontend dependencies:

Bash
npm install
Run in development mode:

Bash
npm run tauri dev
Build production package:

Bash
npm run tauri build
📲 How Local Sync Works
Open Settings (⚙️) from the bottom sidebar in PicoNote.

Toggle Mobile Access to ON.

Scan the generated QR Code with your mobile phone or enter the displayed IP address (e.g. http://192.168.1.X:8080/) into any WebDAV-compatible app on your mobile device.

Auto-sync continuously updates notes in the background over your local Wi-Fi network.

📄 License
This project is licensed under the MIT License.