'use client';
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Team } from '@/lib/supabase';

type Props = {
  question: string;
  missionId: string;
  team: Team;
  onSubmitted: () => void;
  revealable?: boolean;
};

export default function PhotoChallenge({ question, missionId, team, onSubmitted, revealable }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setError('');
  }

  async function upload() {
    if (!file) { setError('Please select a photo first.'); return; }
    setUploading(true);
    setError('');

    try {
      const ext = file.name.split('.').pop();
      const path = `${team.id}/${missionId}-${Date.now()}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from('photos')
        .upload(path, file, { upsert: true });

      if (storageErr) { setError('Upload failed: ' + storageErr.message); setUploading(false); return; }

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      const res = await fetch('/api/team/photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, teamName: team.name, missionId, photoUrl }),
      });

      if (!res.ok) { setError('Could not save submission.'); setUploading(false); return; }

      onSubmitted();
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setUploading(false);
    }
  }

  if (revealable && !revealed) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>🔒</div>
        <h2 style={{ marginBottom: '12px' }}>Secret Word Hidden</h2>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '32px' }}>
          Only press the button when your team is ready — the word to draw will appear!
        </p>
        <button className="btn btn-primary" onClick={() => setRevealed(true)}>
          REVEAL WORD 👁️
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="challenge-question">{question}</div>

      <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(117,171,200,0.06)', border: '1px solid var(--border)', borderRadius: '8px' }}>
        <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6' }}>
          📌 After uploading, admin will review and rate your photo. Points are awarded once admin has rated it — keep an eye on your score!
        </p>
      </div>

      {preview && (
        <div style={{ marginBottom: '20px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <img src={preview} alt="Preview" style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', display: 'block' }} />
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={pickFile} style={{ display: 'none' }} />

        <button className="btn btn-ghost btn-full" onClick={() => inputRef.current?.click()}>
          {preview ? '📷 CHANGE PHOTO' : '📷 TAKE / SELECT PHOTO'}
        </button>

        {error && <p style={{ color: 'var(--accent2)', fontSize: '13px' }}>{error}</p>}

        <button className="btn btn-primary btn-full" onClick={upload} disabled={!file || uploading}>
          {uploading ? 'UPLOADING...' : 'SUBMIT PHOTO →'}
        </button>
      </div>
    </>
  );
}
