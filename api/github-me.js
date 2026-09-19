import crypto from "node:crypto";

const MAIN_APP = process.env.MAIN_APP_URL || "https://soyperritoproproyt-iaoficial.vercel.app";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", MAIN_APP);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Vary", "Origin");
}

function verifySession(value) {
  const [payload, signature] = String(value || "").split(".");
  const secret = process.env.AUTH_GITHUB_SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET;
  if (!secret || !payload || !signature) throw new Error("Sesión no válida.");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Firma no válida.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!data.token || !data.login || !data.exp || Date.now() > data.exp) throw new Error("Sesión caducada.");
  return data;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    let token = "";
    let permission = "read";
    let loginFromSession = "";

    if (bearer) {
      const session = verifySession(bearer);
      token = session.token;
      permission = session.permission || "read";
      loginFromSession = session.login;
    } else {
      const raw = req.headers.cookie?.match(/(?:^|; )github_token=([^;]*)/)?.[1];
      token = raw ? decodeURIComponent(raw) : "";
      permission = req.headers.cookie?.match(/(?:^|; )github_permission=([^;]*)/)?.[1] || "read";
    }

    if (!token) return res.status(200).json({ connected: false });

    const response = await fetch("https://api.github.com/user", {
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + token,
        "User-Agent": "SoyPerritoProProYT-IAOFICIAL"
      }
    });

    if (!response.ok) return res.status(200).json({ connected: false });

    const user = await response.json();
    return res.status(200).json({
      connected: true,
      login: user.login || loginFromSession,
      name: user.name || null,
      avatar_url: user.avatar_url || null,
      permission
    });
  } catch {
    return res.status(200).json({ connected: false });
  }
}
