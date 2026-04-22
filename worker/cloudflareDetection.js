/**
 * Regex matching known Cloudflare challenge/block page phrases.
 * Used to detect when a captured page is a Cloudflare block rather than real content.
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
  ].join("|"),
  "i"
)
