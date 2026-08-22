/**
 * Copy a short string, reporting honestly whether it worked.
 *
 * Two paths because neither is universally available: the async Clipboard API
 * needs a secure context and can still be refused by permission or enterprise
 * policy, and the `execCommand` fallback is deprecated but remains the only
 * thing that works in some managed browsers. Both require a real user gesture,
 * so a programmatic call is expected to return false rather than throw — the
 * caller shows the address instead of claiming a copy that never happened.
 */
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    // Needs a secure context; the site is HTTPS, but a stray http:// preview
    // would land in the fallback rather than throwing at the visitor.
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Permission denied or blocked by policy. Fall through.
  }

  try {
    const scratch = document.createElement("textarea");
    scratch.value = value;
    scratch.setAttribute("readonly", "");
    scratch.style.position = "fixed";
    scratch.style.opacity = "0";
    document.body.appendChild(scratch);
    scratch.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(scratch);
    return copied;
  } catch {
    return false;
  }
}
