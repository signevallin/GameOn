'use client';
import { useRef, useState } from 'react';
import { MusicRound } from '@/lib/missions';

type Props = {
  rounds: MusicRound[];
  maxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeLabel(r: MusicRound) {
  return `${r.title} – ${r.artist}`;
}

const DISTRACTOR_POOL = [
  'Blinding Lights – The Weeknd', 'Shape of You – Ed Sheeran', 'Uptown Funk – Mark Ronson ft. Bruno Mars',
  'Rolling in the Deep – Adele', 'Someone Like You – Adele', 'Happy – Pharrell Williams',
  'Thinking Out Loud – Ed Sheeran', 'Stay With Me – Sam Smith', 'Shallow – Lady Gaga & Bradley Cooper',
  'Old Town Road – Lil Nas X', 'Dance Monkey – Tones and I', 'Bad Guy – Billie Eilish',
  'Levitating – Dua Lipa', 'Watermelon Sugar – Harry Styles', 'Drivers License – Olivia Rodrigo',
  'As It Was – Harry Styles', 'Anti-Hero – Taylor Swift', 'Flowers – Miley Cyrus',
  'Calm Down – Rema & Selena Gomez', 'Unholy – Sam Smith & Kim Petras',
  'Bohemian Rhapsody – Queen', 'Hotel California – Eagles', 'Sweet Child O\' Mine – Guns N\' Roses',
  'Smells Like Teen Spirit – Nirvana', 'Mr. Brightside – The Killers',
  'Seven Nation Army – The White Stripes', 'Wonderwall – Oasis', 'Lose Yourself – Eminem',
  'In the End – Linkin Park', 'Numb – Linkin Park', 'Boulevard of Broken Dreams – Green Day',
  'With or Without You – U2', 'Don\'t Stop Believin\' – Journey', 'Eye of the Tiger – Survivor',
  'Africa – Toto', 'Take On Me – a-ha', 'Sweet Dreams – Eurythmics',
  'Girls Just Want to Have Fun – Cyndi Lauper', 'Wake Me Up Before You Go-Go – Wham!',
  'Like a Prayer – Madonna', 'Billie Jean – Michael Jackson', 'Thriller – Michael Jackson',
  'Purple Rain – Prince', 'Born to Run – Bruce Springsteen',
  'Killing Me Softly – Fugees', 'Killing Me Softly – Roberta Flack',
  'Baby One More Time – Britney Spears', 'Toxic – Britney Spears',
  'Crazy in Love – Beyoncé', 'Halo – Beyoncé', 'Single Ladies – Beyoncé',
  'Just Dance – Lady Gaga', 'Poker Face – Lady Gaga', 'Bad Romance – Lady Gaga',
  'Telephone – Lady Gaga ft. Beyoncé', 'Titanium – David Guetta ft. Sia',
  'We Found Love – Rihanna ft. Calvin Harris', 'Umbrella – Rihanna',
  'California Gurls – Katy Perry', 'Roar – Katy Perry', 'Firework – Katy Perry',
  'Call Me Maybe – Carly Rae Jepsen', 'Somebody That I Used to Know – Gotye',
  'Suit & Tie – Justin Timberlake', 'Can\'t Stop the Feeling! – Justin Timberlake',
  'Sorry – Justin Bieber', 'Love Yourself – Justin Bieber',
  'God\'s Plan – Drake', 'One Dance – Drake',
  'Rockstar – Post Malone', 'Sunflower – Post Malone & Swae Lee',
  'Sicko Mode – Travis Scott', 'HUMBLE. – Kendrick Lamar',
  'Despacito – Luis Fonsi ft. Daddy Yankee', 'Con Calma – Daddy Yankee & Snow',
  'Lean On – Major Lazer & DJ Snake ft. MØ', 'Cheap Thrills – Sia',
  'Chandelier – Sia', 'Elastic Heart – Sia',
  'Riptide – Vance Joy', 'Viva la Vida – Coldplay', 'The Scientist – Coldplay',
  'Fix You – Coldplay', 'Yellow – Coldplay',
  'Let Her Go – Passenger', 'Counting Stars – OneRepublic',
  'Radioactive – Imagine Dragons', 'Believer – Imagine Dragons',
  'Thunder – Imagine Dragons', 'Demons – Imagine Dragons',
  'Stressed Out – twenty one pilots', 'Ride – twenty one pilots',
  'Take Me to Church – Hozier', 'Work Song – Hozier',
  'Perfect – Ed Sheeran', 'Castle on the Hill – Ed Sheeran',
  'Photograph – Ed Sheeran', 'Don\'t – Ed Sheeran',
];

function buildOptions(allRounds: MusicRound[], targetIdx: number): string[] {
  const correctLabel = makeLabel(allRounds[targetIdx]);
  const quizLabels = new Set(allRounds.map(makeLabel));
  // Use songs outside the current quiz as distractors so players can't eliminate
  // options just by recognising songs they already heard in this round
  const pool = shuffle(DISTRACTOR_POOL.filter(s => !quizLabels.has(s)));
  // Fall back to other quiz songs only if the pool somehow runs dry
  const fallback = shuffle(allRounds.filter((_, i) => i !== targetIdx).map(makeLabel));
  const distractors = [...pool, ...fallback].slice(0, 3);
  return shuffle([correctLabel, ...distractors]);
}

export default function EasyMusicQuiz({ rounds, maxPts, onFinish }: Props) {
  const [shuffledRounds] = useState(() => shuffle(rounds));
  const [idx, setIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [options, setOptions] = useState(() => buildOptions(shuffledRounds, 0));
  const audioRef = useRef<HTMLAudioElement>(null);

  const round = shuffledRounds[idx];
  const correctLabel = makeLabel(round);

  function choose(opt: string) {
    if (selected !== null) return;
    const isCorrect = opt === correctLabel;
    const newCorrect = correctCount + (isCorrect ? 1 : 0);
    if (isCorrect) setCorrectCount(newCorrect);
    setSelected(opt);

    // If this was the last question, fire onFinish after the reveal delay
    if (idx + 1 >= shuffledRounds.length) {
      setTimeout(() => {
        const pts = Math.round((newCorrect / shuffledRounds.length) * maxPts);
        onFinish(newCorrect > 0, pts);
      }, 1500);
    }
  }

  function next() {
    const nextIdx = idx + 1;
    setOptions(buildOptions(shuffledRounds, nextIdx));
    setIdx(nextIdx);
    setSelected(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.load();
    }
  }

  const isLast = idx + 1 >= shuffledRounds.length;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px' }}>
          SONG {idx + 1} / {shuffledRounds.length}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--accent)' }}>
          {correctCount} correct
        </div>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px',
        textAlign: 'center',
        marginBottom: '20px',
      }}>
        <audio ref={audioRef} controls style={{ width: '100%' }} key={round.audioUrl}>
          <source src={round.audioUrl} />
        </audio>
      </div>

      <div key={`opts-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
        {options.map((opt, i) => {
          let cls = 'option-btn';
          if (selected !== null) {
            if (opt === correctLabel) cls += ' correct';
            else if (opt === selected) cls += ' wrong';
          }
          return (
            <button
              key={i}
              className={cls}
              disabled={selected !== null}
              onClick={() => choose(opt)}
              style={{ textAlign: 'left' }}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && !isLast && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {round.trackViewUrl && (
            <a
              href={round.trackViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '11px 16px',
                background: '#000',
                color: '#fff',
                borderRadius: '10px',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 814 1000" fill="white" xmlns="http://www.w3.org/2000/svg">
                <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.6-155.5-127.4C46 790.9 0 663.4 0 541.8c0-207.4 131.4-317.4 260.8-317.4 70.2 0 128.9 46.4 173.1 46.4 42.8 0 110.2-49 190.5-49 30.2 0 130.3 4.5 189.5 59.2zm-194-141.9c28.8-34.2 49.6-82.2 49.6-130.2 0-6.5-.6-13.1-1.9-19.2-47.3 1.9-103 32-136.3 71.9-26.5 29.8-52.9 77.8-52.9 127.4 0 7.1 1.3 14.2 1.9 16.5 3.2.6 8.4 1.3 13.6 1.3 42.8 0 96.9-29.2 125.9-67.8z" />
              </svg>
              Listen on Apple Music
            </a>
          )}
          <button className="btn btn-primary btn-full" onClick={next}>
            NEXT SONG →
          </button>
        </div>
      )}

      {selected !== null && isLast && round.trackViewUrl && (
        <a
          href={round.trackViewUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '11px 16px',
            background: '#000',
            color: '#fff',
            borderRadius: '10px',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 814 1000" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.6-155.5-127.4C46 790.9 0 663.4 0 541.8c0-207.4 131.4-317.4 260.8-317.4 70.2 0 128.9 46.4 173.1 46.4 42.8 0 110.2-49 190.5-49 30.2 0 130.3 4.5 189.5 59.2zm-194-141.9c28.8-34.2 49.6-82.2 49.6-130.2 0-6.5-.6-13.1-1.9-19.2-47.3 1.9-103 32-136.3 71.9-26.5 29.8-52.9 77.8-52.9 127.4 0 7.1 1.3 14.2 1.9 16.5 3.2.6 8.4 1.3 13.6 1.3 42.8 0 96.9-29.2 125.9-67.8z" />
          </svg>
          Listen on Apple Music
        </a>
      )}
    </>
  );
}
