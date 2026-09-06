# Secret Speech Translator — complete GitHub project

Upload the CONTENTS of this ZIP to a new GitHub repository.

Top level should contain:
- server.js
- package.json
- render.yaml
- .gitignore
- README.md
- public/
  - index.html

IMPORTANT: This is a Render **Web Service**, not a Static Site.

Render settings:
- Runtime: Node
- Build Command: npm install
- Start Command: npm start

Environment variable required:
- OPENAI_API_KEY = your OpenAI API key

Optional:
- TRANSCRIBE_MODEL = gpt-4o-mini-transcribe

Phone/iPad/computer:
- Tap microphone
- Speak
- Tap again
- Server transcribes and decodes

Watch:
- Interface automatically becomes compact
- If direct microphone capture works, use the mic
- If the watch browser does not expose microphone recording, tap the text box and use the watch's own dictation/keyboard, then press Translate Text

This version does NOT use browser SpeechRecognition, so it avoids the `service_not_allowed` error you saw on iPhone/iPad.
