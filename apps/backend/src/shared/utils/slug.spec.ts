import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Wycieczka w Bieszczady')).toBe('wycieczka-w-bieszczady');
  });

  it('strips Polish diacritics via NFD normalization', () => {
    expect(slugify('Łódź — gołębie ąż')).toBe('lodz-golebie-az');
  });

  it('collapses consecutive non-alphanumeric runs', () => {
    expect(slugify('Two!!!  ---spaces')).toBe('two-spaces');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('--start and end--')).toBe('start-and-end');
  });

  it('caps length at 80 chars', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });

  it('returns fallback for input that slugifies to empty', () => {
    expect(slugify('!!!')).toBe('wycieczka');
    expect(slugify('')).toBe('wycieczka');
  });
});
