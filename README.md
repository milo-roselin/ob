# Secret Translator — Shared Learning v10

This version synchronizes adaptive microphone learning across all devices that
use the same deployed Secret Translator.

## One-time setup in Render

Add this environment variable to the Render Web Service:

GITHUB_GIST_TOKEN=<GitHub token with Gists: write permission>

The server automatically creates a PRIVATE Gist named:

Secret Translator - Shared Adaptive Learning Store

You do not need to create the Gist yourself.

Optional:
GITHUB_GIST_ID=<specific gist id>

## Replace in GitHub

- server.js
- package.json
- render.yaml
- the entire public/ folder

## How it works

A device still saves learning locally for offline use, but it also synchronizes
the adaptive profile through /api/learning.

The Render server merges the profile with the current shared profile and stores
it in a private GitHub Gist. A phone, iPad, or computer opening the same app
downloads that shared model automatically.

All users of this deployed URL share one learning profile.
