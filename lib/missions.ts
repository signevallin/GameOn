export type MissionType =
  | 'multiple_choice'
  | 'text_input'
  | 'puzzle'
  | 'memory'
  | 'reaction'
  | 'typerace'
  | 'hangman'
  | 'wouldyou'
  | 'truefalse';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type Statement = { text: string; answer: boolean };

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
};

export const MISSIONS: Mission[] = [
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
];

export function calcPoints(mission: Mission, elapsed: number): number {
  const ratio = Math.max(0, 1 - elapsed / 120);
  return Math.round(mission.maxPts * 0.3 + mission.maxPts * 0.7 * ratio);
}
