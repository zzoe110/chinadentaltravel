/**
 * Cloudflare Worker — 图片水印（可选生产增强）
 * ---------------------------------------------------------------
 * 作用：对所有图片请求叠加半透明网址水印，防盗用。
 *
 * 免费方案已在站点内通过「CSS 平铺水印 + 前端上传时烘焙(bakeWatermark)」
 * 实现；本 Worker 提供「服务端一次性烘焙」的更强方案。
 *
 * 启用方式（二选一）：
 *   A) Cloudflare Images（推荐，按量计费，约 $1/万张）
 *      - 在 Images 中上传一张水印 PNG（透明底、含 chinadentaltravel.com）
 *      - 绑定变量 WATERMARK（水印图），并开启 Images 绑定
 *      - 把本 Worker 挂在 /w/* 路由上，原图放 /images/*
 *   B) 纯免费：不部署本 Worker，仅用站点内置的 CSS 水印 + 上传烘焙
 *
 * 下面给出基于 Cloudflare Images binding 的参考实现。
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 仅处理图片路径
    const isImage = /\.(jpg|jpeg|png|webp|avif)$/i.test(url.pathname);
    if (!isImage || !env.WATERMARK) {
      // 没有配置水印则原样返回（交给 Pages 静态资源）
      return env.ASSETS ? env.ASSETS.fetch(request) : fetch(request);
    }

    try {
      // 取原图
      const upstream = await fetch(request);
      if (!upstream.ok) return upstream;
      const original = await upstream.image();

      // 用 Images binding 叠加水印图
      const watermarked = await original.draw({
        image: env.WATERMARK,          // 预上传的透明水印 PNG
        opacity: 0.35,
        repeat: true,                  // 平铺
        gravity: "center"
      });

      return new Response(watermarked, {
        headers: {
          "Content-Type": upstream.headers.get("Content-Type") || "image/jpeg",
          "Cache-Control": "public, max-age=86400"
        }
      });
    } catch (e) {
      // 出错时回退原图
      return fetch(request);
    }
  }
};
