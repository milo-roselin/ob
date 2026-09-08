# Secret Translator — Shared Learning v12

## What changed

### Fix & teach now works for one-word Ob training
For a one-word correction such as `hello`, the app no longer uses the old
multi-word alignment routine that could skip the only word and return
"could not line up enough."

Instead it searches the complete phoneme recording for the acoustic window that
best matches the expected Ob pronunciation and saves the exact sound it heard as
a speaker-specific prototype.

Recognition remains strict, so teaching `hello` does not make unrelated sounds
turn into `hello`.

### Better filler suppression
Small vowel/hum fragments such as `ah`, `uh`, `mm`, and similar low-information
groups are discarded more aggressively in Ob mode.

### Shared learning works even without a GitHub token
If `GITHUB_GIST_TOKEN` is configured, learning is stored durably in the private
Gist and shared across devices.

If it is NOT configured, the Render server now uses a shared in-memory profile.
That still lets a phone, iPad, and computer share learning while the same server
process is running. The app shows:

    Shared across devices (temporary) ✓

Because Render free instances can restart/spin down, the memory-only profile is
not permanent. Add `GITHUB_GIST_TOKEN` later if you want the shared model to
survive server restarts and redeploys.

## Files to replace

Replace:
- `server.js`
- `package.json`
- the entire `public/` folder

`render.yaml` may also be replaced with the included version.
