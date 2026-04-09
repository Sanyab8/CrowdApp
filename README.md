# CrowdApp

A lightweight web app that combines UCSC facility occupancy data with student crowd-sourced updates.

## Features

- Pulls occupancy info from the UCSC facility occupancy page (with graceful fallback sample data).
- Shows crowd status labels (Open / Busy / Packed) for each facility.
- Lets users post line-length reports for specific facilities.
- Lets users ask and answer quick questions like whether courts are open.
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
