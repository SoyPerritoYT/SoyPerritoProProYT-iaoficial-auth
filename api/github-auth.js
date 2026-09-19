import crypto from "node:crypto";

function cookie(name, value, options = {}) {
  const parts = [name + "=" + encodeURIComponent(value)];
  if (options.maxAge !== undefined) parts.push("Max-Age=" + options.maxAge);
  parts.push("Path=/");
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push("SameSite=" + options.sameSite);
  return parts.join("; ");
}

function baseUrl(req) {
  return process.env.AUTH_BASE_URL || `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}`;
}

function signSession(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const secret = process.env.GITHUB_CLIENT_SECRET;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return payload + "." + signature;
}

export default async function handler(req, res) {
  const { code, state, action, error, permission } = req.query || {};
  const origin = baseUrl(req);
  const callback = origin + "/api/github-auth";
  const mainUrl = process.env.MAIN_APP_URL || "https://soyperritoproproyt-iaoficial.vercel.app/";

  if (error) return res.redirect(mainUrl + "?github_error=" + encodeURIComponent(String(error)));

  if (action === "login") {
    const selectedPermission = permission === "write" ? "write" : "read";
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) return res.status(500).send("Falta GITHUB_CLIENT_ID en Vercel.");

    const stateValue = crypto.randomBytes(32).toString("hex");
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", callback);
    authUrl.searchParams.set("scope", selectedPermission === "write" ? "public_repo" : "read:user");
    authUrl.searchParams.set("state", stateValue);

    res.setHeader("Set-Cookie", [
      cookie("github_oauth_state", stateValue, {maxAge:600,httpOnly:true,secure:true,sameSite:"Lax"}),
      cookie("github_oauth_permission", selectedPermission, {maxAge:600,httpOnly:true,secure:true,sameSite:"Lax"})
    ]);
    return res.redirect(authUrl.toString());
  }

  if (!code || !state) return res.status(400).send("Falta el código o el estado de autorización.");

  const stateCookie = req.headers.cookie?.match(/(?:^|; )github_oauth_state=([^;]*)/)?.[1];
  const expectedState = stateCookie ? decodeURIComponent(stateCookie) : "";
  if (!expectedState || state !== expectedState) return res.status(400).send("Estado OAuth no válido. Vuelve a iniciar la conexión.");

  const permissionCookie = req.headers.cookie?.match(/(?:^|; )github_oauth_permission=([^;]*)/)?.[1];
  const selectedPermission = permissionCookie === "write" ? "write" : "read";

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(500).send("Configura GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET en Vercel.");

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method:"POST",
    headers:{"Accept":"application/json","Content-Type":"application/json"},
    body:JSON.stringify({client_id:clientId,client_secret:clientSecret,code,redirect_uri:callback})
  });
  const token = await tokenResponse.json();
  if (!token.access_token) return res.status(401).send("GitHub no devolvió un token válido.");

  const userResponse = await fetch("https://api.github.com/user", {
    headers:{"Accept":"application/vnd.github+json","Authorization":"Bearer "+token.access_token,"User-Agent":"SoyPerritoProProYT-IAOFICIAL"}
  });
  const user = await userResponse.json();
  if (!user.login) return res.status(401).send("No se pudo obtener la cuenta de GitHub.");

  const session = signSession({
    token: token.access_token,
    login: user.login,
    permission: selectedPermission,
    exp: Date.now() + 3600000
  });

  res.setHeader("Set-Cookie", [
    cookie("github_token", token.access_token, {maxAge:3600,httpOnly:true,secure:true,sameSite:"None"}),
    cookie("github_permission", selectedPermission, {maxAge:3600,httpOnly:true,secure:true,sameSite:"None"}),
    cookie("github_oauth_state", "", {maxAge:0,httpOnly:true,secure:true,sameSite:"Lax"}),
    cookie("github_oauth_permission", "", {maxAge:0,httpOnly:true,secure:true,sameSite:"Lax"})
  ]);

  return res.redirect(mainUrl + "?github=connected&github_login=" + encodeURIComponent(user.login) + "&github_session=" + encodeURIComponent(session));
}
