import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PROFILE_VERSION = 7;
const GIST_DESCRIPTION = "Secret Translator - Shared Adaptive Learning Store";
const GIST_FILENAME = "secret-translator-shared-learning.json";
const GH_API_VERSION = "2026-03-10";

let cachedGistId = process.env.GITHUB_GIST_ID || "";
let writeQueue = Promise.resolve();
let memoryStore = defaultStore();

function ghHeaders(){
  return {
    "Accept":"application/vnd.github+json",
    "Authorization":`Bearer ${process.env.GITHUB_GIST_TOKEN || ""}`,
    "X-GitHub-Api-Version":GH_API_VERSION,
    "User-Agent":"secret-translator-shared-learning"
  };
}

function defaultProfile(){
  return {
    version:PROFILE_VERSION,
    uses:0,
    confirmed:0,
    examples:[],
    acousticExamples:[],
    phonePairs:{},
    bigrams:{},
    seeded:false
  };
}

function defaultStore(){
  return {version:1,updatedAt:new Date(0).toISOString(),profile:defaultProfile()};
}

function cleanNumber(n,min=0,max=1e9){
  n=Number(n);
  return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min;
}

function sanitizeProfile(input){
  const p=input&&typeof input==="object"?input:{};
  const out=defaultProfile();
  if(Number(p.version)!==PROFILE_VERSION)return out;

  out.seeded=Boolean(p.seeded);
  out.uses=cleanNumber(p.uses,0,1e7);
  out.confirmed=cleanNumber(p.confirmed,0,1e7);

  const examples=Array.isArray(p.examples)?p.examples:[];
  for(const ex of examples.slice(0,700)){
    if(!ex||typeof ex!=="object")continue;
    const word=String(ex.word||"").toLowerCase().replace(/[^a-z']/g,"").slice(0,40);
    const phones=Array.isArray(ex.phones)
      ?ex.phones.map(x=>String(x).slice(0,12)).filter(Boolean).slice(0,50)
      :[];
    if(!word||!phones.length)continue;
    out.examples.push({
      word,
      phones,
      weight:cleanNumber(ex.weight,.01,50),
      confirmed:Boolean(ex.confirmed),
      seed:Boolean(ex.seed),
      time:cleanNumber(ex.time,0,9e15)
    });
  }


  const acoustic=Array.isArray(p.acousticExamples)?p.acousticExamples:[];
  for(const ex of acoustic.slice(0,80)){
    if(!ex||typeof ex!=="object")continue;
    const id=String(ex.id||"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,100);
    const word=String(ex.word||"").toLowerCase().replace(/[^a-z']/g,"").slice(0,40);
    const dims=Math.max(1,Math.min(20,Math.round(Number(ex.dims)||13)));
    const frameCount=Math.max(0,Math.min(320,Math.round(Number(ex.frameCount)||0)));
    const maxVals=Math.min(6400,frameCount*dims);
    const q=Array.isArray(ex.q)
      ?ex.q.slice(0,maxVals).map(v=>Math.max(-127,Math.min(127,Math.round(Number(v)||0))))
      :[];

    if(!id||!word||frameCount<4||q.length!==frameCount*dims)continue;

    out.acousticExamples.push({
      id,word,dims,frameCount,q,
      duration:cleanNumber(ex.duration,.05,8),
      weight:cleanNumber(ex.weight,.01,50),
      confirmed:Boolean(ex.confirmed),
      seed:Boolean(ex.seed),
      time:cleanNumber(ex.time,0,9e15),
      source:String(ex.source||"").slice(0,80)
    });
  }

  for(const [k,v] of Object.entries(p.phonePairs||{}).slice(0,5000)){
    const key=String(k).slice(0,60);
    if(key)out.phonePairs[key]=cleanNumber(v,0,1e6);
  }
  for(const [k,v] of Object.entries(p.bigrams||{}).slice(0,5000)){
    const key=String(k).slice(0,100);
    if(key)out.bigrams[key]=cleanNumber(v,0,1e6);
  }
  return out;
}

function exampleKey(ex){
  return `${ex.word}|${ex.phones.join(" ")}`;
}

function mergeProfiles(a,b){
  const left=sanitizeProfile(a),right=sanitizeProfile(b),out=defaultProfile();

  out.seeded=left.seeded||right.seeded;
  out.uses=Math.max(left.uses,right.uses);
  out.confirmed=Math.max(left.confirmed,right.confirmed);

  const examples=new Map();
  for(const ex of [...left.examples,...right.examples]){
    const key=exampleKey(ex),old=examples.get(key);
    if(!old)examples.set(key,{...ex});
    else{
      old.weight=Math.max(old.weight,ex.weight);
      old.confirmed=old.confirmed||ex.confirmed;
      old.seed=old.seed||ex.seed;
      old.time=Math.max(old.time,ex.time);
    }
  }
  out.examples=[...examples.values()]
    .sort((x,y)=>Number(y.confirmed)-Number(x.confirmed)||y.weight-x.weight||y.time-x.time)
    .slice(0,520);


  const acoustic=new Map();
  for(const ex of [...left.acousticExamples,...right.acousticExamples]){
    const old=acoustic.get(ex.id);
    if(!old)acoustic.set(ex.id,{...ex});
    else{
      old.weight=Math.max(old.weight,ex.weight);
      old.confirmed=old.confirmed||ex.confirmed;
      old.seed=old.seed||ex.seed;
      old.time=Math.max(old.time,ex.time);
    }
  }
  out.acousticExamples=[...acoustic.values()]
    .sort((x,y)=>Number(y.confirmed)-Number(x.confirmed)||y.weight-x.weight||y.time-x.time)
    .slice(0,64);

  for(const src of [left.phonePairs,right.phonePairs]){
    for(const [k,v] of Object.entries(src)){
      out.phonePairs[k]=Math.max(out.phonePairs[k]||0,v);
    }
  }
  for(const src of [left.bigrams,right.bigrams]){
    for(const [k,v] of Object.entries(src)){
      out.bigrams[k]=Math.max(out.bigrams[k]||0,v);
    }
  }
  return out;
}

async function ghFetch(url,options={}){
  if(!process.env.GITHUB_GIST_TOKEN){
    const err=new Error("GITHUB_GIST_TOKEN is not configured.");
    err.code="NO_GIST_TOKEN";
    throw err;
  }

  const resp=await fetch(url,{
    ...options,
    headers:{...ghHeaders(),...(options.headers||{})}
  });

  const raw=await resp.text();
  let data=null;
  try{data=raw?JSON.parse(raw):null}catch{data=raw}

  if(!resp.ok){
    throw new Error(data?.message||data?.error||(typeof data==="string"?data:`GitHub returned ${resp.status}`));
  }
  return data;
}

async function findOrCreateGist(){
  if(cachedGistId)return cachedGistId;

  for(let page=1;page<=10;page++){
    const list=await ghFetch(`https://api.github.com/gists?per_page=100&page=${page}`);
    if(!Array.isArray(list)||!list.length)break;

    const hit=list.find(g=>
      g?.description===GIST_DESCRIPTION &&
      g?.files &&
      Object.prototype.hasOwnProperty.call(g.files,GIST_FILENAME)
    );

    if(hit?.id){
      cachedGistId=hit.id;
      return cachedGistId;
    }
    if(list.length<100)break;
  }

  const created=await ghFetch("https://api.github.com/gists",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      description:GIST_DESCRIPTION,
      public:false,
      files:{[GIST_FILENAME]:{content:JSON.stringify(defaultStore(),null,2)}}
    })
  });

  cachedGistId=created.id;
  return cachedGistId;
}

async function readStore(){
  const id=await findOrCreateGist();
  const gist=await ghFetch(`https://api.github.com/gists/${id}`);
  const file=gist?.files?.[GIST_FILENAME];
  if(!file)return defaultStore();

  let text=file.content||"";
  if(file.truncated&&file.raw_url){
    const resp=await fetch(file.raw_url,{headers:ghHeaders()});
    if(!resp.ok)throw new Error(`Could not read shared-learning gist (${resp.status}).`);
    text=await resp.text();
  }

  try{
    const parsed=JSON.parse(text);
    return {
      version:1,
      updatedAt:String(parsed?.updatedAt||new Date(0).toISOString()),
      profile:sanitizeProfile(parsed?.profile)
    };
  }catch{
    return defaultStore();
  }
}

async function writeStore(store){
  const id=await findOrCreateGist();
  const clean={
    version:1,
    updatedAt:new Date().toISOString(),
    profile:sanitizeProfile(store?.profile)
  };

  const content=JSON.stringify(clean,null,2);
  if(Buffer.byteLength(content,"utf8")>900000){
    throw new Error("Shared learning store is too large.");
  }

  await ghFetch(`https://api.github.com/gists/${id}`,{
    method:"PATCH",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({files:{[GIST_FILENAME]:{content}}})
  });

  return clean;
}

app.get("/api/health",(req,res)=>{
  res.json({
    ok:true,
    version:"13-raw-audio-learning",
    sharedLearningConfigured:true,
    sharedLearningStorage:process.env.GITHUB_GIST_TOKEN?"gist":"memory" 
  });
});

app.get("/api/learning",async (req,res)=>{
  try{
    res.set("Cache-Control","no-store");

    if(!process.env.GITHUB_GIST_TOKEN){
      return res.json({
        ok:true,
        profile:memoryStore.profile,
        updatedAt:memoryStore.updatedAt,
        storage:"memory"
      });
    }

    const store=await readStore();
    memoryStore={
      version:1,
      updatedAt:store.updatedAt,
      profile:mergeProfiles(memoryStore.profile,store.profile)
    };

    res.json({
      ok:true,
      profile:memoryStore.profile,
      updatedAt:memoryStore.updatedAt,
      storage:"gist"
    });
  }catch(err){
    console.error("GET /api/learning",err);

    // If durable storage has a temporary problem, keep cross-device learning
    // alive using the server process memory.
    res.set("Cache-Control","no-store");
    res.json({
      ok:true,
      profile:memoryStore.profile,
      updatedAt:memoryStore.updatedAt,
      storage:"memory",
      warning:err?.message||"Durable shared storage unavailable."
    });
  }
});

app.put("/api/learning",(req,res)=>{
  const incoming=sanitizeProfile(req.body?.profile);

  writeQueue=writeQueue
    .catch(()=>{})
    .then(async()=>{
      memoryStore={
        version:1,
        updatedAt:new Date().toISOString(),
        profile:mergeProfiles(memoryStore.profile,incoming)
      };

      if(!process.env.GITHUB_GIST_TOKEN){
        return {...memoryStore,storage:"memory"};
      }

      try{
        const current=await readStore();
        const merged=mergeProfiles(
          mergeProfiles(current.profile,memoryStore.profile),
          incoming
        );
        const saved=await writeStore({profile:merged});

        memoryStore={
          version:1,
          updatedAt:saved.updatedAt,
          profile:saved.profile
        };

        return {...saved,storage:"gist"};
      }catch(err){
        console.error("Durable shared-learning save failed; using memory fallback",err);
        return {
          ...memoryStore,
          storage:"memory",
          warning:err?.message||"Durable storage unavailable."
        };
      }
    });

  writeQueue
    .then(saved=>{
      res.set("Cache-Control","no-store");
      res.json({
        ok:true,
        profile:saved.profile,
        updatedAt:saved.updatedAt,
        storage:saved.storage||"memory",
        warning:saved.warning
      });
    })
    .catch(err=>{
      console.error("PUT /api/learning",err);
      res.status(500).json({error:err?.message||"Could not save shared learning."});
    });
});

app.use("/api",(req,res)=>{
  res.status(404).json({error:`API route not found: ${req.method} ${req.originalUrl}`});
});

app.use((req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(PORT,"0.0.0.0",()=>{
  console.log(`Secret Translator v11 listening on ${PORT}`);
});
