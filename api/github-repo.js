const MAIN_APP = "https://soyperritoproproyt-iaoficial.vercel.app";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", MAIN_APP);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,OPTIONS");
  res.setHeader("Vary", "Origin");
}

function getToken(req) {
  return req.headers.cookie?.match(/(?:^|; )github_token=([^;]*)/)?.[1]
    ? decodeURIComponent(req.headers.cookie.match(/(?:^|; )github_token=([^;]*)/)?.[1])
    : "";
}

function getPermission(req) {
  return req.headers.cookie?.match(/(?:^|; )github_permission=([^;]*)/)?.[1] || "read";
}

function apiHeaders(token) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": "Bearer " + token,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "SoyPerritoProProYT-IAOFICIAL"
  };
}

function cleanRepo(value) {
  const s = String(value || "").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(s)) return null;
  if (!s.startsWith("SoyPerritoYT/")) return null;
  return s;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "GitHub no está conectado." });

  const me = await fetch("https://api.github.com/user", { headers: apiHeaders(token) });
  if (!me.ok) return res.status(401).json({ error: "La sesión de GitHub ha caducado." });
  const user = await me.json();
  if (user.login !== "SoyPerritoYT") {
    return res.status(403).json({ error: "Esta IA está limitada a la cuenta SoyPerritoYT." });
  }

  const permission = getPermission(req);
  const { repo, path, branch = "main" } = req.query || {};
  const repository = cleanRepo(repo) || "SoyPerritoYT/soyperritoproproyt-iaoficial";

  if (req.method === "GET") {
    const url = "https://api.github.com/repos/" + repository + "/contents/" + String(path || "").split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(branch);
    const r = await fetch(url, { headers: apiHeaders(token) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: data.message || "No se pudo leer el archivo." });
    return res.status(200).json({
      name: data.name,
      path: data.path,
      sha: data.sha,
      type: data.type,
      size: data.size,
      content: data.content || null,
      encoding: data.encoding || null,
      html_url: data.html_url || null
    });
  }

  if (req.method === "PUT") {
    if (permission !== "write") return res.status(403).json({ error: "Conecta GitHub con permiso para crear y modificar archivos." });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const filePath = String(body.path || path || "").trim();
    const content = String(body.content ?? "");
    const commitMessage = String(body.message || "Actualizar desde SoyPerritoProProYT.IAOFICIAL");
    const targetBranch = String(body.branch || branch || "main");

    if (!filePath) return res.status(400).json({ error: "Falta la ruta del archivo." });
    if (filePath.startsWith(".git/") || filePath.includes("..")) return res.status(400).json({ error: "Ruta no permitida." });

    const base = "https://api.github.com/repos/" + repository + "/contents/" + filePath.split("/").map(encodeURIComponent).join("/");
    let currentSha = body.sha || null;

    if (!currentSha) {
      const existing = await fetch(base + "?ref=" + encodeURIComponent(targetBranch), { headers: apiHeaders(token) });
      if (existing.ok) {
        const existingData = await existing.json();
        currentSha = existingData.sha;
      } else if (existing.status !== 404) {
        const errorData = await existing.json().catch(() => ({}));
        return res.status(existing.status).json({ error: errorData.message || "No se pudo comprobar el archivo." });
      }
    }

    const payload = {
      message: commitMessage,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch: targetBranch
    };
    if (currentSha) payload.sha = currentSha;

    const r = await fetch(base, {
      method: "PUT",
      headers: { ...apiHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: data.message || "GitHub no pudo guardar el archivo." });

    return res.status(200).json({
      ok: true,
      path: data.content?.path || filePath,
      sha: data.content?.sha || null,
      commit: data.commit?.html_url || null
    });
  }

  return res.status(405).json({ error: "Método no permitido." });
}
