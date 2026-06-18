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
  // 2010s–2020s Pop
  'Blinding Lights – The Weeknd', 'Starboy – The Weeknd', 'Save Your Tears – The Weeknd',
  'Shape of You – Ed Sheeran', 'Perfect – Ed Sheeran', 'Photograph – Ed Sheeran',
  'Thinking Out Loud – Ed Sheeran', 'Castle on the Hill – Ed Sheeran', 'Don\'t – Ed Sheeran',
  'Uptown Funk – Mark Ronson ft. Bruno Mars', 'Bruno Mars – Just the Way You Are', 'Grenade – Bruno Mars',
  'Rolling in the Deep – Adele', 'Someone Like You – Adele', 'Hello – Adele', 'Skyfall – Adele', 'Easy On Me – Adele',
  'Happy – Pharrell Williams', 'Get Lucky – Daft Punk ft. Pharrell Williams',
  'Stay With Me – Sam Smith', 'In the Lonely Hour – Sam Smith', 'Writing\'s on the Wall – Sam Smith',
  'Shallow – Lady Gaga & Bradley Cooper', 'Old Town Road – Lil Nas X', 'MONTERO – Lil Nas X',
  'Dance Monkey – Tones and I', 'Bad Guy – Billie Eilish', 'Happier Than Ever – Billie Eilish',
  'Ocean Eyes – Billie Eilish', 'Therefore I Am – Billie Eilish', 'Lovely – Billie Eilish & Khalid',
  'Levitating – Dua Lipa', 'Don\'t Start Now – Dua Lipa', 'Physical – Dua Lipa', 'New Rules – Dua Lipa',
  'Watermelon Sugar – Harry Styles', 'Adore You – Harry Styles', 'Sign of the Times – Harry Styles',
  'As It Was – Harry Styles', 'Late Night Talking – Harry Styles',
  'Drivers License – Olivia Rodrigo', 'good 4 u – Olivia Rodrigo', 'brutal – Olivia Rodrigo', 'vampire – Olivia Rodrigo',
  'Anti-Hero – Taylor Swift', 'Shake It Off – Taylor Swift', 'Blank Space – Taylor Swift',
  'Love Story – Taylor Swift', 'You Belong with Me – Taylor Swift', 'Bad Blood – Taylor Swift',
  'Wildest Dreams – Taylor Swift', 'Style – Taylor Swift', 'Cruel Summer – Taylor Swift',
  'cardigan – Taylor Swift', 'Flowers – Miley Cyrus', 'Wrecking Ball – Miley Cyrus', 'The Climb – Miley Cyrus',
  'Calm Down – Rema & Selena Gomez', 'Unholy – Sam Smith & Kim Petras',
  'About Damn Time – Lizzo', 'Good as Hell – Lizzo', 'Truth Hurts – Lizzo',
  'Peaches – Justin Bieber ft. Daniel Caesar & Giveon', 'Ghost – Justin Bieber',
  'Butter – BTS', 'Dynamite – BTS', 'Boy With Luv – BTS',
  'Kill This Love – BLACKPINK', 'How You Like That – BLACKPINK', 'Pink Venom – BLACKPINK',
  'Savage Love – Jawsh 685 & Jason Derulo', 'Mood – 24kGoldn ft. iann dior',
  'Montero (Call Me By Your Name) – Lil Nas X', 'Industry Baby – Lil Nas X',
  'Stay – The Kid LAROI & Justin Bieber', 'Without You – The Kid LAROI',
  'Heat Waves – Glass Animals', 'Grapejuice – Glass Animals',
  'Escapism – RAYE ft. 070 Shake', 'Prada – cassö & RAYE & D-Block Europe',
  'Creepin\' – Metro Boomin ft. The Weeknd & 21 Savage',
  'Flowers – Sam Smith', 'Unholy – Sam Smith', 'Love Me More – Sam Smith',
  // 2000s Pop & R&B
  'Baby One More Time – Britney Spears', 'Toxic – Britney Spears', 'Oops!... I Did It Again – Britney Spears',
  'Crazy in Love – Beyoncé', 'Halo – Beyoncé', 'Single Ladies – Beyoncé',
  'Irreplaceable – Beyoncé', 'Lemonade – Beyoncé', 'Formation – Beyoncé',
  'Just Dance – Lady Gaga', 'Poker Face – Lady Gaga', 'Bad Romance – Lady Gaga',
  'Telephone – Lady Gaga ft. Beyoncé', 'Born This Way – Lady Gaga', 'Edge of Glory – Lady Gaga',
  'We Found Love – Rihanna ft. Calvin Harris', 'Umbrella – Rihanna', 'Diamonds – Rihanna',
  'Only Girl – Rihanna', 'Work – Rihanna ft. Drake', 'Stay – Rihanna ft. Mikky Ekko',
  'California Gurls – Katy Perry', 'Roar – Katy Perry', 'Firework – Katy Perry',
  'Teenage Dream – Katy Perry', 'Dark Horse – Katy Perry', 'Kissed a Girl – Katy Perry',
  'Call Me Maybe – Carly Rae Jepsen', 'Somebody That I Used to Know – Gotye',
  'Suit & Tie – Justin Timberlake', 'Can\'t Stop the Feeling! – Justin Timberlake',
  'Mirrors – Justin Timberlake', 'SexyBack – Justin Timberlake', 'What Goes Around – Justin Timberlake',
  'Sorry – Justin Bieber', 'Love Yourself – Justin Bieber', 'Baby – Justin Bieber',
  'One Time – Justin Bieber', 'What Do You Mean? – Justin Bieber',
  'God\'s Plan – Drake', 'One Dance – Drake', 'Hotline Bling – Drake', 'Started from the Bottom – Drake',
  'Rockstar – Post Malone', 'Sunflower – Post Malone & Swae Lee', 'Circles – Post Malone',
  'Better Now – Post Malone', 'White Iverson – Post Malone',
  'Sicko Mode – Travis Scott', 'HUMBLE. – Kendrick Lamar', 'Alright – Kendrick Lamar',
  'Despacito – Luis Fonsi ft. Daddy Yankee', 'Con Calma – Daddy Yankee & Snow',
  'Lean On – Major Lazer & DJ Snake ft. MØ', 'Cheap Thrills – Sia',
  'Chandelier – Sia', 'Elastic Heart – Sia', 'The Greatest – Sia',
  'Titanium – David Guetta ft. Sia', 'Where Are Ü Now – Jack Ü ft. Justin Bieber',
  'This Is What You Came For – Calvin Harris ft. Rihanna',
  'In My Feelings – Drake', 'Nice for What – Drake',
  'Señorita – Shawn Mendes & Camila Cabello', 'Stitches – Shawn Mendes', 'Mercy – Shawn Mendes',
  'Havana – Camila Cabello ft. Young Thug', 'Never Be the Same – Camila Cabello',
  'Bad at Love – Halsey', 'Without Me – Halsey', 'Graveyard – Halsey',
  'Closer – The Chainsmokers ft. Halsey', 'Something Just Like This – The Chainsmokers & Coldplay',
  'Roses – The Chainsmokers ft. ROZES',
  // 2000s Indie & Alternative
  'Mr. Brightside – The Killers', 'Somebody Told Me – The Killers', 'All These Things That I\'ve Done – The Killers',
  'Human – The Killers', 'Riptide – Vance Joy', 'Mess Is Mine – Vance Joy',
  'Viva la Vida – Coldplay', 'The Scientist – Coldplay', 'Fix You – Coldplay',
  'Yellow – Coldplay', 'Clocks – Coldplay', 'Speed of Sound – Coldplay', 'A Sky Full of Stars – Coldplay',
  'Let Her Go – Passenger', 'Counting Stars – OneRepublic', 'Apologize – Timbaland ft. OneRepublic',
  'Secrets – OneRepublic', 'Good Life – OneRepublic',
  'Radioactive – Imagine Dragons', 'Believer – Imagine Dragons', 'Thunder – Imagine Dragons',
  'Demons – Imagine Dragons', 'Natural – Imagine Dragons', 'Enemy – Imagine Dragons ft. JID',
  'Monster – Imagine Dragons', 'Whatever It Takes – Imagine Dragons',
  'Stressed Out – twenty one pilots', 'Ride – twenty one pilots', 'Heathens – twenty one pilots',
  'Jumpsuit – twenty one pilots', 'Chlorine – twenty one pilots', 'Shy Away – twenty one pilots',
  'Take Me to Church – Hozier', 'Work Song – Hozier', 'Cherry Wine – Hozier', 'Movement – Hozier',
  'Pumped Up Kicks – Foster the People', 'Helena Beat – Foster the People',
  'Little Lion Man – Mumford & Sons', 'I Will Wait – Mumford & Sons', 'The Cave – Mumford & Sons',
  'Ho Hey – The Lumineers', 'Stubborn Love – The Lumineers', 'Ophelia – The Lumineers',
  'Dog Days Are Over – Florence + the Machine', 'You\'ve Got the Love – Florence + the Machine',
  'Shake It Out – Florence + the Machine', 'Ship to Wreck – Florence + the Machine',
  'Skinny Love – Bon Iver', 'Holocene – Bon Iver', 'Towers – Bon Iver',
  'Home – Edward Sharpe & The Magnetic Zeros', '40 Day Dream – Edward Sharpe',
  'Such Great Heights – The Postal Service', 'Brand New Colony – The Postal Service',
  'Helena – My Chemical Romance', 'Welcome to the Black Parade – My Chemical Romance',
  'Famous Last Words – My Chemical Romance', 'I\'m Not Okay – My Chemical Romance',
  'Sugar We\'re Goin Down – Fall Out Boy', 'Thnks fr th Mmrs – Fall Out Boy',
  'Dance, Dance – Fall Out Boy', 'Centuries – Fall Out Boy',
  'I Write Sins Not Tragedies – Panic! at the Disco', 'Nine in the Afternoon – Panic! at the Disco',
  'High Hopes – Panic! at the Disco', 'Death of a Bachelor – Panic! at the Disco',
  'Miss Jackson – Panic! at the Disco', 'This Is Gospel – Panic! at the Disco',
  // 1990s Pop & R&B
  'Wannabe – Spice Girls', 'Say You\'ll Be There – Spice Girls', 'Spice Up Your Life – Spice Girls',
  'Bye Bye Bye – NSYNC', 'It\'s Gonna Be Me – NSYNC', 'Tearin\' Up My Heart – NSYNC',
  'I Want It That Way – Backstreet Boys', 'Everybody – Backstreet Boys', 'Quit Playing Games – Backstreet Boys',
  'Larger Than Life – Backstreet Boys', 'Show Me the Meaning – Backstreet Boys',
  'No Scrubs – TLC', 'Waterfalls – TLC', 'Creep – TLC',
  'Killing Me Softly – Fugees', 'Ready or Not – Fugees', 'No Woman No Cry – Fugees',
  'Gangsta\'s Paradise – Coolio', 'Cantaloop – US3', 'Return of the Mack – Mark Morrison',
  'Mambo No. 5 – Lou Bega', 'Macarena – Los Del Rio', 'La Bamba – Los Lobos',
  '(Everything I Do) I Do It for You – Bryan Adams', 'Summer of \'69 – Bryan Adams',
  'Have You Ever Really Loved a Woman – Bryan Adams',
  'My Heart Will Go On – Celine Dion', 'The Power of Love – Celine Dion', 'Think Twice – Celine Dion',
  'I Will Always Love You – Whitney Houston', 'Greatest Love of All – Whitney Houston',
  'I\'m Every Woman – Whitney Houston', 'Saving All My Love – Whitney Houston',
  'Hero – Mariah Carey', 'We Belong Together – Mariah Carey', 'Fantasy – Mariah Carey',
  'Always Be My Baby – Mariah Carey', 'Emotions – Mariah Carey',
  'End of the Road – Boyz II Men', 'I\'ll Make Love to You – Boyz II Men',
  'One Sweet Day – Mariah Carey & Boyz II Men',
  'You Were Meant for Me – Jewel', 'Hands – Jewel',
  'Torn – Natalie Imbruglia', 'Big Yellow Taxi – Counting Crows ft. Vanessa Carlton',
  'Iris – Goo Goo Dolls', 'Slide – Goo Goo Dolls', 'Broadway – Goo Goo Dolls',
  'Smooth – Santana ft. Rob Thomas', 'Livin\' la Vida Loca – Ricky Martin', 'She Bangs – Ricky Martin',
  'Bailamos – Enrique Iglesias', 'Hero – Enrique Iglesias', 'Be With You – Enrique Iglesias',
  'Who Let the Dogs Out – Baha Men', 'Mambo No. 5 – Lou Bega',
  'Blue (Da Ba Dee) – Eiffel 65', 'Daft Punk is Playing at My House – LCD Soundsystem',
  'Steal My Sunshine – Len', 'Closing Time – Semisonic',
  'Semi-Charmed Life – Third Eye Blind', 'Jumper – Third Eye Blind',
  'Breakfast at Tiffany\'s – Deep Blue Something',
  'Bittersweet Symphony – The Verve', 'The Drugs Don\'t Work – The Verve',
  'Karma Police – Radiohead', 'Creep – Radiohead', 'Fake Plastic Trees – Radiohead',
  'High and Dry – Radiohead', 'Just – Radiohead',
  '1979 – Smashing Pumpkins', 'Bullet with Butterfly Wings – Smashing Pumpkins',
  'Tonight Tonight – Smashing Pumpkins', 'Zero – Smashing Pumpkins',
  // 1980s
  'Take On Me – a-ha', 'The Sun Always Shines on TV – a-ha', 'Hunting High and Low – a-ha',
  'Sweet Dreams (Are Made of This) – Eurythmics', 'Here Comes the Rain Again – Eurythmics',
  'Girls Just Want to Have Fun – Cyndi Lauper', 'Time After Time – Cyndi Lauper',
  'True Colors – Cyndi Lauper', 'She Bop – Cyndi Lauper',
  'Wake Me Up Before You Go-Go – Wham!', 'Careless Whisper – George Michael',
  'Faith – George Michael', 'Father Figure – George Michael',
  'Like a Prayer – Madonna', 'Material Girl – Madonna', 'Like a Virgin – Madonna',
  'Papa Don\'t Preach – Madonna', 'La Isla Bonita – Madonna', 'Vogue – Madonna',
  'Into the Groove – Madonna', 'Holiday – Madonna',
  'Billie Jean – Michael Jackson', 'Thriller – Michael Jackson', 'Beat It – Michael Jackson',
  'Smooth Criminal – Michael Jackson', 'Man in the Mirror – Michael Jackson',
  'Rock with You – Michael Jackson', 'Off the Wall – Michael Jackson',
  'Purple Rain – Prince', 'When Doves Cry – Prince', 'Kiss – Prince',
  '1999 – Prince', 'Sign o\' the Times – Prince', 'Little Red Corvette – Prince',
  'Born to Run – Bruce Springsteen', 'Dancing in the Dark – Bruce Springsteen',
  'The River – Bruce Springsteen', 'Thunder Road – Bruce Springsteen',
  'Every Breath You Take – The Police', 'Roxanne – The Police', 'Don\'t Stand So Close to Me – The Police',
  'Message in a Bottle – The Police', 'Every Little Thing She Does Is Magic – The Police',
  'Don\'t You (Forget About Me) – Simple Minds', 'Alive and Kicking – Simple Minds',
  'Come On Eileen – Dexys Midnight Runners', 'Karma Chameleon – Culture Club',
  'Do You Really Want to Hurt Me – Culture Club', 'Church of the Poison Mind – Culture Club',
  'Tainted Love – Soft Cell', 'Say Hello Wave Goodbye – Soft Cell',
  'True – Spandau Ballet', 'Gold – Spandau Ballet',
  'Don\'t You Want Me – Human League', 'Fascination – Human League',
  'Africa – Toto', 'Rosanna – Toto', 'I\'ll Be Over You – Toto',
  'Eye of the Tiger – Survivor', 'I Can\'t Fight This Feeling – REO Speedwagon',
  'Don\'t Stop Believin\' – Journey', 'Open Arms – Journey', 'Faithfully – Journey',
  'With or Without You – U2', 'One – U2', 'Where the Streets Have No Name – U2',
  'I Still Haven\'t Found What I\'m Looking For – U2', 'Sunday Bloody Sunday – U2',
  'Pride – U2', 'Beautiful Day – U2', 'Vertigo – U2',
  'Jump – Van Halen', 'Panama – Van Halen', 'Hot for Teacher – Van Halen',
  'Livin\' on a Prayer – Bon Jovi', 'You Give Love a Bad Name – Bon Jovi',
  'Wanted Dead or Alive – Bon Jovi', 'Bad Medicine – Bon Jovi',
  'Pour Some Sugar on Me – Def Leppard', 'Love Bites – Def Leppard', 'Animal – Def Leppard',
  'Here I Go Again – Whitesnake', 'Is This Love – Whitesnake',
  'Final Countdown – Europe', 'Rock the Night – Europe',
  'Don\'t Stop Me Now – Queen', 'We Will Rock You – Queen',
  'We Are the Champions – Queen', 'Somebody to Love – Queen',
  'Another One Bites the Dust – Queen', 'Radio Ga Ga – Queen', 'Under Pressure – Queen & David Bowie',
  'Let\'s Dance – David Bowie', 'Heroes – David Bowie', 'Space Oddity – David Bowie',
  'Ziggy Stardust – David Bowie', 'China Girl – David Bowie',
  'Running Up That Hill – Kate Bush', 'Wuthering Heights – Kate Bush', 'Babooshka – Kate Bush',
  'Hounds of Love – Kate Bush', 'This Woman\'s Work – Kate Bush',
  'Take My Breath Away – Berlin', 'Danger Zone – Kenny Loggins',
  'Always on My Mind – Willie Nelson', 'Forever Young – Alphaville',
  'Nena – 99 Luftballons', 'Rock Me Amadeus – Falco',
  // 1970s
  'Bohemian Rhapsody – Queen', 'Hotel California – Eagles', 'Life in the Fast Lane – Eagles',
  'Desperado – Eagles', 'Take It Easy – Eagles', 'Lyin\' Eyes – Eagles',
  'Hotel California – Eagles', 'One of These Nights – Eagles',
  'Sweet Child O\' Mine – Guns N\' Roses', 'November Rain – Guns N\' Roses',
  'Paradise City – Guns N\' Roses', 'Welcome to the Jungle – Guns N\' Roses',
  'Patience – Guns N\' Roses', 'Mr. Brownstone – Guns N\' Roses',
  'Stairway to Heaven – Led Zeppelin', 'Kashmir – Led Zeppelin', 'Whole Lotta Love – Led Zeppelin',
  'Black Dog – Led Zeppelin', 'Rock and Roll – Led Zeppelin', 'Immigrant Song – Led Zeppelin',
  'Black Magic Woman – Santana', 'Evil Ways – Santana', 'Oye Como Va – Santana',
  'Baker Street – Gerry Rafferty', 'Right Down the Line – Gerry Rafferty',
  'Ring My Bell – Anita Ward', 'Hot Stuff – Donna Summer', 'I Feel Love – Donna Summer',
  'Le Freak – Chic', 'Good Times – Chic', 'I\'m Coming Out – Diana Ross',
  'Superstition – Stevie Wonder', 'Sir Duke – Stevie Wonder', 'I Wish – Stevie Wonder',
  'Higher Ground – Stevie Wonder', 'Isn\'t She Lovely – Stevie Wonder',
  'Let\'s Get It On – Marvin Gaye', 'What\'s Going On – Marvin Gaye', 'Sexual Healing – Marvin Gaye',
  'Papa Was a Rollin\' Stone – The Temptations', 'My Girl – The Temptations',
  'I Heard It Through the Grapevine – Marvin Gaye',
  'Stayin\' Alive – Bee Gees', 'Night Fever – Bee Gees', 'How Deep Is Your Love – Bee Gees',
  'Tragedy – Bee Gees', 'More Than a Woman – Bee Gees',
  'Dancing Queen – ABBA', 'Waterloo – ABBA', 'Mamma Mia – ABBA',
  'Fernando – ABBA', 'Gimme! Gimme! Gimme! – ABBA', 'The Winner Takes It All – ABBA',
  'SOS – ABBA', 'Take a Chance on Me – ABBA', 'Voulez-Vous – ABBA',
  'Knowing Me, Knowing You – ABBA', 'Super Trouper – ABBA',
  'Roxanne – The Police', 'Born to Run – Bruce Springsteen',
  // Rock Classics
  'Smells Like Teen Spirit – Nirvana', 'Come as You Are – Nirvana', 'Heart-Shaped Box – Nirvana',
  'About a Girl – Nirvana', 'In Bloom – Nirvana', 'Lithium – Nirvana',
  'Seven Nation Army – The White Stripes', 'Icky Thump – The White Stripes',
  'Ball and Biscuit – The White Stripes', 'Fell in Love with a Girl – The White Stripes',
  'Wonderwall – Oasis', 'Don\'t Look Back in Anger – Oasis', 'Champagne Supernova – Oasis',
  'Live Forever – Oasis', 'Some Might Say – Oasis', 'Roll with It – Oasis',
  'Lose Yourself – Eminem', 'Slim Shady – Eminem', 'Without Me – Eminem',
  'Stan – Eminem', 'The Way I Am – Eminem', 'Rap God – Eminem',
  'In the End – Linkin Park', 'Numb – Linkin Park', 'Crawling – Linkin Park',
  'One Step Closer – Linkin Park', 'Breaking the Habit – Linkin Park', 'Faint – Linkin Park',
  'Boulevard of Broken Dreams – Green Day', 'American Idiot – Green Day',
  'Good Riddance (Time of Your Life) – Green Day', 'Wake Me Up When September Ends – Green Day',
  'Basket Case – Green Day', 'When I Come Around – Green Day',
  'Come Out and Play – The Offspring', 'Self Esteem – The Offspring', 'Pretty Fly – The Offspring',
  'All the Small Things – Blink-182', 'What\'s My Age Again? – Blink-182', 'I Miss You – Blink-182',
  'Dammit – Blink-182', 'Adam\'s Song – Blink-182',
  'With Arms Wide Open – Creed', 'Higher – Creed', 'My Sacrifice – Creed',
  'One Last Breath – Creed', 'My Own Prison – Creed',
  'Kryptonite – 3 Doors Down', 'Here Without You – 3 Doors Down', 'When I\'m Gone – 3 Doors Down',
  'Photograph – Nickelback', 'How You Remind Me – Nickelback', 'Rockstar – Nickelback',
  'Far Away – Nickelback', 'Someday – Nickelback',
  'Bring Me to Life – Evanescence', 'My Immortal – Evanescence', 'Going Under – Evanescence',
  'Lithium – Evanescence', 'Call Me When You\'re Sober – Evanescence',
  'Chop Suey! – System of a Down', 'B.Y.O.B. – System of a Down', 'Toxicity – System of a Down',
  'Numb – Disturbed', 'Down with the Sickness – Disturbed', 'The Sound of Silence – Disturbed',
  'Last Resort – Papa Roach', 'Scars – Papa Roach', 'Getting Away with Murder – Papa Roach',
  'Bodies – Drowning Pool', 'Youth of the Nation – P.O.D.',
  // Hip-Hop & R&B
  'Nuthin\' But a G Thang – Dr. Dre ft. Snoop Dogg', 'Still D.R.E. – Dr. Dre ft. Snoop Dogg',
  'Gin and Juice – Snoop Dogg', 'Drop It Like It\'s Hot – Snoop Dogg ft. Pharrell',
  'California Love – 2Pac ft. Dr. Dre', 'Changes – 2Pac', 'Dear Mama – 2Pac',
  'Hypnotize – The Notorious B.I.G.', 'Big Poppa – The Notorious B.I.G.',
  'Mo Money Mo Problems – The Notorious B.I.G.',
  'Juicy – The Notorious B.I.G.', 'One More Chance – The Notorious B.I.G.',
  'Jump – Kris Kross', 'Whoomp! (There It Is) – Tag Team',
  'Ice Ice Baby – Vanilla Ice', 'U Can\'t Touch This – MC Hammer',
  'Rapper\'s Delight – Sugarhill Gang', 'The Message – Grandmaster Flash',
  'Fight the Power – Public Enemy', 'Black Steel in the Hour of Chaos – Public Enemy',
  'Rebirth of Slick – Digable Planets', 'Doin\' It – LL Cool J',
  'I\'ll Be Missing You – Puff Daddy ft. Faith Evans', 'Bad Boy for Life – P. Diddy',
  'Gold Digger – Kanye West', 'All Falls Down – Kanye West', 'Stronger – Kanye West',
  'Heartless – Kanye West', 'Runaway – Kanye West', 'Power – Kanye West',
  'Ni**as in Paris – Jay-Z & Kanye West', 'Empire State of Mind – Jay-Z ft. Alicia Keys',
  '99 Problems – Jay-Z', 'Hard Knock Life – Jay-Z', 'Big Pimpin\' – Jay-Z',
  'Izzo (H.O.V.A.) – Jay-Z', 'Run This Town – Jay-Z ft. Rihanna & Kanye West',
  'Ms. Jackson – OutKast', 'Hey Ya! – OutKast', 'The Way You Move – OutKast',
  'Roses – OutKast', 'B.O.B. – OutKast', 'So Fresh, So Clean – OutKast',
  'In da Club – 50 Cent', 'Just a Lil Bit – 50 Cent', 'Candy Shop – 50 Cent',
  'Yeah! – Usher ft. Lil Jon & Ludacris', 'U Got It Bad – Usher', 'Burn – Usher',
  'My Boo – Usher & Alicia Keys', 'U Remind Me – Usher',
  'Fallin\' – Alicia Keys', 'If I Ain\'t Got You – Alicia Keys', 'No One – Alicia Keys',
  'Girl on Fire – Alicia Keys', 'Empire State of Mind Pt. II – Alicia Keys',
  'Beautiful – Christina Aguilera', 'Fighter – Christina Aguilera', 'Genie in a Bottle – Christina Aguilera',
  'Dirrty – Christina Aguilera', 'Come On Over Baby – Christina Aguilera',
  'Promiscuous – Nelly Furtado ft. Timbaland', 'Say It Right – Nelly Furtado', 'Maneater – Nelly Furtado',
  'SexyBack – Justin Timberlake ft. Timbaland', 'What Goes Around – Justin Timberlake',
  'Cry Me a River – Justin Timberlake', 'Rock Your Body – Justin Timberlake',
  'The Real Slim Shady – Eminem', 'Cleanin\' Out My Closet – Eminem',
  // Dance & Electronic
  'One More Time – Daft Punk', 'Around the World – Daft Punk', 'Harder Better Faster Stronger – Daft Punk',
  'Get Lucky – Daft Punk ft. Pharrell Williams', 'Instant Crush – Daft Punk ft. Julian Casablancas',
  'Blue (Da Ba Dee) – Eiffel 65', 'Freed from Desire – GALA',
  'Insomnia – Faithless', 'We Come 1 – Faithless',
  'Sandstorm – Darude', 'In the Air Tonight – Phil Collins',
  'Rhythm is a Dancer – Snap!', 'The Power – Snap!',
  'Pump Up the Jam – Technotronic', 'Show Me Love – Robin S',
  'Everybody (Backstreet\'s Back) – Backstreet Boys',
  'What Is Love – Haddaway', 'Mr. Vain – Culture Beat',
  'Boom – Vengaboys', 'We Like to Party! – Vengaboys',
  'Cotton Eye Joe – Rednex', 'Cha Cha Slide – DJ Casper',
  'Summer – Calvin Harris', 'Feel So Close – Calvin Harris',
  'Sweet Nothing – Calvin Harris ft. Florence Welch',
  'Earthquake – Labrinth ft. Tinie Tempah', 'Written in the Stars – Tinie Tempah ft. Eric Turner',
  'Rather Be – Clean Bandit ft. Jess Glynne', 'Rockabye – Clean Bandit ft. Sean Paul & Anne-Marie',
  'Solo – Clean Bandit ft. Demi Lovato', 'Symphony – Clean Bandit ft. Zara Larsson',
  'Cheap Thrills – Sia', 'Elastic Heart – Sia', 'The Greatest – Sia',
  'Faded – Alan Walker', 'Alone – Alan Walker', 'On My Way – Alan Walker',
  'Roses – SAINt JHN', 'Blueberry Faygo – Lil Mosey',
  'SAD! – XXXTentacion', 'Lucid Dreams – Juice WRLD', 'All Girls Are the Same – Juice WRLD',
  'Legends Never Die – Juice WRLD', 'Robbery – Juice WRLD',
  'Rockstar – DaBaby ft. Roddy Ricch', 'Suge – DaBaby', 'BOP – DaBaby',
  'The Box – Roddy Ricch', 'High Fashion – Roddy Ricch ft. Mustard',
  'WAP – Cardi B ft. Megan Thee Stallion', 'Bodak Yellow – Cardi B', 'I Like It – Cardi B',
  'Savage – Megan Thee Stallion ft. Beyoncé', 'Hot Girl Summer – Megan Thee Stallion',
  // Country & Folk
  'Jolene – Dolly Parton', '9 to 5 – Dolly Parton', 'I Will Always Love You – Dolly Parton',
  'Friends in Low Places – Garth Brooks', 'The Dance – Garth Brooks',
  'Man! I Feel Like a Woman! – Shania Twain', 'You\'re Still the One – Shania Twain',
  'That Don\'t Impress Me Much – Shania Twain',
  'Achy Breaky Heart – Billy Ray Cyrus', 'Before He Cheats – Carrie Underwood',
  'Jesus Take the Wheel – Carrie Underwood', 'Blown Away – Carrie Underwood',
  'Need You Now – Lady Antebellum', 'American Honey – Lady Antebellum',
  'Body Like a Back Road – Sam Hunt', 'Take Your Time – Sam Hunt',
  'Tennessee Whiskey – Chris Stapleton', 'Broken Halos – Chris Stapleton',
  'Die a Happy Man – Thomas Rhett', 'Marry Me – Thomas Rhett',
  'Old Dominion – Written in the Sand', 'Meant to Be – Bebe Rexha ft. Florida Georgia Line',
  'Cruise – Florida Georgia Line', 'H.O.L.Y. – Florida Georgia Line',
  'Wagon Wheel – Darius Rucker', 'Alright – Darius Rucker',
  'Humble and Kind – Tim McGraw', 'It\'s Your Love – Tim McGraw & Faith Hill',
  'The Thunder Rolls – Garth Brooks', 'Callin\' Baton Rouge – Garth Brooks',
  'Big Green Tractor – Jason Aldean', 'Dirt Road Anthem – Jason Aldean',
  // Soul & Funk
  'Respect – Aretha Franklin', 'Chain of Fools – Aretha Franklin',
  'Think – Aretha Franklin', 'I Say a Little Prayer – Aretha Franklin',
  'Natural Woman – Aretha Franklin', 'Do Right Woman – Aretha Franklin',
  'Sex Machine – James Brown', 'I Got You (I Feel Good) – James Brown',
  'Papa\'s Got a Brand New Bag – James Brown', 'Get Up (I Feel Like Being a) Sex Machine – James Brown',
  'Superbad – James Brown',
  'Let\'s Stay Together – Al Green', 'Tired of Being Alone – Al Green',
  'Call Me (Come Back Home) – Al Green',
  'Lean on Me – Bill Withers', 'Lovely Day – Bill Withers', 'Ain\'t No Sunshine – Bill Withers',
  'Use Me – Bill Withers', 'Just the Two of Us – Grover Washington Jr. ft. Bill Withers',
  'Sir Duke – Stevie Wonder', 'Signed, Sealed, Delivered – Stevie Wonder',
  'Uptight (Everything\'s Alright) – Stevie Wonder',
  'Purple Rain – Prince', 'Kiss – Prince', 'When Doves Cry – Prince',
  'Sign o\' the Times – Prince', '1999 – Prince',
  'Dancing in the Street – Martha and the Vandellas',
  'Stop! In the Name of Love – The Supremes',
  'Baby Love – The Supremes', 'You Can\'t Hurry Love – The Supremes',
  'I\'ll Be There – Jackson 5', 'ABC – Jackson 5', 'I Want You Back – Jackson 5',
  'Boogie Wonderland – Earth, Wind & Fire', 'September – Earth, Wind & Fire',
  'Let\'s Groove – Earth, Wind & Fire', 'Fantasy – Earth, Wind & Fire',
  'Play That Funky Music – Wild Cherry',
  'Give Up the Funk – Parliament', 'Flash Light – Parliament',
  'Superstition – Stevie Wonder', 'Higher Ground – Stevie Wonder',
  // Latin & World
  'Despacito – Luis Fonsi ft. Daddy Yankee', 'La Tortura – Shakira ft. Alejandro Sanz',
  'Hips Don\'t Lie – Shakira ft. Wyclef Jean', 'Whenever, Wherever – Shakira',
  'Waka Waka – Shakira', 'She Wolf – Shakira',
  'Bailando – Enrique Iglesias ft. Descemer Bueno & Gente de Zona',
  'El Perdón – Nicky Jam & Enrique Iglesias', 'Con Calma – Daddy Yankee & Snow',
  'Gasolina – Daddy Yankee', 'Dura – Daddy Yankee',
  'I Like It – Cardi B ft. Bad Bunny & J Balvin', 'Mi Gente – J Balvin & Willy William',
  'Lean On – Major Lazer ft. MØ & DJ Snake', 'Boom – Daddy Yankee',
  'Bad Guy – Billie Eilish', 'Lo Que Siento – Cuco',
  'Tití Me Preguntó – Bad Bunny', 'Me Porto Bonito – Bad Bunny', 'Ojitos Lindos – Bad Bunny',
  'Moscow – Genghis Khan', 'Macarena – Los Del Rio',
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
