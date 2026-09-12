import { describe, expect, it } from 'vitest';
import { addOneMonth, cancellationEffectiveAt, resolveSubscription } from './subscription-state';

const NOW = new Date('2026-03-15T12:00:00.000Z');

describe('resolveSubscription', () => {
  it('leaves a plan alone when nothing is cancelled', () => {
    expect(
      resolveSubscription(
        { storedTier: 'PRO', periodEnd: '2026-04-01T00:00:00.000Z', cancelAt: null },
        NOW,
      ),
    ).toEqual({
      tier: 'PRO',
      pendingCancelAt: null,
      periodEnd: '2026-04-01T00:00:00.000Z',
      elapsed: false,
    });
  });

  // The behaviour the UI copy promised and the old code did not honour: the
  // user keeps what they paid for until the period actually ends.
  it('keeps the paid tier while a cancellation is still in the future', () => {
    const resolved = resolveSubscription(
      {
        storedTier: 'VIP',
        periodEnd: '2026-04-01T00:00:00.000Z',
        cancelAt: '2026-04-01T00:00:00.000Z',
      },
      NOW,
    );
    expect(resolved.tier).toBe('VIP');
    expect(resolved.pendingCancelAt).toBe('2026-04-01T00:00:00.000Z');
    expect(resolved.elapsed).toBe(false);
  });

  it('drops to FREE once the cancellation date has passed', () => {
    const resolved = resolveSubscription(
      {
        storedTier: 'PRO',
        periodEnd: '2026-03-01T00:00:00.000Z',
        cancelAt: '2026-03-01T00:00:00.000Z',
      },
      NOW,
    );
    expect(resolved.tier).toBe('FREE');
    expect(resolved.pendingCancelAt).toBeNull();
    // Signals the caller to write the downgrade back.
    expect(resolved.elapsed).toBe(true);
  });

  it('treats a cancellation dated exactly now as elapsed', () => {
    const resolved = resolveSubscription(
      { storedTier: 'PRO', periodEnd: null, cancelAt: NOW.toISOString() },
      NOW,
    );
    expect(resolved.tier).toBe('FREE');
    expect(resolved.elapsed).toBe(true);
  });

  it('still reports elapsed when the tier was already written back', () => {
    // A half-applied state — tier written, dates not cleared — should still
    // get tidied rather than linger.
    const resolved = resolveSubscription(
      { storedTier: 'FREE', periodEnd: null, cancelAt: '2026-01-01T00:00:00.000Z' },
      NOW,
    );
    expect(resolved.tier).toBe('FREE');
    expect(resolved.elapsed).toBe(true);
  });

  it('ignores an unparseable cancelAt rather than downgrading on it', () => {
    const resolved = resolveSubscription(
      { storedTier: 'PRO', periodEnd: null, cancelAt: 'not a date' },
      NOW,
    );
    expect(resolved.tier).toBe('PRO');
    expect(resolved.elapsed).toBe(false);
  });
});

describe('cancellationEffectiveAt', () => {
  it('schedules the end of the paid period when one is still running', () => {
    expect(cancellationEffectiveAt('2026-04-01T00:00:00.000Z', NOW)).toBe(
      '2026-04-01T00:00:00.000Z',
    );
  });

  it('takes effect immediately when the paid period already ended', () => {
    expect(cancellationEffectiveAt('2026-01-01T00:00:00.000Z', NOW)).toBe(NOW.toISOString());
  });

  it('takes effect immediately when there is no paid period at all', () => {
    // An admin-granted or comped tier has no payment behind it.
    expect(cancellationEffectiveAt(null, NOW)).toBe(NOW.toISOString());
  });
});

describe('addOneMonth', () => {
  it('advances by one calendar month', () => {
    expect(addOneMonth(new Date('2026-03-15T12:00:00.000Z')).toISOString()).toBe(
      '2026-04-15T12:00:00.000Z',
    );
  });

  it('clamps to the last day when the next month is shorter', () => {
    // Jan 31 + 1 month must not roll into March.
    expect(addOneMonth(new Date('2026-01-31T00:00:00.000Z')).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });

  it('clamps to Feb 29 in a leap year', () => {
    expect(addOneMonth(new Date('2028-01-31T00:00:00.000Z')).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });

  it('rolls the year over in December', () => {
    expect(addOneMonth(new Date('2026-12-10T08:30:00.000Z')).toISOString()).toBe(
      '2027-01-10T08:30:00.000Z',
    );
  });
});
