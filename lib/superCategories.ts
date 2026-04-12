export type SuperCategoryKey = 'tech' | 'logic' | 'music_film' | 'knowledge' | 'action';

export const SUPER_CATEGORIES: Record<SuperCategoryKey, {
  label: string;
  icon: string;
  color: string;
  desc: string;
}> = {
  tech:       { label: 'Tech & IT',            icon: '💻', color: 'var(--accent)',  desc: 'Coding, ciphers, logos and tech icons' },
  logic:      { label: 'Logic & Mind',          icon: '🧠', color: '#b084cc',        desc: 'Puzzles, patterns and brain teasers' },
  music_film: { label: 'Music & Film',          icon: '🎵', color: 'var(--gold)',    desc: 'Songs, lyrics and movie knowledge' },
  knowledge:  { label: 'Knowledge & Trivia',    icon: '🌍', color: 'var(--accent3)', desc: 'Geography, history and general trivia' },
  action:     { label: 'Action & Creative',     icon: '⚡', color: 'var(--accent2)', desc: 'Physical, speed and creative challenges' },
};

/** Maps every mission id to its super-category. */
export const MISSION_SUPER_CATEGORY: Record<string, SuperCategoryKey> = {
  // Tech & IT
  code_quiz:       'tech',
  binary:          'tech',
  bug_hunt:        'tech',
  terminal:        'tech',
  emoji_rebus:     'tech',
  enigma_cipher:   'tech',
  logo_quiz:       'tech',
  app_icons:       'tech',
  anagram:         'tech',

  // Logic & Mind
  memory:          'logic',
  sequence:        'logic',
  puzzle:          'logic',
  snabb_matte:     'logic',
  crack_code:      'logic',
  spot_error:      'logic',
  visual_iq:       'logic',
  memory_speed:    'logic',
  solve_crime:     'logic',

  // Music & Film
  music_quiz:      'music_film',
  music_emoji:     'music_film',
  finish_lyrics:   'music_film',
  film_quiz:       'music_film',
  celebrity_quiz:  'music_film',

  // Knowledge & Trivia
  trivia_fun:           'knowledge',
  true_false:           'knowledge',
  geo_guess:            'knowledge',
  flag_quiz:            'knowledge',
  pa_sparet:            'knowledge',
  pa_sparet_destination:'knowledge',
  vem_sa_det:           'knowledge',
  sport_quiz:           'knowledge',
  slogans:              'knowledge',
  gissa_aret:           'knowledge',
  svara_ord:            'knowledge',
  mix_drinks:           'knowledge',
  food_ingredients:     'knowledge',

  // Action & Creative
  reaction:          'action',
  typerace:          'action',
  wordguess:         'action',
  wouldyou:          'action',
  photo_bubble:      'action',
  photo_movie_scene: 'action',
  pictionary:        'action',
  human_statue:      'action',
};
