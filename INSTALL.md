# Installation Instructions

Run these commands in your terminal:

```bash
cd /Users/raghav/Downloads/clinicalhours/ClinicalHours
npm install --legacy-peer-deps
npm run build
```

Then start the server:
```bash
python3 serve.py
```

Or use the dev server:
```bash
npm run dev
```

**Note:** The `--legacy-peer-deps` flag is needed because some packages haven't fully updated for React 19 yet, but they work fine.

