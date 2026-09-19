import crypto from "node:crypto";

const MAIN_ORIGIN = process.env.MAIN_APP_URL || "https://soyperritoproproyt-iaoficial.vercel.app";
const OWNER = "SoyPerritoYT";
const REPO = "soyperritoproproyt-iaoficial";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", MAIN_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Vary", "Origin");
}
function verify(value) {
  const [payload, signature] = String(value || "").split(".");
  const secret = process.env.AUTH_GITHUB_SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET;
  if (!secret || !payload || !signature) throw new Error("Sesión GitHub no válida.");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Firma de sesión no válida.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!data.token || !data.login || !data.exp || Date.now() > data.exp) throw new Error("La sesión de GitHub ha caducado.");
  if (data.permission !== "write") throw new Error("La conexión de GitHub no tiene permiso de escritura.");
  return data;
}
function tokenFromCookie(req) {
  const m=req.headers.cookie?.match(/(?:^|; )github_token=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : "";
}
export default async function handler(req,res) {
  cors(res);
  if(req.method==="OPTIONS") return res.status(204).end();
  try {
    const auth=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
    const session=auth ? verify(auth) : null;
    const token=session?.token || tokenFromCookie(req);
    if(!token) return res.status(401).json({error:"GitHub no conectado."});
    const userResponse=await fetch("https://api.github.com/user",{headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"User-Agent":"SoyPerritoProProYT-IAOFICIAL"}});
    const user=await userResponse.json().catch(()=>({}));
    if(!userResponse.ok || !user.login) return res.status(401).json({error:"Sesión de GitHub no válida."});

    const body=typeof req.body==="string" ? JSON.parse(req.body||"{}") : (req.body||{});
    const action=String(body.action||"");
    const path=String(body.path||"").trim().replace(/^\/+/, "");
    if(!path || path.includes("..") || path.startsWith(".git/")) return res.status(400).json({error:"Ruta de archivo no válida."});
    if(path.startsWith("api/") || path.startsWith(".github/")) return res.status(403).json({error:"Por seguridad, el modo web no modifica backend ni workflows."});

    const url="https://api.github.com/repos/"+OWNER+"/"+REPO+"/contents/"+path.split("/").map(encodeURIComponent).join("/");
    const headers={"Accept":"application/vnd.github+json","Authorization":"Bearer "+token,"User-Agent":"SoyPerritoProProYT-IAOFICIAL"};

    if(action==="read"){
      const r=await fetch(url,{headers});
      const d=await r.json().catch(()=>({}));
      if(!r.ok) return res.status(r.status).json({error:d.message||"No se pudo leer el archivo."});
      const content=Buffer.from(d.content||"","base64").toString("utf8");
      return res.json({ok:true,path,content,sha:d.sha||null,login:user.login});
    }

    if(action==="write"){
      const current=await fetch(url,{headers});
      let sha=null;
      if(current.ok){const d=await current.json();sha=d.sha||null;}
      else if(current.status!==404){const d=await current.json().catch(()=>({}));return res.status(current.status).json({error:d.message||"No se pudo comprobar el archivo."});}
      const encoded=Buffer.from(String(body.content??""),"utf8").toString("base64");
      const payload={message:String(body.message||"Actualización desde SoyPerritoProProYT.IAOFICIAL").slice(0,200),content:encoded,branch:"main"};
      if(sha) payload.sha=sha;
      const r=await fetch(url,{method:"PUT",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)return res.status(r.status).json({error:d.message||"GitHub rechazó el cambio."});
      return res.json({ok:true,path,commit_sha:d.commit?.sha||null,login:user.login});
    }

    return res.status(400).json({error:"Acción no válida."});
  } catch(e) {
    return res.status(400).json({error:e.message||"No se pudo completar la operación."});
  }
}
