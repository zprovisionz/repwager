import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const APP_STORE_URL = "https://apps.apple.com/app/repwager/id0000000000";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.repwager";

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const pathParts = url.pathname.split("/").filter(Boolean);

  const type = pathParts[pathParts.length - 2] ?? "home";
  const id = pathParts[pathParts.length - 1] ?? "";

  const deepLink = id ? `repwager://${type}/${id}` : "repwager://";

  const ua = req.headers.get("user-agent") ?? "";
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const storeUrl = isAndroid ? PLAY_STORE_URL : APP_STORE_URL;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Opening RepWager...</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #080C14;
      color: #F0F4FF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      gap: 24px;
      padding: 24px;
    }
    .logo { font-size: 32px; font-weight: 800; letter-spacing: 4px; color: #00D4FF; }
    .tagline { font-size: 14px; color: #8A9DC0; }
    .btn {
      background: #00D4FF;
      color: #080C14;
      font-weight: 700;
      font-size: 16px;
      padding: 14px 32px;
      border-radius: 12px;
      border: none;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
    }
    .sub { font-size: 12px; color: #4A5E7A; text-align: center; }
  </style>
</head>
<body>
  <div class="logo">REPWAGER</div>
  <div class="tagline">Prove it. Rep it. Win it.</div>
  <a href="${deepLink}" class="btn" id="openApp">Open in App</a>
  <a href="${storeUrl}" class="btn" style="background:#1A2740;color:#F0F4FF;margin-top:4px">
    ${isAndroid ? "Get on Google Play" : "Download on App Store"}
  </a>
  <div class="sub">If the app doesn't open automatically,<br/>download RepWager from the ${isAndroid ? "Play Store" : "App Store"}.</div>
  <script>
    window.location.href = "${deepLink}";
    setTimeout(() => {
      document.getElementById('openApp').style.display = 'none';
    }, 2000);
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
});
