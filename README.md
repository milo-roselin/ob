# Secret Speech Translator v2

A Render-ready mobile web app for iPad, iPhone, Android, Mac, PC, and other modern browsers.

## Features
- Giant language buttons
- Ob Language decoder
- Pig Latin decoder
- Ubbi Dubbi decoder
- Rövarspråket decoder
- Normal speech mode
- Animated microphone
- Conversation history
- Optional automatic language detection and switching
- Manual text correction
- Responsive phone/tablet/computer layout
- No Add-to-Home-Screen button

## Deploy on Render

1. Download and unzip this package.
2. Create a GitHub repository.
3. Upload:
   - `index.html`
   - `render.yaml`
   - `README.md`
4. In Render, choose **New > Static Site**.
5. Connect your GitHub repository.
6. Build Command: leave blank.
7. Publish Directory: `.`
8. Deploy.
9. Open the Render URL on your iPad, phone, or computer.
10. Allow microphone permission when prompted.

## Notes about microphone recognition

This app uses the browser's built-in Web Speech recognition interface where available.
Secret-language syllables may sometimes be automatically corrected by the browser's speech recognizer.
When that happens:
1. Edit the text under "What the app heard".
2. Tap Translate.

Automatic language detection is pattern-based and is intentionally labeled as a best guess.
