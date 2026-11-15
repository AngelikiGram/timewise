// The site can be served from a sub-path, e.g. GitHub Pages at /timewise/. Next.js adds that prefix to
// <Link> and the router, but not to plain fetch() calls or <img> sources, so files in public/ go through this.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const asset = (path: string) => `${BASE_PATH}${path}`;
