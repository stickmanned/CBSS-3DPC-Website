/**
 * A failing Turnstile challenge is a total outage of the print request form:
 * every path through it, uploaded file or model link, needs a token. Leaving
 * the requester with a dead widget and "complete the check" is what turned a
 * misconfigured sitekey into a page that silently could not be submitted.
 *
 * The three buckets come from Cloudflare's published client-side error table,
 * because who can fix the problem differs by code and a wrong guess wastes the
 * requester's time: a sitekey fault is ours and retrying never clears it, a
 * blocked iframe or a wrong clock is theirs and is worth naming, and the rest
 * are transient. Unknown codes fall through to transient — offering a retry
 * that fails costs less than telling someone their setup is broken when it is
 * not. The club's address is offered in every case.
 */
export type WidgetFailure = { message: string; retryable: boolean };

const SITE_CONFIGURATION_CODES = new Set([
  "110100", // invalid sitekey
  "110110", // sitekey not found
  "110200", // domain not authorized
  "400020", // invalid sitekey
  "400070", // sitekey disabled
]);

export function describeWidgetError(code: string): WidgetFailure {
  if (SITE_CONFIGURATION_CODES.has(code)) {
    return {
      message:
        "The security check is set up wrong for this site, so requests cannot be sent right now. This is on our end, not yours \u2014 please email the club and we will fix it.",
      retryable: false,
    };
  }

  // 200100: the visitor's clock is wrong, or an intermediary cached the challenge.
  if (code === "200100") {
    return {
      message:
        "The security check was rejected because this device's clock looks wrong. Check your date and time settings, then try again.",
      retryable: true,
    };
  }

  // 200500: the challenge iframe could not load at all.
  if (code === "200500") {
    return {
      message:
        "The security check could not load. Something on this network or an extension is blocking challenges.cloudflare.com \u2014 try another network or disable the blocker, then try again.",
      retryable: true,
    };
  }

  // 110600/110620 (timeouts) and the 300*/600* challenge failures all clear on
  // a retry, and so should anything Cloudflare adds later.
  return {
    message:
      "The security check did not complete. Try it again, or email the club if it keeps failing.",
    retryable: true,
  };
}
