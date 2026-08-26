/**
 * CloudFlare Pages Function —— Decap CMS GitHub OAuth 代理（第 2 步：用 code 换 token 并回传）
 *
 * GitHub 授权后回跳到这里（?code=...&state=...）：
 *   1. 校验 state（防 CSRF）
 *   2. 用 client_id + client_secret + code 向 GitHub 换取 access_token
 *   3. 渲染一个极简页面，按 Decap 的 NetlifyAuthenticator 握手协议把 token 回传给后台弹窗：
 *      - 先 postMessage("authorizing:github")
 *      - 收到 CMS 回显后再 postMessage("authorization:github:success:" + JSON.stringify({token, provider}))
 */

const CLIENT_ID = "Ov23liZ4KQmeU2o1YdyW";
const REDIRECT_URI = "https://www.chinadentaltravel.com/api/callback";
const CMS_ORIGIN = "https://www.chinadentaltravel.com";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  // 1. 校验 state
  const cookie = request.headers.get("Cookie") || "";
  const m = cookie.match(/oauth_state=([^;]+)/);
  const savedState = m && decodeURIComponent(m[1]);
  if (!code || !savedState || savedState !== state) {
    return new Response("Invalid state or missing code", { status: 400 });
  }

  const clientSecret = env.GITHUB_CLIENT_SECRET;
  if (!clientSecret) {
    return new Response("Server misconfigured: missing GITHUB_CLIENT_SECRET", {
      status: 500,
    });
  }

  // 2. 换 token
  let tokenJson;
  try {
    const resp = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: clientSecret,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    tokenJson = await resp.json();
  } catch (e) {
    return renderError("Failed to contact GitHub: " + e.message);
  }

  const token = tokenJson.access_token;
  if (!token) {
    return renderError(tokenJson.error_description || tokenJson.error || "No access token returned");
  }

  // 3. 回传 token（Decap 握手协议）
  return renderSuccess(token);
}

function renderError(message) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Auth Error</title></head>
<body><script>
  (function(){
    var msg = "authorization:github:error:" + JSON.stringify({ error: ${JSON.stringify(message)} });
    if (window.opener) { window.opener.postMessage(msg, ${JSON.stringify(CMS_ORIGIN)}); }
    document.body.textContent = "Authorization failed: " + ${JSON.stringify(message)};
  })();
</script></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function renderSuccess(token) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Authorizing…</title></head>
<body><script>
  (function(){
    var TOKEN = ${JSON.stringify(token)};
    var ORIGIN = ${JSON.stringify(CMS_ORIGIN)};
    function sendSuccess(){
      var msg = "authorization:github:success:" + JSON.stringify({ token: TOKEN, provider: "github" });
      if (window.opener) { window.opener.postMessage(msg, ORIGIN); }
      window.close();
    }
    // Decap 握手：先发 authorizing，等 CMS 回显后再发 success
    if (window.opener) { window.opener.postMessage("authorizing:github", ORIGIN); }
    window.addEventListener("message", function(e){
      if (e.origin === ORIGIN && e.data === "authorizing:github") { sendSuccess(); }
    });
    // 兜底：若 2 秒内未收到回显，直接发 success（兼容部分版本）
    setTimeout(sendSuccess, 2000);
  })();
</script></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
