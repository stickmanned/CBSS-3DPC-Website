export const MODEL_LINK_PROVIDERS = [
  "makerworld",
  "printables",
  "thingiverse",
  "thangs",
  "other",
] as const;

export type ModelLinkProvider = (typeof MODEL_LINK_PROVIDERS)[number];

export type RecognizedModelLink = {
  url: string;
  provider: ModelLinkProvider;
  recognized: boolean;
};

const PROVIDER_DOMAINS: ReadonlyArray<readonly [string, Exclude<ModelLinkProvider, "other">]> = [
  ["makerworld.com", "makerworld"],
  ["printables.com", "printables"],
  ["thingiverse.com", "thingiverse"],
  ["thangs.com", "thangs"],
];

function domainMatches(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function recognizeModelLink(rawUrl: string): RecognizedModelLink {
  const parsed = new URL(rawUrl.trim());
  if (parsed.protocol !== "https:") {
    throw new TypeError("Model links must use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new TypeError("Model links cannot contain credentials.");
  }

  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.port === "443") parsed.port = "";

  const match = PROVIDER_DOMAINS.find(([domain]) => domainMatches(parsed.hostname, domain));
  const provider = match?.[1] ?? "other";

  return {
    url: parsed.toString(),
    provider,
    recognized: provider !== "other",
  };
}
