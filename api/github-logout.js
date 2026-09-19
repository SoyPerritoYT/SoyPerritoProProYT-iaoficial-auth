export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://soyperritoproproyt-iaoficial.vercel.app"); res.setHeader("Access-Control-Allow-Credentials", "true"); res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS"); if (req.method === "OPTIONS") return res.status(204).end(); if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  res.setHeader("Set-Cookie", "github_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=None");
  return res.status(200).json({ ok: true });
}