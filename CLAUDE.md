# Claude Workspace — Master Brief

> This is the master command center. Open Claude from this folder and I know everything.
> All brands, all apps, all preferences live here.

---

## Owner
- Name: J
- Based in: Austin, TX
- Working style: casual, fast, visual-first, mobile-first
- Personal context: `personal/about-me.md`
- Tools connected: Notion, Gmail, Google Calendar, Klaviyo, Canva, Blotato

---

## Brands

### UMEI3D
- Full details: `brands/umei3d.md`
- Website: https://umeistore.com

<!-- Add new brands below. Full details go in brands/brandname.md -->

---

## Apps & Projects

### UMEI3D Post-Purchase App
- Full details: `apps/umei3d-post-purchase.md`
- Status: Milestone 1 — Feedback & Fixes (due Mar 22, 2026)

<!-- Add new apps below. Full details go in apps/appname.md -->

---

## System / Environment
- OS: Windows
- Node.js: `C:\Program Files\Adobe\Adobe Photoshop 2026\node.exe` (v22.18.0)
- Do NOT use npx — not in PATH
- Preview server: port 3401 via `C:\Users\J\Desktop\serve-static.js`
- Preview server MCP ID: `ad7b82a2-eb2b-4c7d-b560-0775da177a6b`

---

## Working Preferences
- Always dark UI unless told otherwise
- Mobile-first design always
- No unnecessary emojis in code
- Keep responses short — no long intros
- After editing any app file → always take screenshot to verify
- Sync all file copies after every edit
- Deployment target: Netlify Drop

---

## Folder Rules
- New brand → create `brands/brandname.md`
- New app → create `apps/appname.md`
- Personal projects/automations → save in `personal/`
- Reusable code snippets → save in `templates/`
- Logos, images, fonts → save in `assets/`

---

## Folder Structure
```
claude-workspace/
├── CLAUDE.md              ← you are here (master brief)
├── brands/                ← one file per brand
│   └── umei3d.md
├── apps/                  ← one file per app
│   └── umei3d-post-purchase.md
├── personal/              ← J's personal projects & automations
│   └── about-me.md
├── templates/             ← reusable code/design templates
└── assets/                ← logos, fonts, brand assets
```
