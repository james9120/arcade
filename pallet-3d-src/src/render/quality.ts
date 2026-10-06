export type GraphicsMode = "high" | "low";

/** `?gfx=` and `?quality=` force the path. Desktop defaults to High. */
export function readGraphicsMode(search: string, desktop: boolean): GraphicsMode {
  const raw = (new URLSearchParams(search).get("gfx") ?? new URLSearchParams(search).get("quality") ?? "").toLowerCase();
  if (raw === "high" || raw === "low") return raw;
  return desktop ? "high" : "low";
}
