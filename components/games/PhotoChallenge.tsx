'use client';
import { useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Team } from '@/lib/supabase';

type Props = {
  question: string;
  missionId: string;
  team: Team;
  onSubmitted: () => void;
};

export default function PhotoChallenge({ question, missionId, team, onSubmitted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
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
