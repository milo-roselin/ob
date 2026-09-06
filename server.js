import express from "express";
import multer from "multer";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
const __filename=fileURLToPath(import.meta.url); const __dirname=path.dirname(__filename);
const app=express(); const PORT=process.env.PORT||10000;
const upload=multer({dest:os.tmpdir(),limits:{fileSize:20*1024*1024}});
app.use(express.json({limit:"1mb"})); app.use(express.static(path.join(__dirname,"public")));
const MODES=new Set(["auto","ob","pig","ubbi","rovar","normal"]);
function pc(o,r){if(!o)return r;if(o===o.toUpperCase())return r.toUpperCase();if(o[0]===o[0].toUpperCase())return r[0].toUpperCase()+r.slice(1).toLowerCase();return r.toLowerCase()}
function words(t,f){return t.replace(/[A-Za-zÀ-ÖØ-öø-ÿ']+/g,f)}
function ob(t){return words(t,w=>pc(w,w.replace(/ob(?=[aeiou])/gi,"")))}
function ubbi(t){return words(t,w=>pc(w,w.replace(/ub(?=[aeiou])/gi,"")))}
function rovar(t){return words(t,w=>pc(w,w.toLowerCase().replace(/([bcdfghjklmnpqrstvwxyz])o\\1/gi,"$1")))}
function pig(t){return words(t,w=>{const x=w.toLowerCase();if(x.endsWith('way')&&x.length>3)return pc(w,x.slice(0,-3));if(x.endsWith('yay')&&x.length>3)return pc(w,x.slice(0,-3));if(x.endsWith('ay')&&x.length>2)return pc(w,x.slice(0,-2));return w})}
function detect(t){t=t.toLowerCase();const c=r=>(t.match(r)||[]).length;const s={ob:c(/ob(?=[aeiou])/g)*3.3,ubbi:c(/ub(?=[aeiou])/g)*3.3,rovar:c(/([bcdfghjklmnpqrstvwxyz])o\\1/g)*3.8,pig:c(/\\b[a-z]+(?:ay|way|yay)\\b/g)*3,normal:1.5};const [m,v]=Object.entries(s).sort((a,b)=>b[1]-a[1])[0];return m!=="normal"&&v>=3?m:"normal"}
function decode(t,m){if(m==='ob')return ob(t);if(m==='pig')return pig(t);if(m==='ubbi')return ubbi(t);if(m==='rovar')return rovar(t);return t}
function prompt(mode){const base='Transcribe sounds as literally as possible. This may be a secret language. Do not silently normalize unusual syllables into English. Return only the transcript.';const x={auto:'Possible languages: Ob, Pig Latin, Ubbi Dubbi, Rovarspraket, or normal English. Preserve odd syllables and endings.',ob:'Ob is selected. Preserve inserted ob sounds. hobellobo must remain hobellobo.',pig:'Pig Latin is selected. Preserve ay, way, and yay endings.',ubbi:'Ubbi Dubbi is selected. Preserve inserted ub sounds.',rovar:'Rovarspraket is selected. Preserve consonant-o-consonant patterns.',normal:'Normal English is selected.'};return base+'\\n'+(x[mode]||x.auto)}
function ext(m=''){if(m.includes('mp4'))return'm4a';if(m.includes('webm'))return'webm';if(m.includes('ogg'))return'ogg';if(m.includes('wav'))return'wav';return'webm'}
app.get('/api/health',(req,res)=>res.json({ok:true,version:'2.0.0-fixed',keyConfigured:Boolean(process.env.OPENAI_API_KEY)}));
function handleText(req,res){const text=String(req.body?.text||'').trim();let mode=String(req.body?.mode||'auto');if(!MODES.has(mode))mode='auto';if(!text)return res.status(400).json({error:'No text was provided.'});const actual=mode==='auto'?detect(text):mode;res.json({transcript:text,mode:actual,translation:decode(text,actual)})}
app.post('/api/decode-text',handleText); app.post('/decode-text',handleText);
async function handleTranscribe(req,res){const temp=req.file?.path;try{if(!process.env.OPENAI_API_KEY)return res.status(500).json({error:'OPENAI_API_KEY is not configured in Render.'});if(!req.file)return res.status(400).json({error:'No audio file reached the server.'});let mode=String(req.body?.mode||'auto');if(!MODES.has(mode))mode='auto';const bytes=await fs.promises.readFile(temp);const form=new FormData();form.append('file',new Blob([bytes],{type:req.file.mimetype||'audio/webm'}),`speech.${ext(req.file.mimetype)}`);form.append('model',process.env.TRANSCRIBE_MODEL||'gpt-4o-mini-transcribe');form.append('language','en');form.append('prompt',prompt(mode));form.append('response_format','json');const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},body:form});const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={raw}}if(!r.ok)return res.status(r.status).json({error:data?.error?.message||data?.raw||`OpenAI returned HTTP ${r.status}`});const transcript=String(data?.text||'').trim();if(!transcript)return res.status(422).json({error:'The transcription service returned no text.'});const actual=mode==='auto'?detect(transcript):mode;res.json({transcript,mode:actual,translation:decode(transcript,actual)})}catch(e){console.error(e);res.status(500).json({error:e?.message||'Unexpected transcription server error.'})}finally{if(temp)fs.promises.unlink(temp).catch(()=>{})}}
app.post('/api/transcribe',upload.single('audio'),handleTranscribe); app.post('/transcribe',upload.single('audio'),handleTranscribe);
app.use('/api',(req,res)=>res.status(404).json({error:`API route not found: ${req.method} ${req.originalUrl}`,version:'2.0.0-fixed'}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,'0.0.0.0',()=>console.log(`Secret Translator fixed listening on ${PORT}`));
