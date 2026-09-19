const MAIN_APP = "https://soyperritoproproyt-iaoficial.vercel.app";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", MAIN_APP);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Vary", "Origin");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const token = req.headers.cookie?.match(/(?:^|; )github_token=([^;]*)/)?.[1];
  if (!token) return res.status(200).json({ connected: false });

  const response = await fetch("https://api.github.com/user", {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + decodeURIComponent(token),
      "User-Agent": "SoyPerritoProProYT-IAOFICIAL"
    }
  });

  if (!response.ok) return res.status(200).json({ connected: false });

  const user = await response.json();
  const permission = req.headers.cookie?.match(/(?:^|; )github_permission=([^;]*)/)?.[1] || "read";

  return res.status(200).json({
    connected: true,
    login: user.login,
    name: user.name || null,
    avatar_url: user.avatar_url || null,
    permission
  });
}
