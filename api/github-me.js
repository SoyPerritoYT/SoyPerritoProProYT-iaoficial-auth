export default async function handler(req, res) {
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
  return res.status(200).json({
    connected: true,
    login: user.login,
    name: user.name || null,
    avatar_url: user.avatar_url || null
  });
}