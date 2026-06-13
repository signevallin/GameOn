export type SuperCategoryKey = 'tech' | 'logic' | 'music_film' | 'knowledge' | 'action' | 'gkn' | 'remote';

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
  gkn:        { label: 'GKN Aerospace',          icon: '✈️', color: '#4a90d9',        desc: 'Missions about GKN Aerospace and aviation' },
  remote:     { label: 'Remote Teamwork',        icon: '🌐', color: '#6366f1',        desc: 'Challenges designed for remote teams on a video call' },
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
  memory:          'tech',
  sequence:        'logic',
  puzzle:          'logic',
  snabb_matte:     'logic',
  crack_code:      'logic',
  spot_error:      'logic',
  visual_iq:       'logic',
  memory_speed:    'logic',
  color_memory:    'logic',
  solve_crime:     'logic',

  // Music & Film
  music_quiz:      'music_film',
  music_emoji:     'music_film',
  finish_lyrics:   'music_film',
  film_quiz:       'music_film',
  celebrity_quiz:  'music_film',
  movie_emoji:     'music_film',

  // Knowledge & Trivia
  lidkoping_quiz:       'knowledge',
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
  simon_says:        'action',

  // Logic & Mind (visual)
  pixel_reveal:      'logic',
  zoom_in:           'logic',

  // Knowledge & Trivia
  timeline:          'knowledge',
  closest_wins:      'knowledge',
  duel_trivia:       'knowledge',

  // Action & Creative
  scavenger_hunt:       'action',
  photo_ad_shot:        'action',
  photo_mirror_selfie:  'action',
  photo_shadow_selfie:  'action',
  photo_colour_match:   'action',
  photo_weird_sign:     'action',

  // GKN Aerospace
  gkn_trivia:        'gkn',
  gkn_truefalse:     'gkn',
  gkn_closest:       'gkn',
  gkn_pa_sparet:     'gkn',
  gkn_timeline:      'gkn',
  gkn_aircraft_quiz: 'gkn',

  // Remote Teamwork
  relay_typerace:   'remote',
  relay_trivia:     'remote',
  secret_word:      'remote',
  secret_code:      'remote',
  relay_geo:        'remote',
  relay_movies:     'remote',
  relay_science:    'remote',
  relay_story:      'remote',
  secret_einstein:  'remote',
  secret_animal:    'remote',
  secret_titanic:   'remote',
  secret_venice:    'remote',
};
