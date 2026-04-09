# CrowdApp

A polished web app that combines UCSC facility occupancy data with student crowd-sourced updates.

## Features

- Pulls occupancy info from the UCSC facility occupancy page (with graceful fallback sample data).
- Displays each facility as an interactive circular crowd meter.
- Shows estimated closing times per facility with weekday/weekend handling.
- Adds live search + sort controls so users can quickly find open spaces.
- Lets users post line-length reports and upvote helpful reports.
- Lets users ask/answer quick questions (e.g., whether a court is open) and upvote helpful questions.
- Persists reports/questions in browser local storage.

## Run locally

Because this app uses `fetch` and ES modules, run it from a local web server:

```bash
python3 -m http.server 4173
```

Then open:

- <http://localhost:4173>

## Notes

- Live parsing may fail in some browsers due to CORS/proxy restrictions; the app will automatically show fallback sample occupancy and keep community features available.
- Closing times are best-effort reference values in this version and should be validated against official UCSC schedules.
