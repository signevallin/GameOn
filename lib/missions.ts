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
  | 'music_emoji'
  | 'crack_code'
  | 'music_quiz'
  | 'image_quiz';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Statement = { text: string; answer: boolean };
export type CrimeQuestion = { question: string; options: string[]; answer: string };
export type CelebRound = { clue: string; options: string[]; answer: string };
export type EmojiRound = { emojis: string; options: string[]; answer: string };
export type CodeClue = { digits: [number, number, number]; hint: string };
export type MusicRound = { audioUrl: string; artist: string; title: string; year: number };
export type ImageRound = { imageUrl: string; options: string[]; answer: string };

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
  codeClues?: CodeClue[];
  crimeStory?: string;
  crimeQuestions?: CrimeQuestion[];
  celebRounds?: CelebRound[];
  emojiRounds?: EmojiRound[];
  musicRounds?: MusicRound[];
  imageRounds?: ImageRound[];
  revealable?: boolean;
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
    desc: 'Which IT concept is hiding in the emojis? 5 rounds!',
    difficulty: 'easy',
    maxPts: 250,
    type: 'music_emoji',
    emojiRounds: [
      {
        emojis: '🔑 + 🔒',
        options: ['Encryption', 'Authentication', 'VPN', 'Firewall'],
        answer: 'Encryption',
      },
      {
        emojis: '🔥 + 🧱',
        options: ['Antivirus', 'Firewall', 'Sandbox', 'Proxy'],
        answer: 'Firewall',
      },
      {
        emojis: '☁️ + 💾',
        options: ['Cloud Storage', 'RAM', 'USB Drive', 'Server Rack'],
        answer: 'Cloud Storage',
      },
      {
        emojis: '🕷️ + 🌐',
        options: ['Bluetooth', 'World Wide Web', 'Dark Web', 'Intranet'],
        answer: 'World Wide Web',
      },
      {
        emojis: '🐞 + 🔎',
        options: ['Hacking', 'Debugging', 'Monitoring', 'Scanning'],
        answer: 'Debugging',
      },
    ],
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
    desc: 'General knowledge – 5 fun questions!',
    difficulty: 'easy',
    maxPts: 250,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: 'How long does it approximately take for light to travel from the Sun to Earth?',
        options: ['8 seconds', '8 minutes', '8 hours', '8 days'],
        answer: '8 minutes',
      },
      {
        clue: 'Who invented the World Wide Web in 1989?',
        options: ['Bill Gates', 'Tim Berners-Lee', 'Steve Jobs', 'Linus Torvalds'],
        answer: 'Tim Berners-Lee',
      },
      {
        clue: 'How many bones does an adult human body have?',
        options: ['156', '206', '248', '306'],
        answer: '206',
      },
      {
        clue: 'Which planet rotates in the opposite direction to most other planets?',
        options: ['Mars', 'Saturn', 'Venus', 'Neptune'],
        answer: 'Venus',
      },
      {
        clue: 'What is the most spoken language in the world by number of native speakers?',
        options: ['English', 'Spanish', 'Hindi', 'Mandarin Chinese'],
        answer: 'Mandarin Chinese',
      },
    ],
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
    id: 'photo_movie_scene',
    icon: '🎬',
    name: 'Lights, Camera, Action!',
    category: 'Fun',
    desc: 'Recreate a famous movie scene – admin rates your performance!',
    difficulty: 'medium',
    maxPts: 500,
    type: 'photo',
    question: 'Your team must recreate a famous movie scene as accurately as possible — costumes, poses, expressions, everything! Pick any movie you like. Take a photo and upload it — admin will rate your creativity and accuracy for up to 500 points!',
  },
  // ── GUESS THE PERSON ──
  {
    id: 'pa_sparet',
    icon: '🕵️',
    name: 'Guess the Person',
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
  // ── GUESS THE DESTINATION ──
  {
    id: 'pa_sparet_destination',
    icon: '✈️',
    name: 'Guess the Destination',
    category: 'Fun',
    desc: 'Guess the travel destination from clues – fewer clues = more points!',
    difficulty: 'hard',
    maxPts: 500,
    type: 'pa_sparet',
    clues: [
      'I am home to the tallest building in the world, which stands at 828 metres.',
      'I transformed from a small pearl-diving village into a global metropolis in just 50 years.',
      'My most famous man-made island is shaped like a palm tree.',
      'I am one of seven emirates in a federation on the Arabian Peninsula.',
      'My national airline is called Emirates.',
    ],
    answer: 'Dubai',
  },
  // ── SOLVE THE CRIME ──
  {
    id: 'solve_crime',
    icon: '🔍',
    name: 'Solve the Crime',
    category: 'Fun',
    desc: 'Read the case carefully and figure out who stole the laptop! Extra info is on the printed paper.',
    difficulty: 'hard',
    maxPts: 450,
    type: 'solve_crime',
    crimeStory: `A company laptop worth 50,000 SEK disappeared from the office yesterday evening.

Three employees were in the building that evening:

🔴 Emma (HR Manager)
"I left at exactly 5 PM and went straight home. My neighbour saw me arrive at 5:15 PM."

🟡 Karl (Developer)
"I worked until 9 PM, but I was in the break room the entire time with my headphones on. I never went near the laptop storage room."

🟢 Sara (Accountant)
"I had a client dinner and came back to the office at 7 PM to pick up some documents."

— Physical evidence (see printed paper for full details) —
• Security camera footage: someone in a distinctive blue jacket entered the laptop room at 7:30 PM.
• A keycard log shows only one person re-entered the building after 6 PM.
• Karl's colleague confirms he was in the break room all evening.
• Emma's neighbour confirmed she arrived home at 5:15 PM and never left again.`,
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
        question: 'What was the key piece of evidence that identified the thief?',
        options: [
          "Karl's alibi in the break room",
          "Emma's neighbour's testimony",
          'The blue jacket caught on security camera',
          'The keycard entry log',
        ],
        answer: 'The blue jacket caught on security camera',
      },
    ],
  },
  // ── CELEBRITY QUIZ ──
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
        clue: "This footballer known as CR7 has won the Ballon d'Or five times and plays for the Portuguese national team.",
        options: ['Lionel Messi', 'Cristiano Ronaldo', 'Neymar', 'Kylian Mbappé'],
        answer: 'Cristiano Ronaldo',
      },
    ],
  },
  // ── EMOJI SONGS ──
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
        options: ['Purple Rain', 'Here Comes the Rain Again', 'Umbrella', "Singin' in the Rain"],
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
  // ── MIX DRINKS ──
  {
    id: 'mix_drinks',
    icon: '🍹',
    name: 'Mix the Drinks',
    category: 'Fun',
    desc: 'Do you know your cocktails? Identify the ingredients – 3 rounds!',
    difficulty: 'medium',
    maxPts: 300,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: 'Zombie is a classic tiki cocktail from the 1930s. Which combination of ingredients is correct?',
        options: [
          'White rum, dark rum, apricot brandy, lime juice & grenadine',
          'Vodka, triple sec, cranberry juice & lime',
          'Gin, tonic water, cucumber & lime',
          'Tequila, blue curaçao, salt & lime',
        ],
        answer: 'White rum, dark rum, apricot brandy, lime juice & grenadine',
      },
      {
        clue: 'The Singapore Sling was created at the Raffles Hotel around 1915. What is its base spirit?',
        options: ['Rum', 'Gin', 'Vodka', 'Whiskey'],
        answer: 'Gin',
      },
      {
        clue: 'The Commonwealth cocktail is a tropical long drink. Which set of ingredients is correct?',
        options: [
          'Rum, elderflower liqueur, passion fruit & lime juice',
          'Vodka, lime juice & ginger beer',
          'Gin, dry vermouth & olive brine',
          'Bourbon, peach schnapps & orange juice',
        ],
        answer: 'Rum, elderflower liqueur, passion fruit & lime juice',
      },
    ],
  },
  // ── FOOD INGREDIENTS ──
  {
    id: 'food_ingredients',
    icon: '🍽️',
    name: 'What\'s in the Dish?',
    category: 'Fun',
    desc: 'Identify the key ingredients of classic dishes – 4 rounds!',
    difficulty: 'medium',
    maxPts: 300,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: 'Which ingredients wrap around the beef fillet in a classic Beef Wellington?',
        options: [
          'Puff pastry, mushroom duxelles & prosciutto',
          'Shortcrust pastry, onion jam & bacon',
          'Bread dough, garlic butter & herbs',
          'Phyllo pastry, spinach & feta',
        ],
        answer: 'Puff pastry, mushroom duxelles & prosciutto',
      },
      {
        clue: 'A traditional Roman Carbonara does NOT contain which ingredient?',
        options: ['Cream', 'Guanciale', 'Egg yolks', 'Pecorino Romano'],
        answer: 'Cream',
      },
      {
        clue: 'What gives traditional Spanish Paella its characteristic yellow colour?',
        options: ['Turmeric', 'Saffron', 'Curry powder', 'Yellow paprika'],
        answer: 'Saffron',
      },
      {
        clue: 'Which noodle type is traditionally used in Pad Thai?',
        options: ['Egg noodles', 'Soba noodles', 'Rice noodles', 'Glass noodles'],
        answer: 'Rice noodles',
      },
    ],
  },
  // ── CRACK THE CODE ──
  {
    id: 'crack_code',
    icon: '🔒',
    name: 'Crack the Code',
    category: 'Fun',
    desc: 'Use the five clues to deduce the secret 3-digit lock code!',
    difficulty: 'hard',
    maxPts: 400,
    type: 'crack_code',
    answer: '394',
    codeClues: [
      { digits: [2, 9, 1], hint: 'One number is correct and in the right place' },
      { digits: [2, 4, 5], hint: 'One number is correct but in the wrong place' },
      { digits: [4, 6, 3], hint: 'Two numbers are correct but in the wrong place' },
      { digits: [5, 7, 8], hint: 'Nothing is correct' },
      { digits: [5, 6, 9], hint: 'One number is correct but in the wrong place' },
    ],
  },
  // ── ENIGMA CIPHER ──
  {
    id: 'enigma_cipher',
    icon: '📡',
    name: 'Enigma Cipher',
    category: 'IT',
    desc: 'Decode the intercepted message using the Caesar cipher!',
    difficulty: 'medium',
    maxPts: 300,
    type: 'text_input',
    question: 'The Enigma machine shifts every letter forward by 3 positions in the alphabet:\nA→D · B→E · C→F · ... · X→A · Y→B · Z→C\n\nDecrypt this intercepted message and type the original word:',
    code: 'HQLJPD',
    answer: 'ENIGMA',
    hint: 'Shift each letter 3 steps BACK. H→E, Q→N, L→I ...',
  },
  // ── MUSIC QUIZ ──
  {
    id: 'music_quiz',
    icon: '🎵',
    name: 'Name That Tune',
    category: 'Fun',
    desc: 'Listen to clips and guess artist + song — then sort them by release year!',
    difficulty: 'medium',
    maxPts: 1000,
    type: 'music_quiz',
    musicRounds: [
      { audioUrl: 'https://rbkpcnzrimicwzqwvgub.supabase.co/storage/v1/object/public/music/Graduation.mp3', artist: 'Vitamin C', title: 'Graduation (Friends Forever)', year: 2000 },
      { audioUrl: 'https://rbkpcnzrimicwzqwvgub.supabase.co/storage/v1/object/public/music/time.mp3', artist: 'Hans Zimmer', title: 'Time', year: 2010 },
      { audioUrl: 'https://rbkpcnzrimicwzqwvgub.supabase.co/storage/v1/object/public/music/Holocene.mp3', artist: 'Bon Iver', title: 'Holocene', year: 2011 },
      { audioUrl: 'https://rbkpcnzrimicwzqwvgub.supabase.co/storage/v1/object/public/music/6inch.mp3', artist: 'Beyoncé', title: '6 Inch (feat. The Weeknd)', year: 2016 },
      { audioUrl: 'https://rbkpcnzrimicwzqwvgub.supabase.co/storage/v1/object/public/music/Lemonade.mp3', artist: 'Beyoncé', title: 'Lemonade', year: 2016 },
    ],
  },
  // ── LOGO QUIZ ──
  {
    id: 'logo_quiz',
    icon: '🏢',
    name: 'Logo Quiz',
    category: 'IT',
    desc: 'Recognize the company from its logo — how many can you get?',
    difficulty: 'easy',
    maxPts: 400,
    type: 'image_quiz' as const,
    imageRounds: [
      {
        imageUrl: 'https://cdn.simpleicons.org/apple',
        options: ['Apple', 'Google', 'Microsoft', 'Samsung'],
        answer: 'Apple',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/spotify',
        options: ['Spotify', 'Apple Music', 'Tidal', 'Deezer'],
        answer: 'Spotify',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/netflix',
        options: ['Netflix', 'HBO Max', 'Disney+', 'Amazon Prime'],
        answer: 'Netflix',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/slack',
        options: ['Slack', 'Discord', 'Microsoft Teams', 'Zoom'],
        answer: 'Slack',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/github',
        options: ['GitHub', 'GitLab', 'Bitbucket', 'Jira'],
        answer: 'GitHub',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/airbnb',
        options: ['Airbnb', 'Booking.com', 'Expedia', 'Tripadvisor'],
        answer: 'Airbnb',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/tesla',
        options: ['Tesla', 'BMW', 'Mercedes-Benz', 'Audi'],
        answer: 'Tesla',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/ikea',
        options: ['IKEA', 'H&M', 'Zara', 'Zalando'],
        answer: 'IKEA',
      },
    ],
  },
  // ── GEOGUESS ──
  {
    id: 'geo_guess',
    icon: '🗺️',
    name: 'GeoGuess',
    category: 'Fun',
    desc: 'Recognize the landmark — which country is it in?',
    difficulty: 'medium',
    maxPts: 400,
    type: 'image_quiz' as const,
    imageRounds: [
      {
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_(cropped).jpg/400px-Tour_Eiffel_Wikimedia_Commons_(cropped).jpg',
        options: ['France', 'Belgium', 'Italy', 'Spain'],
        answer: 'France',
      },
      {
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseo_2020.jpg/400px-Colosseo_2020.jpg',
        options: ['Greece', 'Italy', 'Spain', 'Turkey'],
        answer: 'Italy',
      },
      {
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Sydney_Australia._%2821339175489%29.jpg/400px-Sydney_Australia._%2821339175489%29.jpg',
        options: ['New Zealand', 'South Africa', 'Australia', 'Canada'],
        answer: 'Australia',
      },
      {
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Taj_Mahal%2C_Agra%2C_India_edit3.jpg/400px-Taj_Mahal%2C_Agra%2C_India_edit3.jpg',
        options: ['Pakistan', 'Bangladesh', 'India', 'Sri Lanka'],
        answer: 'India',
      },
      {
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/080103_hakone_fuji.jpg/400px-080103_hakone_fuji.jpg',
        options: ['China', 'Japan', 'South Korea', 'Vietnam'],
        answer: 'Japan',
      },
      {
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Statue_of_Liberty_7.jpg/400px-Statue_of_Liberty_7.jpg',
        options: ['Canada', 'France', 'USA', 'United Kingdom'],
        answer: 'USA',
      },
    ],
  },

  // ── FINISH THE LYRICS ──
  {
    id: 'finish_lyrics',
    icon: '🎤',
    name: 'Finish the Lyrics',
    category: 'Fun',
    desc: 'Complete the next line of these iconic songs!',
    difficulty: 'easy',
    maxPts: 400,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: '🎵 "Is this the real life?\nIs this just fantasy?\nCaught in a landslide,\nNo escape from reality..."',
        options: ['Open your eyes, Look up to the skies and see', 'I am just a poor boy, nobody loves me', 'Anyway the wind blows, doesn\'t really matter', 'Scaramouche, Scaramouche, will you do the fandango'],
        answer: 'Open your eyes, Look up to the skies and see',
      },
      {
        clue: '🎵 "Just a small town girl\nLivin\' in a lonely world\nShe took the midnight train..."',
        options: ['Going anywhere', 'To the city lights', 'To find her dreams', 'Back to her home'],
        answer: 'Going anywhere',
      },
      {
        clue: '🎵 "I\'ve heard there was a secret chord\nThat David played and it pleased the Lord\nBut you don\'t really care for music, do ya?..."',
        options: ['It goes like this, the fourth, the fifth', 'Well, hallelujah, hallelujah', 'The minor fall and the major lift', 'Your faith was strong but you needed proof'],
        answer: 'It goes like this, the fourth, the fifth',
      },
      {
        clue: '🎵 "She\'s got a smile that it seems to me\nReminds me of childhood memories..."',
        options: ['Where everything was as fresh as the bright blue sky', 'And love was all she knew', 'And the days were long and free', 'Where the sun would always shine'],
        answer: 'Where everything was as fresh as the bright blue sky',
      },
      {
        clue: '🎵 "Never gonna give you up\nNever gonna let you down\nNever gonna run around..."',
        options: ['And desert you', 'And leave you cold', 'And make you cry', 'And say goodbye'],
        answer: 'And desert you',
      },
    ],
  },
  // ── PICTIONARY ──
  {
    id: 'pictionary',
    icon: '🎨',
    name: 'Pictionary',
    category: 'Fun',
    desc: 'One person draws, the rest guess — admin rates your teamwork!',
    difficulty: 'easy',
    maxPts: 500,
    type: 'photo',
    revealable: true,
    question: 'One person in the team must draw a word on paper WITHOUT speaking, writing letters/numbers, or making sounds. The rest of the team must guess what it is.\n\n📝 Your word to draw: ARTIFICIAL INTELLIGENCE\n\nTake a photo of your drawing + your team reacting and upload it — admin will rate your performance!',
  },
  // ── HUMAN STATUE ──
  {
    id: 'human_statue',
    icon: '🗿',
    name: 'Human Statue',
    category: 'Fun',
    desc: 'Create a human sculpture — admin rates your pose!',
    difficulty: 'easy',
    maxPts: 500,
    type: 'photo',
    question: 'Your entire team must form a human sculpture/pose together representing the word:\n\n🗿 **TEAMWORK**\n\nNo props allowed — only your bodies! Hold the pose, take a team photo and upload it. Admin will judge your creativity and accuracy for up to 500 points!',
  },
];

export function calcPoints(mission: Mission, elapsed: number): number {
  const ratio = Math.max(0, 1 - elapsed / 120);
  return Math.round(mission.maxPts * 0.3 + mission.maxPts * 0.7 * ratio);
}
