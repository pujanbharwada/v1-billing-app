import {
  buildDateKey,
  calculateRowTotal,
  escapeHtml,
  extractDateKeyFromString,
  normalizeItems,
  parseFiniteNumber,
} from '../utils/billing';

describe('billing utilities', () => {
  test('calculates finite row totals', () => {
    expect(calculateRowTotal('2.5', '10')).toBe(25);
    expect(calculateRowTotal('invalid', '10')).toBe(0);
    expect(parseFiniteNumber('Infinity')).toBe(0);
  });

  test('normalizes saved items to at least 30 rows', () => {
    const normalizedItems = normalizeItems([
      { item: 'Oil', qty: '2', rate: '100' },
    ]);

    expect(normalizedItems).toHaveLength(30);
    expect(normalizedItems[0]).toEqual({
      item: 'Oil',
      qty: '2',
      rate: '100',
    });
  });

  test('extracts complete dates instead of only weekdays', () => {
    expect(extractDateKeyFromString('Thu, 9/7/2026, 11:31 pm')).toBe(
      '09/07/2026',
    );
    expect(buildDateKey(new Date(2026, 6, 9))).toBe('09/07/2026');
  });

  test('escapes customer and item text used in printable HTML', () => {
    expect(escapeHtml('<Oil & Soap>')).toBe('&lt;Oil &amp; Soap&gt;');
  });
});
