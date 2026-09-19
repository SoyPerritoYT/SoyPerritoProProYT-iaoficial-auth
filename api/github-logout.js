export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido." });
  res.setHeader("Set-Cookie", "github_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax");
  return res.status(200).json({ ok: true });
}