# LeadForge — Local Setup & Multi-Device Sharing Guide

LeadForge is a full-stack B2B lead generation, enrichment, and client digital audit platform built with React, Vite, Express, and PostgreSQL (Drizzle ORM).

---

## 1. Prerequisites

Before running the application on your computer, ensure you have:
- **Node.js**: Version 18 or 20+ installed ([nodejs.org](https://nodejs.org/))
- **npm** (comes with Node.js) or **pnpm / yarn**
- **PostgreSQL Database**:
  - **Option A (Easiest - Cloud):** Free database from [Supabase](https://supabase.com) or [Neon](https://neon.tech)
  - **Option B (Local):** PostgreSQL installed locally or running via Docker:
    ```bash
    docker run --name leadforge-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=leadforge -p 5432:5432 -d postgres
    ```

---

## 2. Step-by-Step Local Setup

### Step 1: Install Dependencies
Open your terminal in the project directory and run:
```bash
npm install
```

### Step 2: Configure Environment Variables
Create a `.env` file in the root of the project (copy from `.env.example`):
```bash
cp .env.example .env
```

Open `.env` in your text editor and fill in your values:
```env
# 1. PostgreSQL Database URL (Local or Supabase/Neon)
# Local Docker/Postgres example:
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/leadforge"
# Or Supabase connection string:
# DATABASE_URL="postgresql://postgres.[YOUR-REF]:[YOUR-PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres"

# 2. Gemini AI Key for Audits & Pitches (Free key from https://aistudio.google.com/app/apikey)
GEMINI_API_KEY="AIzaSy..."

# 3. Optional Port (defaults to 3000)
PORT=3000
```

### Step 3: Initialize Database Schema
Push the database schema (creates all tables, relations, and indices):
```bash
npm run db:push
```

### Step 4: Start the Server
Launch the application:
```bash
npm run dev
```

The server binds to `0.0.0.0:3000`. You can now open your browser at:
👉 **`http://localhost:3000`**

---

## 3. How to Share with Other Devices (Phone, Tablet, Other PC)

### Method A: Same Local Wi-Fi Network (LAN)
Because the server is configured with `0.0.0.0`, any device connected to the same Wi-Fi network can access it directly.

1. **Find your computer's local IP address:**
   - **Mac:** Open Terminal and run:
     ```bash
     ipconfig getifaddr en0
     ```
     *(Or go to System Settings → Wi-Fi → Details → IP Address)*
   - **Windows:** Open Command Prompt / PowerShell and run:
     ```cmd
     ipconfig
     ```
     *(Look for the `IPv4 Address`, e.g., `192.168.1.45`)*
   - **Linux:** Run:
     ```bash
     hostname -I
     ```

2. **Open on your other device:**
   On your phone, tablet, or another computer connected to the same Wi-Fi, open the browser and navigate to:
   ```
   http://YOUR_LOCAL_IP:3000
   ```
   *(Example: `http://192.168.1.45:3000`)*

> **Firebase Auth note for Wi-Fi access:**
> If using Google Sign-in from another device's browser, add your local IP (e.g., `192.168.1.45`) to:
> **Firebase Console → Authentication → Settings → Authorized domains**.

---

### Method B: Share Over the Internet (No Wi-Fi Restriction)
To share the app with a colleague, client, or test on mobile data outside your house without deploying to the cloud:

#### 1. Using Cloudflare Tunnels (Free, Fast, HTTPS)
```bash
# Run without installing anything:
npx cloudflared tunnel --url http://localhost:3000
```
This gives you a secure `https://xxxx.trycloudflare.com` URL that works on any phone or computer worldwide.

#### 2. Using LocalTunnel (Quick & Free)
```bash
npx localtunnel --port 3000
```

#### 3. Using Ngrok
```bash
ngrok http 3000
```

---

## 4. Production Build & Deployment

To deploy permanently to cloud hosting (Render, Railway, Fly.io, or VPS):

```bash
# Build the Vite frontend
npm run build

# Start the Node.js production server
npm start
```
Make sure to provide `DATABASE_URL` and `GEMINI_API_KEY` in your hosting platform's environment variable settings.
