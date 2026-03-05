export interface RateLimitInfo {
  isRateLimited: boolean;
  message: string;
  retryAfterSeconds: number | null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

function extractRetryAfterSeconds(message: string): number | null {
  const retryAfterMatch = message.match(/retry[-\s]?after\s*[:=]?\s*(\d+)/i);
  if (retryAfterMatch) {
    const seconds = Number.parseInt(retryAfterMatch[1], 10);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const waitMinutesMatch = message.match(/(?:wacht|wait)\s+(\d+)\s+(?:min|mins|minutes|minuten)/i);
  if (waitMinutesMatch) {
    const minutes = Number.parseInt(waitMinutesMatch[1], 10);
    if (Number.isFinite(minutes)) return minutes * 60;
  }

  const waitSecondsMatch = message.match(/(?:wacht|wait)\s+(\d+)\s+(?:sec|secs|seconds|seconden)/i);
  if (waitSecondsMatch) {
    const seconds = Number.parseInt(waitSecondsMatch[1], 10);
    return Number.isFinite(seconds) ? seconds : null;
  }

  return null;
}

export function getRateLimitInfo(error: unknown): RateLimitInfo {
  const message = getErrorMessage(error);
  const isRateLimited = /(rate\s*limit|too many requests|\b429\b|quota exceeded|throttl)/i.test(message);

  return {
    isRateLimited,
    message,
    retryAfterSeconds: isRateLimited ? extractRetryAfterSeconds(message) : null
  };
}

export function formatRetryWindow(retryAfterSeconds: number | null): string {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) return 'soon';
  if (retryAfterSeconds < 60) return `${retryAfterSeconds}s`;

  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `${minutes}m`;
}
