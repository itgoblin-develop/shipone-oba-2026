# ShipOne · OBA 2026 submission build

User-approved direction: a newly built installed PC personal agent; Android/iOS releases later. Web is a clearly labelled interactive demonstration. No existing repository code is reused.

## Core acceptance criteria

1. Desktop app installs and launches on Windows. React UI also builds as a web demo.
2. Capture tasks and calendar availability, recommend one feasible mission, show why.
3. Lock explicit completion criteria before work; support progress, parking, blocking/replanning.
4. Verify user-selected evidence, distinguish pass/fail/unknown/manual, retain history and a receipt; changing criteria invalidates old verification.
5. OpenAI Responses API executes in desktop main process with structured output, actual usage, useful errors and no silent demo fallback. Keys protected with OS encryption, never in published web or logs.
6. Read selected Notion task source and Google Calendar using user credentials; fresh/stale/error states visible. Calendar file import is also available.
7. Persist desktop task history locally. Demo state is isolated and labelled. Receipt exports work.
8. Keyboard/mobile layout and real rendered desktop and web flows are verified; test planning conflicts, verification failures and persisted data.
9. Provide installer, source, web demo and submission README/pitch, with tested vs pending integrations stated accurately.

## Scope

Today: Windows app, web demo, one complete mission-to-proof loop, actual provider adapters and secure settings. Mobile store releases and cross-device cloud accounts are future milestones, not claimed as delivered.
No generic OS control, no hidden recording, no automatic email or calendar edits. Calendar is read-only. Local evidence is explicitly selected. URL checking is restricted to public HTTP(S).

## Design contract

Work surface, not a chat. Calm ivory canvas, ink-green sidebar, mint proof accents, strong Korean typography. Primary action changes from recommend to start to verify. Evidence appears as concrete observations. Compact timeline and task rows; no generic KPI grid. Mobile moves navigation to the bottom and stacks the timeline. Keyboard focus visible; errors use text, not only color.

## Build choice

Electron + React/TypeScript because the current Windows environment has Node but no Rust toolchain. Agent operations and data contracts are independent of the desktop shell for future mobile clients. Web demo shares UI and core but cannot access keys or desktop privileged operations.
