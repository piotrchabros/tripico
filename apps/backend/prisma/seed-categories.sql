-- Seed canonical category set used by the AI categorizer.
-- Idempotent: ON CONFLICT (slug) DO NOTHING.
-- Run via:
--   psql "$DATABASE_URL" -f apps/backend/prisma/seed-categories.sql

INSERT INTO "Category" (id, slug, "labelPl", description, "iconEmoji", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), 'mountains',         'Góry',                   'Wycieczki górskie, hiking, treking',                '⛰️', NOW(), NOW()),
  (gen_random_uuid(), 'sea',               'Morze',                  'Wybrzeże, plażowanie, kąpieliska',                  '🌊', NOW(), NOW()),
  (gen_random_uuid(), 'city-break',        'City break',             'Krótkie wypady do miast',                            '🏙️', NOW(), NOW()),
  (gen_random_uuid(), 'roadtrip',          'Roadtrip',               'Wielodniowe trasy samochodem',                       '🚗', NOW(), NOW()),
  (gen_random_uuid(), 'festival',          'Festiwal',               'Wyjazdy na festiwale, koncerty',                     '🎪', NOW(), NOW()),
  (gen_random_uuid(), 'winter-sports',     'Sporty zimowe',          'Narty, snowboard, skitury',                          '⛷️', NOW(), NOW()),
  (gen_random_uuid(), 'water-sports',      'Sporty wodne',           'Surfing, sup, żeglarstwo, kajaki',                   '🏄', NOW(), NOW()),
  (gen_random_uuid(), 'culture',           'Kultura i historia',     'Zabytki, muzea, sztuka',                             '🏛️', NOW(), NOW()),
  (gen_random_uuid(), 'nature',            'Natura i parki',         'Parki narodowe, dzika natura, fotografia przyrody', '🌿', NOW(), NOW()),
  (gen_random_uuid(), 'foodie',            'Foodie',                 'Wyprawy kulinarne, winnice, lokalna kuchnia',        '🍷', NOW(), NOW()),
  (gen_random_uuid(), 'wellness',          'Wellness',               'SPA, joga, retreat, mindfulness',                    '🧘', NOW(), NOW()),
  (gen_random_uuid(), 'adventure',         'Adventure',              'Wspinaczka, paralotnia, ekstremalne',               '🧗', NOW(), NOW()),
  (gen_random_uuid(), 'budget',            'Budget',                 'Tanie wyprawy, backpacking',                         '🎒', NOW(), NOW()),
  (gen_random_uuid(), 'luxury',            'Luxury',                 'Luksusowe wyjazdy, premium accommodation',           '🥂', NOW(), NOW()),
  (gen_random_uuid(), 'family',            'Rodzinne',               'Dla rodzin z dziećmi',                               '👪', NOW(), NOW()),
  (gen_random_uuid(), 'solo-friendly',     'Solo-friendly',          'Otwarte dla samotnych podróżników',                 '🧳', NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
