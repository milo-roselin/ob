# Secret Translator v13 — Raw Audio Learning

This version fixes the specific failure where Fix & Teach said it could not find
enough usable speech even though a short Ob word had clearly been recorded.

## Major change

Fix & Teach now stores a compact MFCC-like acoustic fingerprint of the RAW
recording. It does not need the phoneme recognizer to succeed first.

For a short word:

1. Record the word.
2. The app computes a local acoustic fingerprint immediately.
3. If normal Ob recognition fails, press Fix & Teach.
4. Type the English word.
5. The fingerprint is saved locally and synchronized through the existing
   shared-learning endpoint.
6. The next time a similar recording is made, the app can recognize the word
   by direct acoustic DTW matching.

## Built-in training sample

The good short recording supplied during development has been converted to a
non-audio acoustic fingerprint and included as a seed for `hello`. The original
audio file itself is NOT included in the website.

## Anti-overfitting

Raw-audio matching is restricted to short utterances and requires a close DTW
distance. Teaching `hello` therefore cannot make a long recording turn into
dozens of `hello` results.

## Shared learning

The shared profile now includes `acousticExamples`, so raw-audio learning can be
used by the Mac, phone, and iPad.

- With GITHUB_GIST_TOKEN: durable across Render restarts/deploys.
- Without it: shared temporarily while the Render process is alive.

## Replace

Replace:
- server.js
- package.json
- the entire public/ folder
