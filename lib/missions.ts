export type MissionType =
  | 'multiple_choice'
  | 'text_input'
  | 'puzzle'
  | 'memory'
  | 'reaction'
  | 'typerace'
  | 'hangman'
  | 'wouldyou'
  | 'truefalse'
  | 'photo'
  | 'pa_sparet'
  | 'solve_crime'
  | 'celebrity_quiz'
  | 'music_emoji';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Statement = { text: string; answer: boolean };
export type CrimeQuestion = { question: string; options: string[]; answer: string };
export type CelebRound = { clue: string; options: string[]; answer: string };
export type EmojiRound = { emojis: string; options: string[]; answer: string };

export type Mission = {
  id: string;
  icon: string;
  name: string;
  category: string;
  desc: string;
  difficulty: Difficulty;
  maxPts: number;
  type: MissionType;
  question?: string;
  code?: string;
  options?: string[];
  answer?: string;
  hint?: string;
  text?: string;
  word?: string;
  statements?: Statement[];
  clues?: string[];
  crimeStory?: string;
  crimeQuestions?: CrimeQuestion[];
  celebRounds?: CelebRound[];
  emojiRounds?: EmojiRound[];
};

export const MISSIONS: Mission[] = [
  // ── IT ──
  {
    id: 'code_quiz',
    icon: '🧩',
    name: 'Code Riddle',
    category: 'IT',
    desc: 'What does the code output? Think carefully!',
    difficulty: 'medium',
    maxPts: 300,
    type: 'multiple_choice',
    question: 'What is the output of the following JavaScript code?',
    code: `const arr = [1, 2, 3];\nconst result = arr.reduce((acc, n) => acc + n, 10);\nconsole.log(result);`,
    options: ['6', '16', '10', 'undefined'],
    answer: '16',
  },
  {
    id: 'binary',
    icon: '💾',
    name: 'Binary Decoder',
    category: 'IT',
    desc: 'Convert binary to a decimal number.',
    difficulty: 'easy',
    maxPts: 200,
    type: 'text_input',
    question: 'What is the decimal value of this binary number?',
    code: `01001010`,
    answer: '74',
    hint: 'Hint: 64 + 8 + 2',
  },
  {
    id: 'bug_hunt',
    icon: '🐛',
    name: 'Bug Hunt',
    category: 'IT',
    desc: 'Find the bug in the code.',
    difficulty: 'hard',
    maxPts: 500,
    type: 'multiple_choice',
    question: 'What is the bug in the Python code below that should calculate the sum of 1–10?',
    code: `total = 0\nfor i in range(1, 10):\n    total += i\nprint(total)`,
    options: [
      'range(1, 10) should be range(0, 10)',
      'range(1, 10) should be range(1, 11)',
      'total += i should be total = i',
      'print should be inside the loop',
    ],
    answer: 'range(1, 10) should be range(1, 11)',
  },
  {
    id: 'terminal',
    icon: '⌨️',
    name: 'Terminal Guru',
    category: 'IT',
    desc: 'Which command gets the job done?',
    difficulty: 'medium',
    maxPts: 300,
    type: 'multiple_choice',
    question: 'Which Linux command shows the last 20 lines of a log file in real time?',
    options: ['cat log.txt -20', 'tail -f -n 20 log.txt', 'head -20 log.txt', 'less +F log.txt'],
    answer: 'tail -f -n 20 log.txt',
  },
  {
    id: 'memory',
    icon: '🧠',
    name: 'Memory Match',
    category: 'IT',
    desc: 'Match IT terms with their definitions.',
    difficulty: 'medium',
    maxPts: 400,
    type: 'memory',
  },
  {
    id: 'emoji_rebus',
    icon: '🔐',
    name: 'Emoji Rebus',
    category: 'IT',
    desc: 'Which IT concept is hiding in the emojis?',
    difficulty: 'easy',
    maxPts: 150,
    type: 'multiple_choice',
    question: 'Which IT concept does this emoji combination represent?\n\n🔑 + 🔒 = ?',
    options: ['Encryption', 'Authentication', 'VPN', 'Firewall'],
    answer: 'Encryption',
  },
  {
    id: 'sequence',
    icon: '🔢',
    name: 'Sequence Logic',
    category: 'IT',
    desc: 'What comes next in the number sequence?',
    difficulty: 'medium',
    maxPts: 250,
    type: 'text_input',
    question: 'What is the next number in the Fibonacci sequence?',
    code: `1, 1, 2, 3, 5, 8, 13, 21, ?`,
    answer: '34',
  },
  // ── FUN ──
  {
    id: 'reaction',
    icon: '⚡',
    name: 'Reaction Test',
    category: 'Fun',
    desc: 'Click as fast as you can when it flashes!',
    difficulty: 'easy',
    maxPts: 350,
    type: 'reaction',
  },
  {
    id: 'trivia_fun',
    icon: '🎭',
    name: 'Fun Trivia',
    category: 'Fun',
    desc: 'General knowledge – the fun questions.',
    difficulty: 'easy',
    maxPts: 200,
    type: 'multiple_choice',
    question: 'How long does it approximately take for light to travel from the Sun to Earth?',
    options: ['8 seconds', '8 minutes', '8 hours', '8 days'],
    answer: '8 minutes',
  },
  {
    id: 'typerace',
    icon: '🏎️',
    name: 'Type Race',
    category: 'Fun',
    desc: 'Type the text as fast and accurately as possible!',
    difficulty: 'medium',
    maxPts: 450,
    type: 'typerace',
    text: 'The quick brown fox jumps over the lazy dog',
  },
  {
    id: 'wordguess',
    icon: '🔤',
    name: 'Word Guess',
    category: 'Fun',
    desc: 'Hangman – guess the word letter by letter!',
    difficulty: 'medium',
    maxPts: 300,
    type: 'hangman',
    word: 'KEYBOARD',
    hint: 'Something you use every day at work',
  },
  {
    id: 'wouldyou',
    icon: '🤔',
    name: 'Who on the team...?',
    category: 'Fun',
    desc: 'Vote for who in YOUR team fits best!',
    difficulty: 'easy',
    maxPts: 100,
    type: 'wouldyou',
    question: 'Who on the team would most likely accidentally delete the production database?',
  },
  {
    id: 'puzzle',
    icon: '🔀',
    name: 'Number Puzzle',
    category: 'Fun',
    desc: 'Drag and drop the numbers into the right order!',
    difficulty: 'easy',
    maxPts: 200,
    type: 'puzzle',
  },
  {
    id: 'true_false',
    icon: '✅',
    name: 'True or False',
    category: 'Fun',
    desc: 'Funny statements – true or false?',
    difficulty: 'easy',
    maxPts: 150,
    type: 'truefalse',
    statements: [
      { text: 'An octopus has three hearts.', answer: true },
      { text: 'WiFi stands for "Wireless Fidelity".', answer: false },
      { text: 'Cleopatra lived closer in time to the Moon landing than to the building of the Great Pyramids.', answer: true },
      { text: 'The average person swallows 8 spiders per year in their sleep.', answer: false },
    ],
  },
  // ── NEW LONGER MISSIONS ──
  {
    id: 'photo_bubble',
    icon: '📸',
    name: 'Bubble Challenge',
    category: 'Fun',
    desc: 'Team selfie – blow the biggest Hubba Bubba bubble! Admin rates your photo.',
    difficulty: 'easy',
    maxPts: 500,
    type: 'photo',
    question: 'Everyone on the team must chew Hubba Bubba and blow the biggest bubble possible at the same time. Take a team selfie and upload it – admin will rate your bubbles and award up to 500 points!',
  },
  {
    id: 'pa_sparet',
    icon: '🕵️',
    name: 'På Spåret',
    category: 'Fun',
    desc: 'Guess the famous person from clues – fewer clues = more points!',
    difficulty: 'hard',
    maxPts: 500,
    type: 'pa_sparet',
    clues: [
      'I have produced hit songs for Britney Spears, Backstreet Boys, and Taylor Swift.',
      'I am a music producer and songwriter, not a performer.',
      'I grew up in Stockholm, Sweden.',
      'I have written more US number-one hits than almost any other songwriter in history.',
      'My real name is Martin Karl Sandberg.',
    ],
    answer: 'Max Martin',
  },
  {
    id: 'solve_crime',
    icon: '🔍',
    name: 'Solve the Crime',
    category: 'Fun',
    desc: 'Read the case carefully and figure out who stole the laptop!',
    difficulty: 'hard',
    maxPts: 450,
    type: 'solve_crime',
    crimeStory: `A company laptop worth 50,000 SEK was stolen from the office yesterday evening.

Three employees were in the building:

🔴 Emma (HR Manager): "I left at exactly 5 PM and went straight home. My neighbour saw me arrive at 5:15 PM."

🟡 Karl (Developer): "I worked until 9 PM, but I was in the break room the entire time with my headphones on. I never went to the laptop storage room."

🟢 Sara (Accountant): "I had a client dinner and returned to the office at 7 PM to pick up some documents."

— Evidence found —
• Security camera: Someone in a blue jacket entered the laptop room at 7:30 PM.
• Witnesses confirm Sara was wearing a blue jacket all day.
• Karl's colleague confirms he never left the break room.
• Emma's neighbour confirmed she arrived home at 5:15 PM.`,
    crimeQuestions: [
      {
        question: 'Who stole the laptop?',
        options: ['Emma', 'Karl', 'Sara', 'An unknown outsider'],
        answer: 'Sara',
      },
      {
        question: 'What time did the theft take place?',
        options: ['5:00 PM', '5:15 PM', '7:30 PM', '9:00 PM'],
        answer: '7:30 PM',
      },
      {
        question: 'What was the key piece of evidence?',
        options: [
          "Karl's alibi in the break room",
          "Emma's neighbour's testimony",
          'The blue jacket caught on security camera',
          'The laptop receipt',
        ],
        answer: 'The blue jacket caught on security camera',
      },
    ],
  },
  {
    id: 'celebrity_quiz',
    icon: '🌟',
    name: 'Celebrity Quiz',
    category: 'Fun',
    desc: 'Guess which famous person is being described – 4 rounds!',
    difficulty: 'medium',
    maxPts: 400,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: 'This group won Eurovision 1974 with "Waterloo" and became one of the best-selling music acts of all time.',
        options: ['Roxette', 'ABBA', 'Ace of Base', 'The Cardigans'],
        answer: 'ABBA',
      },
      {
        clue: 'This tech billionaire founded PayPal, Tesla, and SpaceX and wants to colonise Mars.',
        options: ['Jeff Bezos', 'Bill Gates', 'Elon Musk', 'Mark Zuckerberg'],
        answer: 'Elon Musk',
      },
      {
        clue: 'She wore a dress made of raw meat to the 2010 MTV VMAs and is known as Mother Monster by her fans.',
        options: ['Katy Perry', 'Madonna', 'Lady Gaga', 'Beyoncé'],
        answer: 'Lady Gaga',
      },
      {
        clue: 'This footballer known as CR7 has won the Ballon d\'Or five times and plays for the Portuguese national team.',
        options: ['Lionel Messi', 'Cristiano Ronaldo', 'Neymar', 'Kylian Mbappé'],
        answer: 'Cristiano Ronaldo',
      },
    ],
  },
  {
    id: 'music_emoji',
    icon: '🎵',
    name: 'Emoji Songs',
    category: 'Fun',
    desc: 'Guess the song from the emojis – 5 rounds!',
    difficulty: 'medium',
    maxPts: 350,
    type: 'music_emoji',
    emojiRounds: [
      {
        emojis: '🦁 😴 🌿',
        options: ['Hakuna Matata', 'The Lion Sleeps Tonight', 'Circle of Life', 'Born Free'],
        answer: 'The Lion Sleeps Tonight',
      },
      {
        emojis: '☂️ 🌧️ 💃',
        options: ['Purple Rain', 'Here Comes the Rain Again', 'Umbrella', 'Singin\' in the Rain'],
        answer: 'Umbrella',
      },
      {
        emojis: '🕺 🌙 🧤',
        options: ['Thriller', 'Beat It', 'Smooth Criminal', 'Billie Jean'],
        answer: 'Billie Jean',
      },
      {
        emojis: '👸 ❄️ 🏔️',
        options: ['Do You Want to Build a Snowman', 'Let It Go', 'Into the Unknown', 'For the First Time in Forever'],
        answer: 'Let It Go',
      },
      {
        emojis: '🚀 👨 🎸',
        options: ['Space Oddity', 'Starman', 'Rocket Man', 'Major Tom'],
        answer: 'Rocket Man',
      },
    ],
  },
];

export function calcPoints(mission: Mission, elapsed: number): number {
  const ratio = Math.max(0, 1 - elapsed / 120);
  return Math.round(mission.maxPts * 0.3 + mission.maxPts * 0.7 * ratio);
}
