import next from "./worker.js";

const protectedPaths = /^\/(?:app|portal|admin)(?:\/|$)/;

/** Conserva la redirección previa a la sesión del proxy de Next.js. */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const restricted = protectedPaths.test(url.pathname);
    if (restricted && !/(?:^|;\s*)enc_session=/.test(request.headers.get("Cookie") ?? "")) {
      const to = new URL(url);
      to.pathname = "/login";
      to.searchParams.set("next", url.pathname);
      return Response.redirect(to, 307);
    }

    const response = await next.fetch(request, env, ctx);
    if (!restricted) return response;
    const secure = new Response(response.body, response);
    secure.headers.set("X-Frame-Options", "DENY");
    secure.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return secure;
  },
};
