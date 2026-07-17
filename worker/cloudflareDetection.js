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
    "unusual traffic",
    "automated access",
    "Your request has been blocked",
    "Please verify you are a human",
    "Incapsula incident",
    "Request unsuccessful",
  ].join("|"),
  "i"
)

/**
 * Regex matching bot-detection and login-wall phrases specific to Indeed and
 * Glassdoor. Neither site uses Cloudflare/Imperva/Akamai, so these pages pass
 * CLOUDFLARE_BLOCK_PATTERN undetected without this separate check.
 */
export const JOB_SITE_BLOCK_PATTERN = new RegExp(
  [
    // Indeed
    "There was a problem",
    "To continue, please complete the security check",
    "Your request could not be completed",
    "Please verify to continue",
    "Sign in to continue",
    "Sign in to see more jobs",
    "help us protect our community",
    // Glassdoor
    "Please help us protect Glassdoor",
    "make sure you're not a robot",
    "we've detected unusual activity",
    "verify you're a human",
    "Glassdoor is temporarily unavailable",
  ].join("|"),
  "i"
)
