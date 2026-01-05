# How to Run the Site Locally

## Quick Start (Easiest Method)

**Option 1: Using the provided script**
```bash
./start-local-server.sh
```

**Option 2: Using Python directly**
```bash
python3 serve.py
```

Then open your browser to: **http://localhost:8000**

---

## Important: You Need to Build First

This is a React/Vite project, so you need to build it before serving. Here's how:

### Step 1: Install Node.js (if not installed)
- Download from: https://nodejs.org/ (get the LTS version)
- Or install via Homebrew: `brew install node`

### Step 2: Install dependencies
```bash
npm install
```

### Step 3: Build the project
```bash
npm run build
```

### Step 4: Serve it
```bash
python3 serve.py
```

Then open: **http://localhost:8000**

---

## Alternative: Development Mode (with hot reload)

If you want live updates while coding:

```bash
npm install
npm run dev
```

Then open: **http://localhost:3000** (or whatever port it shows)

---

## Troubleshooting

**"command not found" errors:**
- Make sure Node.js is installed: `node --version`
- If using Homebrew, make sure it's in your PATH

**Port already in use:**
- The script will try a different port automatically
- Or manually change the PORT in `serve.py`

**Connection refused:**
- Make sure you built the project first: `npm run build`
- Check that the `dist` folder exists

