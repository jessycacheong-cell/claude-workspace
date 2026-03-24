#!/bin/bash
# SessionBot — runs at Claude session start
# Fetches Gmail + Calendar via MCP and pushes updated data.json to GitHub

# Recursion guard: stops infinite loop when claude -p starts its own session
if [ -n "$UMEI_SESSION_BOT_RUNNING" ]; then
  exit 0
fi
export UMEI_SESSION_BOT_RUNNING=1

# Find latest claude.exe dynamically
CLAUDE_DIR="/c/Users/J/AppData/Roaming/Claude/claude-code"
CLAUDE_EXE=$(ls -d "${CLAUDE_DIR}/"*/ 2>/dev/null | sort -V | tail -1)
CLAUDE_EXE="${CLAUDE_EXE}claude.exe"

if [ ! -f "$CLAUDE_EXE" ]; then
  exit 0
fi

TODAY=$(date +"%Y-%m-%d")

"$CLAUDE_EXE" -p "DASHBOARD REFRESH — run this automatically, no user interaction needed:

1. Use Gmail MCP to fetch the 5 most recent inbox emails
2. Use Google Calendar MCP to fetch today's events: timeMin=${TODAY}T00:00:00, timeMax=${TODAY}T23:59:59, timeZone=America/Los_Angeles
3. Read C:/Users/J/Desktop/claude-workspace/personal/data.json
4. Update ONLY these fields (leave everything else unchanged):
   - lastUpdated: current ISO timestamp
   - inbox.gmail: array of {from (name only, no email), subject, timestamp (ISO string), unread (boolean)}
   - inbox.gmailUpdated: current ISO timestamp
   - agenda: array of {title, time (h:MM AM/PM format), end, allDay}
   - agendaUpdated: current ISO timestamp
5. Write the updated JSON back to the file
6. Run: git -C C:/Users/J/Desktop/claude-workspace pull --rebase origin main
7. Run: git -C C:/Users/J/Desktop/claude-workspace add personal/data.json
8. Run: git -C C:/Users/J/Desktop/claude-workspace commit -m 'SessionBot: refresh Gmail + Calendar [skip ci]'
9. Run: git -C C:/Users/J/Desktop/claude-workspace push origin main

Do this completely and silently." 2>/dev/null

exit 0
