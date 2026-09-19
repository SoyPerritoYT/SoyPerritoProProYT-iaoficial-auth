import crypto from "node:crypto";

const ALLOWED_ORIGIN = process.env.MAIN_APP_URL || "https://soyperritoproproyt-iaoficial.vercel.app";
const OWNER = "SoyPerritoYT";
const REPO = "soyperritoproproyt-iaoficial";

function decryptSession(session) {
  const [version, iv64, tag64, data64] = String(session || "").split(".");
  if (version !== "v1" || !iv64 || !tag64 || !data64) throw new Error("Sesión de GitHub no válida.");
  const secretBase = process.env.AUTH_GITHUB_SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET;
  if (!secretBase) throw new Error("Falta AUTH_GITHUB_SESSION_SECRET o GITHUB_CLIENT_SECRET.");
  const key = crypto.createHash("sha256").update(secretBase).digest();
  const iv = Buffer.from(iv64, "base64url");
  const tag = Buffer.from(tag64, "base64url");
  const encrypted = Buffer.from(data64, "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
}

function send(res, status, body) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST") return send(res, 405, { error: "Método no permitido." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const session = decryptSession(body.session);
    if (!session.token || !session.login || Number(session.exp) < Date.now()) {
      return send(res, 401, { error: "La sesión de GitHub ha caducado." });
    }
    if (session.permission !== "write") return send(res, 403, { error: "Esta conexión solo tiene permisos de lectura." });
    if (session.login.toLowerCase() !== "soyperritoyt") return send(res, 403, { error: "Esta cuenta no está autorizada para este repositorio." });

    const path = String(body.path || "").replace(/^\/+/, "").trim();
    if (!path || path.includes("..")) return send(res, 400, { error: "Ruta de archivo no válida." });

    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + session.token,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "SoyPerritoProProYT-IAOFICIAL"
    };

    if (body.action === "read") {
      const r = await fetch("https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/" + path, { headers });
      const d = await r.json();
      if (!r.ok) return send(res, r.status, { error: d.message || "No se pudo leer el archivo." });
      if (Array.isArray(d)) return send(res, 400, { error: "La ruta apunta a una carpeta, no a un archivo." });
      const content = Buffer.from(String(d.content || "").replace(/\n/g, ""), "base64").toString("utf8");
      return send(res, 200, { ok: true, login: session.login, path, sha: d.sha, content });
    }

    if (body.action === "write") {
      const content = String(body.content ?? "");
      if (content.length > 1000000) return send(res, 413, { error: "El archivo es demasiado grande (máximo 1 MB)." });

      const current = await fetch("https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/" + path, { headers });
      const currentData = await current.json();
      const payload = {
        message: String(body.message || "Actualización desde SoyPerritoProProYT.IAOFICIAL"),
        content: Buffer.from(content, "utf8").toString("base64")
      };
      if (current.ok && currentData.sha) payload.sha = currentData.sha;

      const r = await fetch("https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/" + path, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const d = await r.json();
      if (!r.ok) return send(res, r.status, { error: d.message || "GitHub rechazó el cambio." });
      return send(res, 200, { ok: true, login: session.login, path, commit: d.commit?.sha || null });
    }

    return send(res, 400, { error: "Acción desconocida. Usa read o write." });
  } catch (error) {
    return send(res, 500, { error: error?.message || "Error del modo GitHub." });
  }
}
