import crypto from "node:crypto";

const MAIN_ORIGIN = process.env.MAIN_APP_URL || "https://soyperritoproproyt-iaoficial.vercel.app";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", MAIN_ORIGIN);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function verify(value) {
  const [payload, signature] = String(value || "").split(".");
  const secret = process.env.AUTH_GITHUB_SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET;
  if (!secret || !payload || !signature) throw new Error("Sesión GitHub no válida.");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new Error("Firma de sesión no válida.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!data.token || !data.login || !data.exp || Date.now() > data.exp) throw new Error("La sesión de GitHub ha caducado.");
  return data;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    const auth = req.headers.authorization || "";
    const session = verify(auth.replace(/^Bearer\s+/i, ""));
    return res.status(200).json({connected:true, login:session.login, permission:session.permission || "read"});
  } catch (e) {
    return res.status(401).json({error:e.message || "Sesión no válida."});
  }
}
