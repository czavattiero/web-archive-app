/**
 * Regex matching known Cloudflare challenge/block page phrases, as well as
 * common non-Cloudflare WAF and bot-wall phrases (Imperva, Akamai, ATS login walls, etc.).
 * Used to detect when a captured page is a bot block rather than real content.
 */
export const CLOUDFLARE_BLOCK_PATTERN = new RegExp(
  [
    "Additional Verification Required",
    "Ray ID",
    "Troubleshooting Cloudflare Errors",
    "Just a moment",
    "Enable JavaScript and cookies to continue",
    "Please enable cookies",
    "Verifying you are human",
    "security verification",
    "Checking your browser",
    "Access denied",
    "cf-ray",
    "This site is protected by",
    "unusual traffic",
    "automated access",
    "Your request has been blocked",
    "Please verify you are a human",
    "Incapsula incident",
    "Request unsuccessful",
  ].join("|"),
  "i"
)
