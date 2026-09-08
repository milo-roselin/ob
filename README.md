# Secret Translator — Shared Learning v11

This build fixes three microphone-learning problems and corrects the Ob spelling rule.

## Changes

- Shared learning still syncs across devices through the Render server + private GitHub Gist.
- The shared learning profile is reset to v5 so an older poisoned `hello` model is ignored.
- Teaching `hello` now creates a word-local acoustic prototype only. It no longer changes the global phoneme distance for every word.
- Confirmed prototypes have strict length and acoustic-distance gates.
- Low-information filler groups such as `ah`, `uh`, and `mm` are suppressed in Ob mode.
- Recognition results are deduplicated by their actual audio time span, so one spoken `hobellobo` cannot be counted five times merely because overlapping chunks saw it repeatedly.
- Ob reverse spelling now follows audible vowel sounds rather than every written vowel. For example, `name` becomes `nobame`, not `nobamobe`.

## Shared-learning setup

Keep the same Render environment variable used by v10:

    GITHUB_GIST_TOKEN=<GitHub token with Gists write permission>

The existing private Gist can remain. v11 uses profile version 5, so the old v4 learned model is ignored and replaced by clean v5 learning.

## Replace in GitHub

Replace:
- `server.js`
- `package.json`
- `render.yaml`
- the entire `public/` folder

Then deploy.
