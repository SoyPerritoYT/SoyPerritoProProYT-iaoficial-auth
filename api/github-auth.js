export default async function handler(req, res) {
  const { code, state, action } = req.query || {};
  if (action === 'login') {
    const clientId = process.env.GITHUB_CLIENT_ID;
    if (!clientId) return res.status(500).send('Falta GITHUB_CLIENT_ID.');
    const callback = `${process.env.AUTH_BASE_URL || ''}/api/github-auth`;
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callback);
    url.searchParams.set('scope', 'read:user');
    url.searchParams.set('state', state || '');
    return res.redirect(url.toString());
  }
  if (!code) return res.status(400).send('Falta el código de autorización.');
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(500).send('Configura GITHUB_CLIENT_ID y GITHUB_CLIENT_SECRET en Vercel.');
  const callback = `${process.env.AUTH_BASE_URL || ''}/api/github-auth`;
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method:'POST',
    headers:{'Accept':'application/json','Content-Type':'application/json'},
    body:JSON.stringify({client_id:clientId,client_secret:clientSecret,code,redirect_uri:callback})
  });
  const token=await tokenResponse.json();
  if (!token.access_token) return res.status(401).send('GitHub no devolvió un token válido.');
  const userResponse=await fetch('https://api.github.com/user',{headers:{'Accept':'application/vnd.github+json','Authorization':'Bearer '+token.access_token,'User-Agent':'SoyPerritoProProYT-IAOFICIAL'}});
  const user=await userResponse.json();
  if (!user.login) return res.status(401).send('No se pudo obtener la cuenta de GitHub.');
  const safeState=state ? decodeURIComponent(atob(state)) : '/';
  const destination=new URL(safeState, process.env.AUTH_BASE_URL || 'http://localhost');
  destination.searchParams.set('github','connected');
  destination.searchParams.set('github_user',user.login);
  res.setHeader('Set-Cookie',`github_token=${encodeURIComponent(token.access_token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`);
  return res.redirect(destination.toString());
}