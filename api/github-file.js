import crypto from "node:crypto";

const MAIN_ORIGIN = process.env.MAIN_APP_URL || "https://soyperritoproproyt-iaoficial.vercel.app";
const OWNER = "SoyPerritoYT";
const REPO = "soyperritoproproyt-iaoficial";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", MAIN_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
}

function verify(value) {
  const [payload, signature] = String(value || "").split(".");
  const secret = process.env.AUTH_GITHUB_SESSION_SECRET;
  if (!secret || !payload || !signature) throw new Error("Sesión GitHub no válida.");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Firma de sesión no válida.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!data.token || !data.login || !data.exp || Date.now() > data.exp) throw new Error("La sesión de GitHub ha caducado.");
  if (data.permission !== "write") throw new Error("La conexión de GitHub no tiene permiso de escritura.");
  return data;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const session = verify((req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const path = String(body.path || "").trim().replace(/^\/+/, "");
    const content = String(body.content ?? "");
    const message = String(body.message || "Actualización desde SoyPerritoProProYT.IAOFICIAL").trim().slice(0, 200);
    if (!path || path.includes("..") || path.startsWith(".git/")) throw new Error("Ruta de archivo no válida.");
    const base = "https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/" + path.split("/").map(encodeURIComponent).join("/");
    const headers = {"Accept":"application/vnd.github+json","Authorization":"Bearer " + session.token,"User-Agent":"SoyPerritoProProYT-IAOFICIAL"};
    let currentSha = null;
    const current = await fetch(base, {headers});
    if (current.ok) {
      const data = await current.json();
      currentSha = data.sha || null;
    } else if (current.status !== 404) {
      const text = await current.text();
      throw new Error("GitHub no pudo leer el archivo: " + text.slice(0, 200));
    }
    const encoded = Buffer.from(content, "utf8").toString("base64");
    const payload = {message, content:encoded, branch:"main"};
    if (currentSha) payload.sha = currentSha;
    const putResponse = await fetch(base, {method:"PUT", headers:{...headers,"Content-Type":"application/json"}, body:JSON.stringify(payload)});
    const result = await putResponse.json().catch(()=>({}));
    if (!putResponse.ok) throw new Error(result.message || "GitHub rechazó la modificación.");
    return res.status(200).json({ok:true, path, commit:result.commit?.sha || null, login:session.login});
  } catch (e) {
    return res.status(400).json({error:e.message || "No se pudo modificar el archivo."});
  }
}
