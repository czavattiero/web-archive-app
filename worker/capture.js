let toleranceMs = 100; // Define tolerance before the conditional check
if (!lastCaptured) {
    capture(); // Capture immediately if not captured before
} else if (nextCapture && now >= (nextCapture - toleranceMs)) {
    capture(); // Capture on schedule with the defined tolerance
}