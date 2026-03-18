# UMEI3D Post-Purchase App

## Files
- Primary: `C:\Users\J\Desktop\UMEI3D\workflow\returns-popup.html`
- Backup: `C:\Users\J\Desktop\returns-popup.html`
- Always sync both after every edit:
  `cp "C:/Users/J/Desktop/returns-popup.html" "C:/Users/J/Desktop/UMEI3D/workflow/returns-popup.html"`

## Tech Stack
- Single-file HTML/CSS/JS — no framework, no dependencies
- Web Audio API for sounds (no audio files)
- Canvas API for confetti
- mailto: for form submissions

## Features
- 4 action cards: Track Order, Start Return, Exchange Item, Cancel Order
- Track Order → bottom sheet → opens umeistore.com/pages/contact in new tab
- Return / Exchange / Cancel → form → mailto: umei3d@gmail.com
- Floating chat bubble → email modal → umei3d@gmail.com
- Sound effects: tick, swoosh, success chime, pop
- Return journey timeline with day estimates
- Feedback section → mailto: umei3d@gmail.com
- Support: Call Us (888-269-5321)

## CSS Tokens
```css
:root {
  --bg: #08090d; --bg-card: #0e0f15; --bg-raised: #13141c;
  --blue: #4583fd; --blue-dim: rgba(69,131,253,0.12);
  --text-1: #e8eaf2; --text-2: #6b6f87;
  --green: #22d47a; --red: #ff4743;
}
```

## Milestones
| # | Milestone | Dates | Status |
|---|-----------|-------|--------|
| 1 | Feedback & Fixes | Mar 17 → Mar 22, 2026 | 🟡 In Progress |
| 2 | Visual Polish (Figma) | Mar 23 → Apr 5 | ⚪ Not Started |
| 3 | Voice & Sound (ElevenLabs) | Apr 6 → Apr 19 | ⚪ Not Started |
| 4 | Analytics | Apr 20 → May 3 | ⚪ Not Started |
| 5 | Pilot & Roll Out | May 4 → May 17 | ⚪ Not Started |

## Deploy
- Rename to index.html → drag to app.netlify.com/drop
- Notion tracker: 3279530a-745b-8197-81b8-ff3abc15058e
