import { describe, it, expect } from 'vitest';
import { storagePathFromPublicUrl, gameEndTime, PHOTO_RETENTION_DAYS } from '@/lib/photo-cleanup';

describe('storagePathFromPublicUrl', () => {
  const base = 'https://xyz.supabase.co/storage/v1/object/public/photos/';

  it('extracts a team photo path', () => {
    expect(storagePathFromPublicUrl(`${base}team-1/mission-123.jpg`)).toBe('team-1/mission-123.jpg');
  });

  it('extracts a nested scavenger path', () => {
    expect(storagePathFromPublicUrl(`${base}scavenger/team-1/m-i-1.png`)).toBe('scavenger/team-1/m-i-1.png');
  });

  it('strips query strings and decodes escapes', () => {
    expect(storagePathFromPublicUrl(`${base}team%201/a.jpg?t=1`)).toBe('team 1/a.jpg');
  });

  it('returns null for non-storage URLs', () => {
    expect(storagePathFromPublicUrl('https://example.com/image.jpg')).toBeNull();
    expect(storagePathFromPublicUrl(`${base}`)).toBeNull();
  });
});

describe('gameEndTime', () => {
  const base = {
    status: 'finished',
    started_at: '2026-01-01T12:00:00Z',
    duration_minutes: 60,
    created_at: '2026-01-01T10:00:00Z',
    deleted_at: null as string | null,
  };

  it('is started_at + duration for a finished game', () => {
    expect(gameEndTime(base)?.toISOString()).toBe('2026-01-01T13:00:00.000Z');
  });

  it('falls back to created_at when the game never started', () => {
    expect(gameEndTime({ ...base, started_at: null })?.toISOString()).toBe('2026-01-01T10:00:00.000Z');
  });

  it('uses deleted_at for soft-deleted games regardless of status', () => {
    expect(
      gameEndTime({ ...base, status: 'active', deleted_at: '2026-02-01T00:00:00Z' })?.toISOString()
    ).toBe('2026-02-01T00:00:00.000Z');
  });

  it('returns null for games still in progress', () => {
    expect(gameEndTime({ ...base, status: 'active' })).toBeNull();
    expect(gameEndTime({ ...base, status: 'draft' })).toBeNull();
  });

  it('retention default is the promised 30 days', () => {
    expect(PHOTO_RETENTION_DAYS).toBe(30);
  });
});
