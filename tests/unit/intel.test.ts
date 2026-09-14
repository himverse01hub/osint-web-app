import { describe, expect, it } from 'vitest';
import {
  confidenceLabel,
  severityRank,
  normalizeComparison,
  extractDomain,
  matchSimilarityScore,
  isValidHaryanaVehicleReg,
  formatTimestamp,
  sortByConfidenceThenNewest,
} from '../../src/lib/intel';

describe('confidenceLabel', () => {
  it('maps the five HP-OI confidence bands', () => {
    expect(confidenceLabel(95)).toBe('VERY HIGH');
    expect(confidenceLabel(70)).toBe('HIGH');
    expect(confidenceLabel(45)).toBe('MEDIUM');
    expect(confidenceLabel(25)).toBe('LOW');
    expect(confidenceLabel(10)).toBe('VERY LOW');
  });

  it('handles missing and invalid input defensively', () => {
    expect(confidenceLabel(null)).toBe('VERY LOW');
    expect(confidenceLabel(undefined)).toBe('VERY LOW');
    expect(confidenceLabel(Number.NaN)).toBe('VERY LOW');
  });
});

describe('severityRank', () => {
  it('orders CRITICAL > HIGH > MEDIUM > LOW > unknown', () => {
    expect(severityRank('critical')).toBe(4);
    expect(severityRank('HIGH')).toBe(3);
    expect(severityRank('medium')).toBe(2);
    expect(severityRank('low')).toBe(1);
    expect(severityRank('banana')).toBe(0);
    expect(severityRank(null)).toBe(0);
  });
});

describe('normalizeComparison', () => {
  it('folds case, spacing and punctuation for resolution keys', () => {
    expect(normalizeComparison('Rahul Kumar')).toBe('rahulkumar');
    expect(normalizeComparison('  RAHUL_KUMAR ')).toBe('rahulkumar');
    expect(normalizeComparison('Rahul-Kumar.')).toBe('rahulkumar');
    expect(normalizeComparison(null)).toBe('');
  });
});

describe('extractDomain', () => {
  it('returns the domain part of an email', () => {
    expect(extractDomain('rahul.demo01@example.com')).toBe('example.com');
    expect(extractDomain('user@sub.example.co.in')).toBe('sub.example.co.in');
  });

  it('returns empty for malformed input', () => {
    expect(extractDomain('no-at-sign')).toBe('');
    expect(extractDomain('user@')).toBe('');
    expect(extractDomain('')).toBe('');
    expect(extractDomain(null)).toBe('');
  });
});

describe('matchSimilarityScore (Possible Match hint only)', () => {
  it('returns 100 for an exact normalized match', () => {
    expect(matchSimilarityScore('RAHUL KUMAR', 'rahul_kumar')).toBe(100);
  });

  it('returns 80 for a username-style containment of 5+ characters', () => {
    expect(matchSimilarityScore('Rahul', 'rahulk123')).toBe(80);
  });

  it('returns 55 for a cross-kind name-token-inside-username hint', () => {
    expect(matchSimilarityScore('Rahul Kumar', 'RAHUL_K')).toBe(55);
    expect(matchSimilarityScore('RAHUL_K', 'Rahul Kumar')).toBe(55);
  });

  it('returns 79 for overlapping name tokens — high, never confirmatory', () => {
    expect(matchSimilarityScore('rahul kumar', 'rahul kumar verma')).toBe(79);
    expect(matchSimilarityScore('Rahul', 'Rahul Kumar')).toBe(79);
  });

  it('keeps usernames as single tokens — shared generic fragments never match', () => {
    expect(matchSimilarityScore('sandeep_demo', 'amit_demo')).toBe(0);
    expect(matchSimilarityScore('rahul_demo_01', 'amit_demo_01')).toBe(0);
    expect(matchSimilarityScore('demo', 'demo_station')).toBe(0);
  });

  it('does not claim a match for unrelated identifiers or empty input', () => {
    expect(matchSimilarityScore('amit_demo', 'sunita Rao')).toBe(0);
    expect(matchSimilarityScore(null, 'amit_demo')).toBe(0);
    expect(matchSimilarityScore('', '')).toBe(0);
  });
});

describe('isValidHaryanaVehicleReg', () => {
  it('accepts the demo HR format and rejects junk', () => {
    expect(isValidHaryanaVehicleReg('HR-00-AA-0000')).toBe(true);
    expect(isValidHaryanaVehicleReg('hr-11-bb-1111')).toBe(true);
    expect(isValidHaryanaVehicleReg('HR-11-BBB-1111')).toBe(false);
    expect(isValidHaryanaVehicleReg('HR-1100-0000')).toBe(false);
    expect(isValidHaryanaVehicleReg('')).toBe(false);
    expect(isValidHaryanaVehicleReg(null)).toBe(false);
  });
});

describe('formatTimestamp', () => {
  it('formats valid inputs and degrades gracefully', () => {
    expect(formatTimestamp(new Date('2026-09-06T00:00:00Z'))).toBe('2026-09-06T00:00:00.000Z');
    expect(formatTimestamp('not-a-date')).toBe('not-a-date');
    expect(formatTimestamp(null)).toBe('—');
  });
});

describe('sortByConfidenceThenNewest', () => {
  it('ranks high-confidence new findings first without mutating input', () => {
    const items = [
      { id: 'a', c: 40, d: '2026-09-01' },
      { id: 'b', c: 90, d: '2026-09-02' },
      { id: 'c', c: 90, d: '2026-09-10' },
    ];
    const sorted = sortByConfidenceThenNewest(items, (item) => item.c, (item) => item.d);
    expect(sorted.map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});