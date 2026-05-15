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
  | 'image_quiz'
  | 'memory_speed'
  | 'color_memory'
  | 'pixel_reveal'
  | 'zoom_in'
  | 'simon_says'
  | 'timeline'
  | 'closest_wins'
  | 'duel_trivia'
  | 'scavenger_hunt'
  | 'trivia_quiz'
  | 'movie_emoji'
  | 'text_quiz';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Statement = { text: string; answer: boolean };
export type CrimeQuestion = { question: string; options: string[]; answer: string };
export type CelebRound = { clue: string; options: string[]; answer: string };
export type EmojiRound = { emojis: string; options: string[]; answer: string };
export type CodeClue = { digits: [number, number, number]; hint: string };
export type MusicRound = { audioUrl: string; artist: string; title: string; year: number };
export type ImageRound = { imageUrl: string; options: string[]; answer: string };
export type MemorySpeedRound = { items: string[]; missing: string; options: string[]; memorizeSeconds?: number };
export type TriviaRound = { question: string; options: string[]; answer: string };
export type TimelineItem = { label: string; year: number };
export type ClosestWinsQuestion = { q: string; answer: number; unit: string; hint: string };

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
  memorySpeedRounds?: MemorySpeedRound[];
  revealWord?: string;
  triviaRounds?: TriviaRound[];
  timelineItems?: TimelineItem[];
  closestWinsQuestions?: ClosestWinsQuestion[];
  textQuizRounds?: { question: string; answer: string; aliases?: string[] }[];
  hexColour?: string;
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
  // ── LIDKÖPING QUIZ ──
  {
    id: 'lidkoping_quiz',
    icon: '🏙️',
    name: 'Lidköping',
    category: 'Knowledge',
    desc: 'How well do you know Lidköping? Five questions — answer in your own words!',
    difficulty: 'medium',
    maxPts: 400,
    type: 'text_quiz',
    textQuizRounds: [
      { question: 'Vad betyder Lidköping?', answer: 'Handelsplats vid Lidan' },
      { question: 'Vad kallas Lidan i folkmun?', answer: 'Älva' },
      { question: 'Rörstrand har jubileum 2026. Hur många år firas?', answer: '300år', aliases: ['300'] },
      { question: 'Vad kallas den del av Gamla staden som finns kvar efter branden 1553?', answer: 'Limtorget' },
      { question: 'Vad användes Rådhuset på torget till innan det flyttades?', answer: 'Jaktpaviljong' },
    ],
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
    id: 'color_memory',
    icon: '🎨',
    name: 'Color Memory',
    category: 'Brain',
    desc: 'A color flashes for 5 seconds — then mix it back using three sliders. How sharp is your memory?',
    difficulty: 'medium',
    maxPts: 400,
    type: 'color_memory',
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
    maxPts: 5000,
    type: 'photo',
    question: 'Everyone on the team must chew Hubba Bubba and blow the biggest bubble possible at the same time. Take a team selfie and upload it – admin will rate your bubbles and award up to 5000 points!',
  },
  {
    id: 'photo_movie_scene',
    icon: '🎥',
    name: 'Lights, Camera, Action!',
    category: 'Fun',
    desc: 'Recreate a famous movie scene – admin rates your performance!',
    difficulty: 'medium',
    maxPts: 5000,
    type: 'photo',
    question: 'Your team must recreate a famous movie scene as accurately as possible — costumes, poses, expressions, everything! Pick any movie you like. Take a photo and upload it — admin will rate your creativity and accuracy for up to 5000 points!',
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
    icon: '🎧',
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
      { audioUrl: 'https://rbkpcnzrimicwzqwvgub.supabase.co/storage/v1/object/public/music/SomeoneLikeYou.mp3', artist: 'Adele', title: 'Someone Like You', year: 2011 },
    ],
  },
  // ── LOGO QUIZ ──
  {
    id: 'logo_quiz',
    icon: '🏢',
    name: 'Logo Quiz',
    category: 'IT',
    desc: 'Recognize the tech company from its logo — these are not the obvious ones!',
    difficulty: 'hard',
    maxPts: 400,
    type: 'image_quiz' as const,
    imageRounds: [
      {
        imageUrl: 'https://cdn.simpleicons.org/figma',
        options: ['Figma', 'Sketch', 'Adobe XD', 'Canva'],
        answer: 'Figma',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/stripe',
        options: ['Stripe', 'Klarna', 'Square', 'Adyen'],
        answer: 'Stripe',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/docker',
        options: ['Docker', 'Kubernetes', 'Red Hat', 'Rancher'],
        answer: 'Docker',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/notion',
        options: ['Notion', 'Coda', 'Obsidian', 'Evernote'],
        answer: 'Notion',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/vercel',
        options: ['Vercel', 'Netlify', 'Railway', 'Render'],
        answer: 'Vercel',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/mongodb',
        options: ['MongoDB', 'Redis', 'CouchDB', 'Cassandra'],
        answer: 'MongoDB',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/grafana',
        options: ['Grafana', 'Kibana', 'Datadog', 'Prometheus'],
        answer: 'Grafana',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/kubernetes/326CE5',
        options: ['Kubernetes', 'Ansible', 'Terraform', 'OpenShift'],
        answer: 'Kubernetes',
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
        imageUrl: '/geo/eiffel.jpg',
        options: ['France', 'Belgium', 'Italy', 'Spain'],
        answer: 'France',
      },
      {
        imageUrl: '/geo/colosseum.jpg',
        options: ['Greece', 'Italy', 'Spain', 'Turkey'],
        answer: 'Italy',
      },
      {
        imageUrl: '/geo/sydney.jpg',
        options: ['New Zealand', 'South Africa', 'Australia', 'Canada'],
        answer: 'Australia',
      },
      {
        imageUrl: '/geo/tajmahal.jpg',
        options: ['Pakistan', 'Bangladesh', 'India', 'Sri Lanka'],
        answer: 'India',
      },
      {
        imageUrl: '/geo/fuji.jpg',
        options: ['China', 'Japan', 'South Korea', 'Vietnam'],
        answer: 'Japan',
      },
      {
        imageUrl: '/geo/liberty.jpg',
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
    icon: '✏️',
    name: 'Pictionary',
    category: 'Fun',
    desc: 'One person draws, the rest guess — admin rates your teamwork!',
    difficulty: 'easy',
    maxPts: 5000,
    type: 'photo',
    revealWord: 'ARTIFICIAL INTELLIGENCE',
    question: 'One person in the team must draw the secret word on paper WITHOUT speaking, writing letters/numbers, or making sounds. The rest of the team must guess what it is.\n\nReveal the word below when everyone is ready — then draw! Take a photo of your drawing + your team reacting and upload it. Admin will rate your performance!',
  },
  // ── MOVIE EMOJI ──
  {
    id: 'movie_emoji',
    icon: '🎬',
    name: 'Emoji Movies',
    category: 'Fun',
    desc: 'Guess the movie from the emoji clues — can your team crack all 5?',
    difficulty: 'medium',
    maxPts: 400,
    type: 'movie_emoji',
    emojiRounds: [
      {
        emojis: '🤠 🚀 🦕 📦 🧸 🚂',
        options: ['Toy Story', 'Cars', 'A Bug\'s Life', 'Monsters, Inc.'],
        answer: 'Toy Story',
      },
      {
        emojis: '🏹 🔥 👱‍♀️ 🍞 🌹 💀 👑',
        options: ['The Hunger Games', 'Brave', 'Divergent', 'Twilight'],
        answer: 'The Hunger Games',
      },
      {
        emojis: '🛡️ 🕷️ 🪓 🏹 🗽 💥 🛸',
        options: ['The Avengers', 'Justice League', 'X-Men', 'Iron Man'],
        answer: 'The Avengers',
      },
      {
        emojis: '🛹 🕷️ 🔬 🦎 🌉 👴 💥',
        options: ['Spider-Man', 'The Amazing Spider-Man', 'Spider-Man: Homecoming', 'Venom'],
        answer: 'Spider-Man',
      },
      {
        emojis: '👴 🎈 🏠 🦜 🐕 🧒 🎒',
        options: ['Up', 'Coco', 'Inside Out', 'Ratatouille'],
        answer: 'Up',
      },
      {
        emojis: '🐉 👦 🦷 🛡️ ⚔️ 🇳🇴 🦾',
        options: ['How to Train Your Dragon', 'Brave', 'The Hobbit', 'Eragon'],
        answer: 'How to Train Your Dragon',
      },
    ],
  },
  // ── FILM QUIZ ──
  {
    id: 'film_quiz',
    icon: '🍿',
    name: 'Film Quiz',
    category: 'Fun',
    desc: 'Iconic movie quotes, scenes and facts — 6 rounds!',
    difficulty: 'medium',
    maxPts: 400,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: '🎬 "You can\'t handle the truth!" — In which 1992 courtroom drama does Jack Nicholson deliver this iconic line?',
        options: ['The Firm', 'A Few Good Men', 'Primal Fear', 'Philadelphia'],
        answer: 'A Few Good Men',
      },
      {
        clue: '🎬 Which 1994 Quentin Tarantino film follows hitmen Vincent Vega and Jules Winnfield through a series of loosely connected stories in Los Angeles?',
        options: ['Reservoir Dogs', 'Jackie Brown', 'Kill Bill', 'Pulp Fiction'],
        answer: 'Pulp Fiction',
      },
      {
        clue: '🎬 In which film does Leonardo DiCaprio play a con artist who successfully impersonates a pilot, doctor and lawyer — all before the age of 21?',
        options: ['The Wolf of Wall Street', 'Catch Me If You Can', 'The Aviator', 'Shutter Island'],
        answer: 'Catch Me If You Can',
      },
      {
        clue: '🎬 "Why so serious?" — Which actor won a posthumous Oscar for playing the Joker in The Dark Knight (2008)?',
        options: ['Joaquin Phoenix', 'Jack Nicholson', 'Heath Ledger', 'Jared Leto'],
        answer: 'Heath Ledger',
      },
      {
        clue: '🎬 Which 2014 Christopher Nolan film stars Matthew McConaughey as an astronaut who travels through a wormhole near Saturn in search of a new home for humanity?',
        options: ['Gravity', 'Interstellar', 'The Martian', 'Ad Astra'],
        answer: 'Interstellar',
      },
      {
        clue: '🎬 "I\'ll be back" — In which 1984 sci-fi film does Arnold Schwarzenegger play a killing machine sent back in time?',
        options: ['RoboCop', 'Total Recall', 'Predator', 'The Terminator'],
        answer: 'The Terminator',
      },
    ],
  },
  // ── ANAGRAM ──
  {
    id: 'anagram',
    icon: '🔡',
    name: 'Anagram',
    category: 'IT',
    desc: 'Unscramble the letters to reveal the hidden IT word — type your answer!',
    difficulty: 'medium',
    maxPts: 300,
    type: 'text_input',
    question: 'Unscramble these letters to find the hidden IT word:',
    code: 'T A G O M I L R H',
    answer: 'ALGORITHM',
    hint: 'Hint: It\'s a step-by-step set of instructions for solving a problem.',
  },
  // ── SNABB-MATTE ──
  {
    id: 'snabb_matte',
    icon: '🧮',
    name: 'Quick Maths',
    category: 'Fun',
    desc: 'Mental math against the clock — 4 rounds, no calculator allowed!',
    difficulty: 'medium',
    maxPts: 300,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: '🧮 What is:\n\n15 × 12 = ?',
        options: ['170', '175', '180', '185'],
        answer: '180',
      },
      {
        clue: '🧮 What is:\n\n144 ÷ 9 = ?',
        options: ['14', '15', '16', '18'],
        answer: '16',
      },
      {
        clue: '🧮 What is:\n\n2⁸ = ?',
        options: ['128', '256', '512', '64'],
        answer: '256',
      },
      {
        clue: '🧮 What is:\n\n7 × 8 × 3 = ?',
        options: ['162', '165', '168', '172'],
        answer: '168',
      },
    ],
  },
  // ── SVÅRA ORD ──
  {
    id: 'svara_ord',
    icon: '👄',
    name: 'Spelling Bee',
    category: 'Fun',
    desc: 'Which is the correct spelling? 5 notoriously tricky words!',
    difficulty: 'easy',
    maxPts: 250,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: '📝 Which is the correct spelling?',
        options: ['Occurance', 'Occurence', 'Occurrence', 'Occurrance'],
        answer: 'Occurrence',
      },
      {
        clue: '📝 Which is the correct spelling?',
        options: ['Mediteranean', 'Mediterranean', 'Mediterranian', 'Mediteranian'],
        answer: 'Mediterranean',
      },
      {
        clue: '📝 Which is the correct spelling?',
        options: ['Entrepreneur', 'Entrepeneur', 'Entrepraneur', 'Enterpreneur'],
        answer: 'Entrepreneur',
      },
      {
        clue: '📝 Which is the correct spelling?',
        options: ['Consientious', 'Consciencious', 'Conscientous', 'Conscientious'],
        answer: 'Conscientious',
      },
      {
        clue: '📝 Which is the correct spelling?',
        options: ['Neccessary', 'Necesary', 'Nessecary', 'Necessary'],
        answer: 'Necessary',
      },
    ],
  },
  // ── FLAGG-QUIZ ──
  {
    id: 'flag_quiz',
    icon: '🏳️',
    name: 'Flag Quiz',
    category: 'Fun',
    desc: 'Can you tell these easily-confused flags apart? 8 rounds!',
    difficulty: 'hard',
    maxPts: 400,
    type: 'image_quiz' as const,
    imageRounds: [
      {
        imageUrl: 'https://flagcdn.com/w320/ie.png',
        options: ['Ireland', 'Ivory Coast', 'Italy', 'Hungary'],
        answer: 'Ireland',
      },
      {
        imageUrl: 'https://flagcdn.com/w320/au.png',
        options: ['Australia', 'New Zealand', 'Fiji', 'Tuvalu'],
        answer: 'Australia',
      },
      {
        imageUrl: 'https://flagcdn.com/w320/ro.png',
        options: ['Romania', 'Chad', 'Andorra', 'Moldova'],
        answer: 'Romania',
      },
      {
        imageUrl: 'https://flagcdn.com/w320/co.png',
        options: ['Colombia', 'Ecuador', 'Venezuela', 'Bolivia'],
        answer: 'Colombia',
      },
      {
        imageUrl: 'https://flagcdn.com/w320/lu.png',
        options: ['Luxembourg', 'Netherlands', 'France', 'Croatia'],
        answer: 'Luxembourg',
      },
      {
        imageUrl: 'https://flagcdn.com/w320/is.png',
        options: ['Iceland', 'Norway', 'Denmark', 'Faroe Islands'],
        answer: 'Iceland',
      },
      {
        imageUrl: 'https://flagcdn.com/w320/ml.png',
        options: ['Mali', 'Senegal', 'Guinea', 'Cameroon'],
        answer: 'Mali',
      },
      {
        imageUrl: 'https://flagcdn.com/w320/id.png',
        options: ['Indonesia', 'Monaco', 'Poland', 'Singapore'],
        answer: 'Indonesia',
      },
    ],
  },
  // ── APP-IKONER ──
  {
    id: 'app_icons',
    icon: '📱',
    name: 'App Icons',
    category: 'IT',
    desc: 'Recognize the app from its icon — not your everyday apps!',
    difficulty: 'hard',
    maxPts: 350,
    type: 'image_quiz' as const,
    imageRounds: [
      {
        imageUrl: 'https://cdn.simpleicons.org/revolut/0075EB',
        options: ['Revolut', 'N26', 'Monzo', 'Wise'],
        answer: 'Revolut',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/threads/000000',
        options: ['Threads', 'Mastodon', 'Bluesky', 'Twitter'],
        answer: 'Threads',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/wise/9FE870',
        options: ['Wise', 'Revolut', 'Payoneer', 'Skrill'],
        answer: 'Wise',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/cashapp/00C244',
        options: ['Cash App', 'Venmo', 'Zelle', 'PayPal'],
        answer: 'Cash App',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/strava/FC4C02',
        options: ['Strava', 'Nike Run Club', 'Garmin Connect', 'MapMyRun'],
        answer: 'Strava',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/letterboxd/00AC00',
        options: ['Letterboxd', 'IMDb', 'Rotten Tomatoes', 'Trakt'],
        answer: 'Letterboxd',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/signal/3A76F0',
        options: ['Signal', 'Telegram', 'WhatsApp', 'Viber'],
        answer: 'Signal',
      },
      {
        imageUrl: 'https://cdn.simpleicons.org/lichess/000000',
        options: ['Lichess', 'Chess.com', 'ChessKid', 'Maia Chess'],
        answer: 'Lichess',
      },
    ],
  },
  // ── VEM SA DET? ──
  {
    id: 'vem_sa_det',
    icon: '💬',
    name: 'Who Said It?',
    category: 'Fun',
    desc: 'Match the famous quote to the right person — 5 rounds!',
    difficulty: 'easy',
    maxPts: 300,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: '"To infinity and beyond!"',
        options: ['Woody', 'Buzz Lightyear', 'Yoda', 'Iron Man'],
        answer: 'Buzz Lightyear',
      },
      {
        clue: '"Elementary, my dear Watson."',
        options: ['Hercule Poirot', 'James Bond', 'Sherlock Holmes', 'Columbo'],
        answer: 'Sherlock Holmes',
      },
      {
        clue: '"I have a dream."',
        options: ['Barack Obama', 'Malcolm X', 'Nelson Mandela', 'Martin Luther King Jr.'],
        answer: 'Martin Luther King Jr.',
      },
      {
        clue: '"Houston, we have a problem."\n\nThis line was said by an astronaut during the Apollo 13 mission. Who said it?',
        options: ['Neil Armstrong', 'Buzz Aldrin', 'Jim Lovell', 'Yuri Gagarin'],
        answer: 'Jim Lovell',
      },
      {
        clue: '"The greatest glory in living lies not in never falling, but in rising every time we fall."',
        options: ['Mahatma Gandhi', 'Winston Churchill', 'Nelson Mandela', 'Abraham Lincoln'],
        answer: 'Nelson Mandela',
      },
    ],
  },
  // ── SPORT-QUIZ ──
  {
    id: 'sport_quiz',
    icon: '🏅',
    name: 'Sports Quiz',
    category: 'Fun',
    desc: 'Records, legends and iconic moments in sport — 5 rounds!',
    difficulty: 'medium',
    maxPts: 300,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: '🏃 What is Usain Bolt\'s world record time for the 100m sprint, set in 2009?',
        options: ['9.48s', '9.58s', '9.68s', '9.78s'],
        answer: '9.58s',
      },
      {
        clue: '⚽ Which country has won the most FIFA World Cup titles?',
        options: ['Germany', 'Italy', 'Brazil', 'France'],
        answer: 'Brazil',
      },
      {
        clue: '🏊 How many Olympic gold medals did swimmer Michael Phelps win across his entire career?',
        options: ['18', '20', '23', '28'],
        answer: '23',
      },
      {
        clue: '🎾 Which tennis player holds the all-time record for most Grand Slam singles titles in men\'s tennis?',
        options: ['Roger Federer', 'Novak Djokovic', 'Rafael Nadal', 'Pete Sampras'],
        answer: 'Novak Djokovic',
      },
      {
        clue: '🏟️ In which city were the 1912 Summer Olympics held?',
        options: ['London', 'Paris', 'Berlin', 'Stockholm'],
        answer: 'Stockholm',
      },
    ],
  },
  // ── VARUMÄRKESSLOGANS ──
  {
    id: 'slogans',
    icon: '📣',
    name: 'Brand Slogans',
    category: 'Fun',
    desc: 'Which brand does this slogan belong to? 5 rounds!',
    difficulty: 'medium',
    maxPts: 250,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: '📣 Which brand uses the slogan:\n\n"The Ultimate Driving Machine"',
        options: ['Mercedes-Benz', 'Audi', 'BMW', 'Volkswagen'],
        answer: 'BMW',
      },
      {
        clue: '📣 Which brand uses the slogan:\n\n"Open Happiness"',
        options: ['Pepsi', 'Coca-Cola', 'Sprite', 'Dr Pepper'],
        answer: 'Coca-Cola',
      },
      {
        clue: '📣 Which brand uses the slogan:\n\n"Impossible Is Nothing"',
        options: ['Nike', 'Puma', 'New Balance', 'Adidas'],
        answer: 'Adidas',
      },
      {
        clue: '📣 Which brand uses the slogan:\n\n"Melts in Your Mouth, Not in Your Hands"',
        options: ["Hershey's", 'Kit Kat', "M&M's", "Reese's"],
        answer: "M&M's",
      },
      {
        clue: '📣 Which brand uses the slogan:\n\n"Taste the Rainbow"',
        options: ['Starburst', 'Haribo', 'Jolly Rancher', 'Skittles'],
        answer: 'Skittles',
      },
    ],
  },
  // ── GISSA ÅRET ──
  {
    id: 'gissa_aret',
    icon: '🗓️',
    name: 'Guess the Year',
    category: 'Fun',
    desc: 'When did it happen? Test your knowledge of historical moments — 5 rounds!',
    difficulty: 'medium',
    maxPts: 300,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: '📅 In what year did the Berlin Wall fall, reuniting East and West Germany?',
        options: ['1985', '1987', '1989', '1991'],
        answer: '1989',
      },
      {
        clue: '📅 In what year did Apple release the very first iPhone?',
        options: ['2005', '2006', '2007', '2008'],
        answer: '2007',
      },
      {
        clue: '📅 In what year did Sweden join the European Union?',
        options: ['1993', '1995', '1997', '1999'],
        answer: '1995',
      },
      {
        clue: '📅 In what year did the Titanic sink on its maiden voyage?',
        options: ['1908', '1910', '1912', '1914'],
        answer: '1912',
      },
      {
        clue: '📅 In what year was the first email ever sent, by Ray Tomlinson?',
        options: ['1969', '1971', '1975', '1980'],
        answer: '1971',
      },
    ],
  },
  // ── SPOT THE ERROR ──
  {
    id: 'spot_error',
    icon: '🚨',
    name: 'Spot the Error',
    category: 'Fun',
    desc: 'Each statement has one deliberate mistake — can you find it?',
    difficulty: 'medium',
    maxPts: 350,
    type: 'celebrity_quiz',
    celebRounds: [
      {
        clue: '🔍 Find the mistake:\n\n"In the famous painting The Scream by Edvard Munch, the figure is holding its hands over its eyes."',
        options: ['The hands are over the ears, not the eyes', 'The painting is actually called The Cry', 'The artist is Pablo Picasso, not Munch', 'The background shows a city skyline'],
        answer: 'The hands are over the ears, not the eyes',
      },
      {
        clue: '🔍 Find the mistake:\n\n"In Monopoly, if you land on Go you collect £100."',
        options: ['You only collect money when you pass Go, not land on it', 'You collect £200, not £100', 'Landing on Go sends you to jail', 'Go is called Start in the official rules'],
        answer: 'You collect £200, not £100',
      },
      {
        clue: '🔍 Find the mistake:\n\n"The three Unforgivable Curses in Harry Potter are: Avada Kedavra, Crucio, and Expelliarmus."',
        options: ['Expelliarmus is the Disarming Charm, not an Unforgivable Curse — the third is Imperio', 'Avada Kedavra causes sleep, not death', 'There are actually four Unforgivable Curses', 'Crucio was invented by Voldemort'],
        answer: 'Expelliarmus is the Disarming Charm, not an Unforgivable Curse — the third is Imperio',
      },
      {
        clue: '🔍 Find the mistake:\n\n"The Eiffel Tower was built as a permanent landmark to celebrate the French Revolution\'s 100th anniversary."',
        options: ['It was actually designed by Gustave Monet', 'It was originally built as a temporary structure, intended to be demolished', 'It was built for the 200th anniversary', 'It was originally intended as a lighthouse'],
        answer: 'It was originally built as a temporary structure, intended to be demolished',
      },
      {
        clue: '🔍 Find the mistake:\n\n"A group of flamingos is called a flock."',
        options: ['A group of flamingos is actually called a flamboyance', 'Flamingos are native to Antarctica', 'A group of flamingos is called a pride', 'Flamingos are pink because of their feathers, not their diet'],
        answer: 'A group of flamingos is actually called a flamboyance',
      },
    ],
  },
  // ── MEMORY SPEED ──
  {
    id: 'memory_speed',
    icon: '⏱️',
    name: 'Memory Speed',
    category: 'Fun',
    desc: 'Memorize the items — then spot the missing one!',
    difficulty: 'medium',
    maxPts: 400,
    type: 'memory_speed',
    memorySpeedRounds: [
      {
        items: ['🍕 Pizza', '🚗 Car', '🌍 Globe', '🎸 Guitar', '💻 Laptop', '📱 Phone'],
        missing: '🚗 Car',
        options: ['☕ Coffee', '🚗 Car', '🎯 Target', '🔑 Key'],
        memorizeSeconds: 8,
      },
      {
        items: ['🐘 Elephant', '🦁 Lion', '🐬 Dolphin', '🦊 Fox', '🐢 Turtle', '🦅 Eagle'],
        missing: '🦊 Fox',
        options: ['🐺 Wolf', '🦋 Butterfly', '🦊 Fox', '🐸 Frog'],
        memorizeSeconds: 8,
      },
      {
        items: ['🍎 Apple', '🍊 Orange', '🍋 Lemon', '🍇 Grapes', '🍓 Strawberry', '🥝 Kiwi', '🍑 Peach', '🥭 Mango'],
        missing: '🍇 Grapes',
        options: ['🍒 Cherry', '🍈 Melon', '🫐 Blueberry', '🍇 Grapes'],
        memorizeSeconds: 10,
      },
      {
        items: ['🗼 Eiffel Tower', '🗽 Statue of Liberty', '🏯 Castle', '⛩️ Torii Gate', '🕌 Mosque', '🏛️ Parthenon', '🗿 Moai', '🕍 Synagogue'],
        missing: '🏯 Castle',
        options: ['⛪ Church', '🏯 Castle', '🏟️ Stadium', '🏰 Palace'],
        memorizeSeconds: 10,
      },
    ],
  },
  // ── HUMAN STATUE ──
  {
    id: 'human_statue',
    icon: '🗿',
    name: 'Human Statue',
    category: 'Fun',
    desc: 'Create a human sculpture — admin rates your pose!',
    difficulty: 'easy',
    maxPts: 5000,
    type: 'photo',
    question: 'Your entire team must form a human sculpture/pose together representing the word:\n\n🗿 **TEAMWORK**\n\nNo props allowed — only your bodies! Hold the pose, take a team photo and upload it. Admin will judge your creativity and accuracy for up to 5000 points!',
  },
  // ── AD SHOT ──
  {
    id: 'photo_ad_shot',
    icon: '📦',
    name: 'Ad Shot',
    category: 'Fun',
    desc: 'Find a product and shoot the most professional product ad photo you can — admin rates it!',
    difficulty: 'medium',
    maxPts: 5000,
    type: 'photo',
    question: 'Find any product nearby and create the most professional-looking product advertisement photo possible. Think lighting, angles, composition, and creativity!\n\nUpload your best shot — admin will judge how convincing your ad looks for up to 5000 points!',
  },
  // ── MIRROR SELFIE ──
  {
    id: 'photo_mirror_selfie',
    icon: '🪞',
    name: 'Mirror Selfie',
    category: 'Fun',
    desc: 'Team photo in a mirror — nobody can appear directly in the shot, only as a reflection!',
    difficulty: 'medium',
    maxPts: 5000,
    type: 'photo',
    question: "Take a team photo using a mirror — but here's the catch: nobody on the team can appear directly in the photo, only as a reflection!\n\nAll team members must be visible in the mirror. Get creative with angles and positioning. Upload your best shot — admin rates your execution for up to 5000 points!",
  },
  // ── SHADOW SELFIE ──
  {
    id: 'photo_shadow_selfie',
    icon: '🌑',
    name: 'Shadow Selfie',
    category: 'Fun',
    desc: "Combine your shadows to form a recognizable shape — then photograph it!",
    difficulty: 'hard',
    maxPts: 5000,
    type: 'photo',
    question: "Work together to position yourselves so that your combined shadows form a clearly recognizable shape or object on a flat surface.\n\nPhotograph the shadows from the best angle — no editing allowed! Admin will rate how recognizable and creative your shadow shape is for up to 5000 points!",
  },
  // ── COLOUR MATCH ──
  {
    id: 'photo_colour_match',
    icon: '🟦',
    name: 'Colour Match',
    category: 'Fun',
    desc: 'Find a real-world object matching this exact hex colour — the closer the match, the more points!',
    difficulty: 'medium',
    maxPts: 5000,
    type: 'photo',
    hexColour: '#3D85C8',
    question: 'Find a physical object that matches this hex colour as closely as possible. Place the object against a neutral background if possible, and take a clear close-up photo. Admin will judge how close your colour match is for up to 5000 points!',
  },
  // ── WEIRDEST SIGN ──
  {
    id: 'photo_weird_sign',
    icon: '🚧',
    name: 'Weirdest Sign',
    category: 'Fun',
    desc: 'Find and photograph the strangest, funniest or most unusual sign you can — admin rates it!',
    difficulty: 'easy',
    maxPts: 5000,
    type: 'photo',
    question: 'Go exploring and find the weirdest, most confusing, funniest, or most unusual sign anywhere nearby.\n\nCould be a warning, a notice, a label — anything counts! Take a clear photo of the sign in context and upload it. Admin will rate how weird or funny it is for up to 5000 points!',
  },
  // ── TIMELINE ──
  {
    id: 'timeline',
    icon: '📅',
    name: 'Timeline',
    category: 'Trivia',
    desc: 'Sort 5 historical events into the correct chronological order. Each correctly placed event earns points!',
    difficulty: 'medium',
    maxPts: 400,
    type: 'timeline',
    timelineItems: [
      { label: 'First Apple Macintosh computer released', year: 1984 },
      { label: 'First text message (SMS) ever sent', year: 1992 },
      { label: 'Google founded in a garage in California', year: 1998 },
      { label: 'Wikipedia goes online', year: 2001 },
      { label: 'YouTube launched', year: 2005 },
    ],
  },
  // ── CLOSEST WINS ──
  {
    id: 'closest_wins',
    icon: '🎯',
    name: 'Closest Wins',
    category: 'Trivia',
    desc: 'Guess numbers as close to the correct answer as possible. Precision is rewarded — the closer, the more points!',
    difficulty: 'medium',
    maxPts: 500,
    type: 'closest_wins',
  },
  // ── DUEL TRIVIA ──
  {
    id: 'duel_trivia',
    icon: '⚔️',
    name: 'Duel Trivia',
    category: 'Social',
    desc: 'Challenge a rival team! Answer trivia questions correctly to steal 10% of their points per correct answer (max 30%).',
    difficulty: 'hard',
    maxPts: 600,
    type: 'duel_trivia',
  },
  // ── SCAVENGER HUNT ──
  {
    id: 'scavenger_hunt',
    icon: '📍',
    name: 'Scavenger Hunt',
    category: 'Action',
    desc: 'Find and photograph 8 items from the list. Admin rates each photo — the more you find, the more points you earn!',
    difficulty: 'medium',
    maxPts: 5000,
    type: 'scavenger_hunt',
  },

  // ── GKN AEROSPACE ──
  {
    id: 'gkn_aircraft_quiz',
    icon: '🛫',
    name: 'Spot the Aircraft',
    category: 'GKN Aerospace',
    desc: 'Can you identify the aircraft from the photo? Guess fast for maximum points!',
    difficulty: 'medium',
    maxPts: 450,
    type: 'image_quiz',
    imageRounds: [
      {
        imageUrl: '/aircraft/a350.jpg',
        answer: 'Airbus A350',
        options: ['Airbus A350', 'Boeing 787', 'Airbus A330', 'Boeing 777'],
      },
      {
        imageUrl: '/aircraft/b787.jpg',
        answer: 'Boeing 787 Dreamliner',
        options: ['Boeing 787 Dreamliner', 'Boeing 777', 'Airbus A350', 'Boeing 767'],
      },
      {
        imageUrl: '/aircraft/a380.jpg',
        answer: 'Airbus A380',
        options: ['Airbus A380', 'Boeing 747', 'Airbus A350', 'Boeing 777X'],
      },
      {
        imageUrl: '/aircraft/f35.jpg',
        answer: 'F-35 Lightning II',
        options: ['F-35 Lightning II', 'F-22 Raptor', 'Eurofighter Typhoon', 'JAS 39 Gripen'],
      },
      {
        imageUrl: '/aircraft/b737max.jpg',
        answer: 'Boeing 737 MAX',
        options: ['Boeing 737 MAX', 'Airbus A320neo', 'Boeing 757', 'Airbus A321'],
      },
      {
        imageUrl: '/aircraft/a320neo.jpg',
        answer: 'Airbus A320neo',
        options: ['Airbus A320neo', 'Boeing 737 MAX', 'Airbus A319', 'Boeing 717'],
      },
    ],
  },
  {
    id: 'gkn_trivia',
    icon: '🔩',
    name: 'GKN Trivia',
    category: 'GKN Aerospace',
    desc: 'Test your knowledge about GKN Aerospace — four questions, one chance each!',
    difficulty: 'hard',
    maxPts: 400,
    type: 'trivia_quiz',
    triviaRounds: [
      {
        question: 'GKN Engine Systems in Trollhättan manufactures components for the GE9X engine. Which aircraft does this engine power?',
        options: ['Airbus A350', 'Boeing 787', 'Boeing 777X', 'Airbus A380'],
        answer: 'Boeing 777X',
      },
      {
        question: 'What type of aircraft component is a "nacelle"?',
        options: ['The wing\'s leading edge', 'The housing around a jet engine', 'The landing gear assembly', 'The cockpit windshield'],
        answer: 'The housing around a jet engine',
      },
      {
        question: 'GKN Aerospace manufactures "transparencies" for aircraft — what are they?',
        options: ['Cockpit and cabin windows', 'Wing leading edge panels', 'Fuel system components', 'Engine exhaust nozzles'],
        answer: 'Cockpit and cabin windows',
      },
      {
        question: 'In 2025, GKN Aerospace acquired a foundry. What was its name?',
        options: ['CPP', 'TPC', 'CPT', 'TCP'],
        answer: 'TPC',
      },
    ],
  },
  {
    id: 'gkn_truefalse',
    icon: '🛩️',
    name: 'Aviation True or False',
    category: 'GKN Aerospace',
    desc: 'True or false? Test your knowledge of GKN Aerospace and aviation.',
    difficulty: 'easy',
    maxPts: 200,
    type: 'truefalse',
    statements: [
      { text: "GKN Aerospace's site in Filton, UK was involved in the development of Concorde.", answer: true },
      { text: 'The Airbus A350 was the first commercial aircraft to have a fuselage made primarily from carbon fibre.', answer: false },
      { text: 'Carbon fibre composite materials are lighter than aluminium.', answer: true },
      { text: 'GKN\'s industrial roots date all the way back to the 18th century.', answer: true },
      { text: 'A carbon fibre composite component is typically around 3 times stronger than steel at the same weight.', answer: false },
    ],
  },
  {
    id: 'gkn_closest',
    icon: '📊',
    name: 'Aviation Numbers',
    category: 'GKN Aerospace',
    desc: 'Guess aviation and GKN numbers as accurately as possible. The closer you are, the more points you earn!',
    difficulty: 'medium',
    maxPts: 450,
    type: 'closest_wins',
    closestWinsQuestions: [
      { q: 'How many employees does GKN Aerospace have globally?', answer: 15000, unit: 'employees', hint: 'They operate across 15+ countries' },
      { q: 'How fast does a modern commercial aircraft cruise, in km/h?', answer: 900, unit: 'km/h', hint: 'Think about a transatlantic flight duration' },
      { q: 'In what year were GKN\'s earliest industrial roots established?', answer: 1759, unit: '', hint: 'It was during the Industrial Revolution era' },
    ],
  },
  {
    id: 'gkn_pa_sparet',
    icon: '🔍',
    name: 'Guess the Aircraft',
    category: 'GKN Aerospace',
    desc: 'Identify the aircraft from clues — fewer clues used means more points!',
    difficulty: 'hard',
    maxPts: 500,
    type: 'pa_sparet',
    clues: [
      'More than 53% of my structural weight consists of composite materials.',
      'GKN Aerospace manufactures key components including my rear fuselage section.',
      'I took my maiden flight in June 2013 and entered airline service in late 2015.',
      'My wingspan measures approximately 65 metres, wider than a Boeing 777.',
      'Airlines like Qatar Airways, Singapore Airlines and Finnair operate me on long-haul routes.',
    ],
    answer: 'Airbus A350',
  },
  {
    id: 'gkn_timeline',
    icon: '⚙️',
    name: 'GKN History',
    category: 'GKN Aerospace',
    desc: 'Sort key milestones in GKN Aerospace\'s history into the correct chronological order.',
    difficulty: 'medium',
    maxPts: 400,
    type: 'timeline',
    timelineItems: [
      { label: 'Guest, Keen & Nettlefolds (GKN) formed from merger of major British firms', year: 1902 },
      { label: 'Airbus A380 takes its maiden flight — GKN Aerospace supplied key structural components', year: 2005 },
      { label: 'GKN Aerospace acquires Volvo Aero, establishing a major site in Trollhättan, Sweden', year: 2012 },
      { label: 'GKN Aerospace acquires Fokker Technologies, expanding its composite footprint', year: 2015 },
      { label: 'Melrose Industries acquires GKN plc', year: 2018 },
    ],
  },
];

export function calcPoints(mission: Mission, elapsed: number, customMaxPts?: number): number {
  const maxPts = customMaxPts ?? mission.maxPts;
  const ratio = Math.max(0, 1 - elapsed / 120);
  return Math.round(maxPts * 0.3 + maxPts * 0.7 * ratio);
}
