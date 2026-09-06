import express from "express";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const MODES = new Set(["auto","ob","pig","ubbi","rovar","normal"]);

function preserveCase(original, replacement) {
  if (!original) return replacement;
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
  }
  return replacement.toLowerCase();
}

function transformWords(text, fn) {
  return text.replace(/[A-Za-zÀ-ÖØ-öø-ÿ']+/g, fn);
}

function decodeOb(text) {
  return transformWords(text, w => preserveCase(w, w.replace(/ob(?=[aeiou])/gi, "")));
}

function decodeUbbi(text) {
  return transformWords(text, w => preserveCase(w, w.replace(/ub(?=[aeiou])/gi, "")));
}

function decodeRovar(text) {
  return transformWords(text, w => preserveCase(
    w,
    w.toLowerCase().replace(/([bcdfghjklmnpqrstvwxyz])o\1/gi, "$1")
  ));
}

const COMMON = new Set([
  "a","i","hello","there","how","are","you","what","where","when","why","who",
  "the","this","that","we","they","he","she","it","is","am","was","were","be",
  "have","has","had","do","does","did","can","could","will","would","should",
  "go","come","want","like","yes","no","please","thanks","thank","good","bad",
  "day","night","morning","friend","school","house","home","dog","cat","fish",
  "food","water","game","secret","language","pig","latin","english","my","your",
  "our","their","to","from","in","on","at","for","with","and","or","but","not",
  "me","him","her","us","them","today","tomorrow","really","think","know","going",
  "doing","make","made","get","got","see","say","said"
]);

const CLUSTERS = [
  "str","spr","scr","spl","shr","thr","sch","ch","sh","th","ph","wh","qu",
  "tr","dr","br","cr","fr","gr","pr","bl","cl","fl","gl","pl","sl","sk",
  "sm","sn","sp","st","sw","b","c","d","f","g","h","j","k","l","m","n",
  "p","q","r","s","t","v","w","x","y","z"
];

function englishish(w) {
  let score = COMMON.has(w) ? 30 : 0;
  if (/[aeiou]/.test(w)) score += 2;
  if (!/^[^aeiou]{5,}/.test(w)) score += 2;
  if (!/[^aeiou]{5,}$/.test(w)) score += 2;
  return score;
}

function decodePigWord(word) {
  const original = word;
  const w = word.toLowerCase();

  if (w.endsWith("way") && w.length > 3) return preserveCase(original, w.slice(0,-3));
  if (w.endsWith("yay") && w.length > 3) return preserveCase(original, w.slice(0,-3));
  if (!w.endsWith("ay") || w.length < 3) return original;

  const stem = w.slice(0,-2);
  const guesses = [{ word: stem, score: englishish(stem) }];

  for (const cluster of CLUSTERS) {
    if (stem.endsWith(cluster) && stem.length > cluster.length) {
      const guess = cluster + stem.slice(0, -cluster.length);
      guesses.push({ word: guess, score: englishish(guess) + cluster.length * 0.2 });
    }
  }

  guesses.sort((a,b) => b.score - a.score);
  return preserveCase(original, guesses[0].word);
}

function decodePig(text) {
  return transformWords(text, decodePigWord);
}

function detectMode(text) {
  const t = text.toLowerCase();
  const count = re => (t.match(re) || []).length;

  const scores = {
    ob: count(/ob(?=[aeiou])/g) * 3.3,
    ubbi: count(/ub(?=[aeiou])/g) * 3.3,
    rovar: count(/([bcdfghjklmnpqrstvwxyz])o\1/g) * 3.8,
    pig: count(/\b[a-z]+(?:ay|way|yay)\b/g) * 3.0,
    normal: 1.5
  };

  const [mode, score] = Object.entries(scores).sort((a,b) => b[1]-a[1])[0];
  return mode !== "normal" && score >= 3 ? mode : "normal";
}

function decode(text, mode) {
  if (mode === "ob") return decodeOb(text);
  if (mode === "pig") return decodePig(text);
  if (mode === "ubbi") return decodeUbbi(text);
  if (mode === "rovar") return decodeRovar(text);
  return text;
}

function promptFor(mode) {
  const base = `Transcribe the sounds as literally as possible. The speaker may be using a children's secret language. Do not silently normalize unusual syllables into ordinary English. Return only the transcript.`;
  const details = {
    auto: `Possible languages: Ob language, Pig Latin, Ubbi Dubbi, Rovarspraket, or normal English. Preserve odd syllables and endings.`,
    ob: `Ob language is selected. Preserve inserted "ob" sounds. Example: "hobellobo" must remain "hobellobo", not "hello".`,
    pig: `Pig Latin is selected. Preserve endings such as "ay", "way", and "yay". Example: "ellohay" must remain "ellohay".`,
    ubbi: `Ubbi Dubbi is selected. Preserve inserted "ub" sounds. Example: "hubellubo" must remain "hubellubo".`,
    rovar: `Rovarspraket is selected. Preserve consonant-o-consonant patterns.`,
    normal: `The speaker is using normal English.`
  };
  return `${base}\n${details[mode] || details.auto}`;
}

function extensionFor(mime="") {
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "webm";
}

app.get("/api/health", (req,res) => {
  res.json({
    ok: true,
    version: "2.0.1-fixed",
    keyConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
});

app.post("/api/decode-text", (req,res) => {
  const text = String(req.body?.text || "").trim();
  let mode = String(req.body?.mode || "auto");
  if (!MODES.has(mode)) mode = "auto";

  if (!text) return res.status(400).json({ error: "No text was provided." });

  const actualMode = mode === "auto" ? detectMode(text) : mode;

  res.json({
    transcript: text,
    mode: actualMode,
    translation: decode(text, actualMode)
  });
});

app.post("/api/transcribe", upload.single("audio"), async (req,res) => {
  const temp = req.file?.path;

  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured in Render." });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No audio file reached the server." });
    }

    let mode = String(req.body?.mode || "auto");
    if (!MODES.has(mode)) mode = "auto";

    const bytes = await fs.promises.readFile(temp);

    const form = new FormData();
    form.append(
      "file",
      new Blob([bytes], { type: req.file.mimetype || "audio/webm" }),
      `speech.${extensionFor(req.file.mimetype)}`
    );
    form.append("model", process.env.TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
    form.append("language", "en");
    form.append("prompt", promptFor(mode));
    form.append("response_format", "json");

    const openaiResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: form
    });

    const raw = await openaiResp.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    if (!openaiResp.ok) {
      return res.status(openaiResp.status).json({
        error: data?.error?.message || data?.raw || `OpenAI returned HTTP ${openaiResp.status}.`
      });
    }

    const transcript = String(data?.text || "").trim();
    if (!transcript) {
      return res.status(422).json({ error: "The transcription service returned no text." });
    }

    const actualMode = mode === "auto" ? detectMode(transcript) : mode;

    return res.json({
      transcript,
      mode: actualMode,
      translation: decode(transcript, actualMode)
    });

  } catch (err) {
    console.error("Transcription route error:", err);
    return res.status(500).json({
      error: err?.message || "Unexpected transcription server error."
    });
  } finally {
    if (temp) fs.promises.unlink(temp).catch(() => {});
  }
});

app.use("/api", (req,res) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`,
    version: "2.0.1-fixed"
  });
});

/* Express 5-compatible catch-all route */
app.use((req,res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Secret Translator v2.0.1-fixed listening on ${PORT}`);
});
