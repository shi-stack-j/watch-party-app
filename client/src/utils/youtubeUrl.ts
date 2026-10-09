export interface YouTubeParseResult {
  isValid: boolean;
  videoId: string | null;
  normalizedUrl: string | null;
  error?: string;
}

const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export const parseYouTubeUrl = (input: string): YouTubeParseResult => {
  if (!input || typeof input !== 'string') {
    return { isValid: false, videoId: null, normalizedUrl: null, error: 'Video URL or ID is required' };
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return { isValid: false, videoId: null, normalizedUrl: null, error: 'Video URL or ID cannot be empty' };
  }

  // 1. Direct 11-character video ID check
  if (YOUTUBE_ID_REGEX.test(trimmed)) {
    return {
      isValid: true,
      videoId: trimmed,
      normalizedUrl: `https://www.youtube.com/watch?v=${trimmed}`,
    };
  }

  // 2. Parse URL
  try {
    let urlString = trimmed;
    if (!/^https?:\/\//i.test(urlString)) {
      urlString = `https://${urlString}`;
    }

    const parsedUrl = new URL(urlString);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Trusted YouTube domain check
    const trustedHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be'];
    if (!trustedHosts.includes(hostname)) {
      return {
        isValid: false,
        videoId: null,
        normalizedUrl: null,
        error: 'Only valid YouTube URLs are supported',
      };
    }

    let extractedId: string | null = null;

    if (hostname.includes('youtu.be')) {
      const pathSegment = parsedUrl.pathname.substring(1);
      extractedId = pathSegment.split('/')[0] || null;
    } else {
      if (parsedUrl.pathname === '/watch') {
        extractedId = parsedUrl.searchParams.get('v');
      } else if (parsedUrl.pathname.startsWith('/embed/')) {
        extractedId = parsedUrl.pathname.split('/embed/')[1]?.split('/')[0] || null;
      } else if (parsedUrl.pathname.startsWith('/shorts/')) {
        extractedId = parsedUrl.pathname.split('/shorts/')[1]?.split('/')[0] || null;
      }
    }

    if (extractedId && YOUTUBE_ID_REGEX.test(extractedId)) {
      return {
        isValid: true,
        videoId: extractedId,
        normalizedUrl: `https://www.youtube.com/watch?v=${extractedId}`,
      };
    }

    return {
      isValid: false,
      videoId: null,
      normalizedUrl: null,
      error: 'Could not extract a valid 11-character YouTube video ID',
    };
  } catch {
    return {
      isValid: false,
      videoId: null,
      normalizedUrl: null,
      error: 'Invalid URL format',
    };
  }
};
