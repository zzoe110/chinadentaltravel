/**
 * CloudFlare Pages Function —— Decap CMS GitHub OAuth 代理（第 1 步：重定向到 GitHub 授权）
 *
 * Decap 的 Github 后端（NetlifyAuthenticator）会请求：
 *   {base_url}/{auth_endpoint}?provider=github&site_id=...&scope=repo
 * 这里把它重定向到 GitHub 的 OAuth 授权页，并下发 state Cookie 防 CSRF。
 */

const CLIENT_ID = "Ov23liZ4KQmeU2o1YdyW"; // GitHub OAuth App 的 Client ID（非机密）
const REDIRECT_URI = "https://www.chinadentaltravel.com/api/callback";

export async function onRequest(context) {
  const state = crypto.randomUUID();

  const githubAuthUrl =
    "https://github.com/login/oauth/authorize?" +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      state: state,
      scope: "repo",
    }).toString();

  return new Response(null, {
    status: 302,
    headers: {
      Location: githubAuthUrl,
      // HttpOnly + SameSite=Lax：仅用于回跳时校验，不被 JS 读取
      "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}
