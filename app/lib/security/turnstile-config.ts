/**
 * The single name for the challenge this site issues.
 *
 * Both halves import it: the widget stamps it into the token, the verifier
 * checks for it. That is the only way the two can agree by construction. When
 * the expected value lived in `TURNSTILE_EXPECTED_ACTION` and the issued one
 * was a literal in the component, the env var could only ever be *wrong* —
 * it had no way to be more correct than the string the widget already sends,
 * and a single typo in it would have rejected every genuine token with the
 * same unreadable "Request could not be processed." that a pinned APP_ORIGIN
 * produced. Configuration may still name additional accepted actions; it can
 * no longer contradict this one.
 */
export const TURNSTILE_ACTION = "print-request";

/**
 * The one switch that takes Turnstile out of the request path.
 *
 * Turnstile is a hard gate: every route into the print request form, uploaded
 * file or model link, needs a token. That makes a third-party fault — an
 * unlisted hostname, a rotated sitekey, a blocked challenge host, a Cloudflare
 * outage — a total outage of the form, with the requester told only that the
 * check did not pass. There has to be a way for the club to keep taking
 * requests while that is sorted out.
 *
 * `NEXT_PUBLIC_` because both halves must agree: the browser has to stop
 * rendering a widget it cannot complete, and the server has to stop demanding
 * the token that widget would have produced. Honouring only one of them is the
 * failure this replaces — setting the old server-side `TURNSTILE_DISABLED`
 * while the keys were still present made *every* submission fail closed with a
 * 503, so the switch meant to rescue the form was the one that broke it
 * hardest. That name still works, as a server-side alias, so existing
 * deployments keep their meaning.
 *
 * Disabling is deliberate and logged on every request. The form is not left
 * bare: the honeypot field, the minimum fill time, the form-age ceiling, the
 * per-IP and per-email rate limits, and the idempotency key all still apply.
 * What is lost is the bot challenge, so this is a stopgap to be reverted once
 * the underlying configuration is fixed — not a setting to leave on.
 */
export function turnstileDisabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_TURNSTILE_DISABLED === "true" ||
    process.env.TURNSTILE_DISABLED === "true"
  );
}
