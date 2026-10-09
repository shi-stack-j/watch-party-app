import { parseYouTubeUrl } from '../utils/youtubeUrl';

describe('Phase 5 YouTube URL Parser Unit Tests', () => {
  it('1. Parses valid standard watch URL (https://www.youtube.com/watch?v=dQw4w9WgXcQ)', () => {
    const res = parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe('dQw4w9WgXcQ');
    expect(res.normalizedUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('2. Parses valid short URL (https://youtu.be/dQw4w9WgXcQ)', () => {
    const res = parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ');
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe('dQw4w9WgXcQ');
    expect(res.normalizedUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('3. Parses valid embed URL (https://www.youtube.com/embed/dQw4w9WgXcQ)', () => {
    const res = parseYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe('dQw4w9WgXcQ');
  });

  it('4. Parses valid shorts URL (https://www.youtube.com/shorts/dQw4w9WgXcQ)', () => {
    const res = parseYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ');
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe('dQw4w9WgXcQ');
  });

  it('5. Accepts direct 11-character video ID (dQw4w9WgXcQ)', () => {
    const res = parseYouTubeUrl('dQw4w9WgXcQ');
    expect(res.isValid).toBe(true);
    expect(res.videoId).toBe('dQw4w9WgXcQ');
  });

  it('6. Rejects unsupported host (https://vimeo.com/123456789)', () => {
    const res = parseYouTubeUrl('https://vimeo.com/123456789');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('Only valid YouTube URLs are supported');
  });

  it('7. Rejects malformed/invalid video ID length', () => {
    const res = parseYouTubeUrl('https://www.youtube.com/watch?v=short');
    expect(res.isValid).toBe(false);
    expect(res.error).toBeDefined();
  });

  it('8. Rejects empty string or whitespace', () => {
    const res = parseYouTubeUrl('   ');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('cannot be empty');
  });
});
