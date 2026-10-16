import { describe, expect, it } from 'vitest';
import { repositoryFromUrl } from './deep-link.js';

describe('repositoryFromUrl', () => {
  it('parses repository links and decodes the path', () => {
    const request = repositoryFromUrl('assets-pipeline://open?repo=C%3A%5Cdev%5Cmy%20project');
    expect(request).toEqual({ repo: 'C:\\dev\\my project' });
  });

  it('returns a null repo when the parameter is missing or empty', () => {
    expect(repositoryFromUrl('assets-pipeline://open')).toEqual({ repo: null });
    expect(repositoryFromUrl('assets-pipeline://open?repo=')).toEqual({ repo: null });
    expect(repositoryFromUrl('assets-pipeline://open?repo=%20')).toEqual({ repo: null });
  });

  it('ignores other schemes and invalid values', () => {
    expect(repositoryFromUrl('https://example.com/?repo=x')).toBeNull();
    expect(repositoryFromUrl('not a url')).toBeNull();
  });
});
