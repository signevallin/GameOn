'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase, Team } from '@/lib/supabase';

export const SCAVENGER_ITEMS = [
  { id: 'whole_team',  label: 'The whole team in one photo',          icon: '👥' },
  { id: 'yellow',      label: 'Something yellow',                      icon: '🟡' },
  { id: 'tree',        label: 'A tree or plant',                       icon: '🌳' },
  { id: 'animal',      label: 'An animal',                             icon: '🐾' },
  { id: 'number',      label: 'A number on a sign or building',        icon: '🔢' },
  { id: 'water',       label: 'Something related to water',            icon: '💧' },
  { id: 'red_vehicle', label: 'A red vehicle',                         icon: '🚗' },
  { id: 'smiling',     label: 'Someone from another team smiling',     icon: '😄' },
];

type Submission = {
  id: string;
  item_id: string;
  photo_url: string;
  status: 'pending' | 'rated';
  points_awarded: number | null;
};

type Props = {
  team: Team;
  gameId: string;
  missionId: string;
  onBack: () => void;
};

export default function ScavengerHunt({ team, gameId, missionId, onBack }: Props) {
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ itemId: string; url: string } | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const prevScoreRef = useRef(team.score);

  // Load existing submissions on mount and poll for rating updates
  async function loadSubmissions() {
    const res = await fetch(`/api/scavenger/team?teamId=${team.id}&missionId=${missionId}&t=${Date.now()}`, { cache: 'no-store' });
    const data = await res.json();
    if (data.submissions) {
      const serverMap: Record<string, Submission> = {};
      for (const s of data.submissions) serverMap[s.item_id] = s;
      // Always use server data when available; keep local only for items server doesn't have yet
      setSubmissions(prev => {
        const merged = { ...prev };
        for (const [itemId, serverSub] of Object.entries(serverMap)) {
          merged[itemId] = serverSub;
        }
        return merged;
      });
    }
  }

  useEffect(() => {
    loadSubmissions();
    const id = setInterval(loadSubmissions, 6000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When team score changes (admin rated a photo), immediately reload submissions
  useEffect(() => {
    if (team.score !== prevScoreRef.current) {
      prevScoreRef.current = team.score;
      loadSubmissions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team.score]);

  async function handleFile(itemId: string, itemLabel: string, file: File) {
    setUploading(itemId);
    setError(null);

    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `scavenger/${team.id}/${missionId}-${itemId}-${Date.now()}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from('photos')
        .upload(path, file, { upsert: true });

      if (storageErr) { setError('Upload failed: ' + storageErr.message); return; }

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      const res = await fetch('/api/scavenger/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, teamName: team.name, gameId, missionId, itemId, itemLabel, photoUrl }),
      });

      if (!res.ok) { setError('Could not save submission.'); return; }

      // Optimistically update UI immediately — polling loop will sync real data
      setSubmissions(prev => ({
        ...prev,
        [itemId]: {
          id: 'pending-' + Date.now(),
          item_id: itemId,
          photo_url: photoUrl,
          status: 'pending',
          points_awarded: null,
        },
      }));
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setUploading(null);
    }
  }

  const submittedCount = Object.keys(submissions).length;
  const ratedCount = Object.values(submissions).filter(s => s.status === 'rated').length;
  const totalPts = Object.values(submissions).reduce((sum, s) => sum + (s.points_awarded ?? 0), 0);

  return (
    <div>
      {/* Info banner */}
      <div style={{ padding: '12px 14px', background: 'rgba(117,171,200,0.07)', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>
        📌 Photograph as many items as you can. Admin will rate each photo — points are added to your score once rated.
      </div>

      {/* Progress bar */}
      {submittedCount > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', color: 'var(--muted)', letterSpacing: '0.5px' }}>
            <span>{submittedCount}/{SCAVENGER_ITEMS.length} submitted</span>
            {totalPts > 0 && (
              <span style={{ color: 'var(--gold)', fontWeight: 700 }}>⭐ {totalPts} pts so far</span>
            )}
          </div>
          <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(submittedCount / SCAVENGER_ITEMS.length) * 100}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.4s' }} />
          </div>
        </div>
      )}

      {/* Item list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {SCAVENGER_ITEMS.map(item => {
          const sub = submissions[item.id];
          const isUploading = uploading === item.id;
          const isRated = sub?.status === 'rated';
          const isPending = sub?.status === 'pending';

          const isSubmitted = isPending || isRated;

          return (
            <div key={item.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              background: isRated ? 'rgba(140,191,155,0.08)' : isSubmitted ? 'rgba(80,80,90,0.25)' : 'var(--card)',
              border: `1px solid ${isRated ? 'var(--accent3)' : isSubmitted ? 'rgba(120,120,130,0.4)' : 'var(--border)'}`,
              borderRadius: '12px',
              transition: 'all 0.2s',
            }}>
              {/* Icon */}
              <span style={{ fontSize: '22px', flexShrink: 0, filter: isSubmitted && !isRated ? 'grayscale(1) brightness(0.5)' : 'none' }}>{item.icon}</span>

              {/* Label */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: isRated ? 'var(--accent3)' : isSubmitted ? '#666' : 'var(--text)', lineHeight: 1.3 }}>
                  {isSubmitted && !isRated && <span style={{ marginRight: '4px' }}>✓</span>}{item.label}
                </div>
                {isRated && (
                  <div style={{ fontSize: '12px', color: 'var(--accent3)', marginTop: '2px', fontWeight: 700 }}>
                    ✓ Rated — {sub.points_awarded} pts
                  </div>
                )}
                {isPending && (
                  <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
                    Photo submitted — awaiting rating
                  </div>
                )}
              </div>

              {/* Thumbnail or upload button */}
              {sub?.photo_url && (
                <img
                  src={sub.photo_url}
                  alt={item.label}
                  onClick={() => setPreview({ itemId: item.id, url: sub.photo_url })}
                  style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)', cursor: 'pointer', flexShrink: 0 }}
                />
              )}

              {/* Upload button — only for items not yet submitted */}
              {!isSubmitted && (
                <>
                  <input
                    ref={el => { inputRefs.current[item.id] = el; }}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(item.id, item.label, f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => inputRefs.current[item.id]?.click()}
                    disabled={isUploading}
                    style={{
                      flexShrink: 0,
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--muted)',
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      fontFamily: "'Sora', sans-serif",
                      fontWeight: 700,
                      fontSize: '11px',
                      letterSpacing: '0.5px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isUploading ? '...' : '📷 UPLOAD'}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {error && <p style={{ color: 'var(--accent2)', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}

      <button className="btn btn-primary btn-full" onClick={onBack}>
        ← BACK TO MISSIONS
      </button>

      {/* Photo preview modal */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <img src={preview.url} alt="Preview" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
