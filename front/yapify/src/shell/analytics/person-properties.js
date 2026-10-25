/**
 * Helpers para derivar las person properties que `identify()` envía a PostHog.
 *
 * Spec: docs/superpowers/specs/2026-05-14-analytics-tagging-design.md sec 1.3.
 * Plan: docs/superpowers/plans/2026-05-16-analytics-cold-start-identify.md
 *
 * Reglas:
 *   - `age_range` se deriva de `birth_date`; si falta o es inválido → null.
 *   - `preferred_categories` se normaliza a array de strings lowercase
 *     (acepta {category: {name}} o strings sueltos).
 *   - Cualquier campo `undefined` o `null` se OMITE del objeto final.
 */

const AGE_BUCKETS = [
  { max: 17, label: '< 18' },
  { max: 24, label: '18-24' },
  { max: 34, label: '25-34' },
  { max: 44, label: '35-44' },
  { max: 54, label: '45-54' },
  { max: 64, label: '55-64' },
  { max: Infinity, label: '65+' },
];

/**
 * Devuelve el bucket demográfico del usuario a partir de su fecha de
 * nacimiento. Devuelve null si la fecha es inválida o falta.
 */
export function ageRange(birthDate) {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  if (age < 0 || age > 150) return null;
  for (const b of AGE_BUCKETS) {
    if (age <= b.max) return b.label;
  }
  return null;
}

/**
 * Normaliza preferred_categories a array de strings lowercase.
 * Acepta:
 *   - [{category: {name: 'Cafeterias'}}, ...]   (shape Prisma con include)
 *   - ['Cafeterias', 'Libros']                  (shape ya flat)
 * Devuelve [] si no hay datos.
 */
function normalizePreferredCategories(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry?.category?.name) return entry.category.name;
      if (entry?.name) return entry.name;
      return null;
    })
    .filter((s) => typeof s === 'string' && s.length > 0)
    .map((s) => s.toLowerCase());
}

/**
 * Arma el objeto de person properties para `identify(uid, props)`.
 * Omite cualquier campo undefined/null para no ensuciar la UI de PostHog.
 *
 * @param {object|null} dbUser
 * @returns {object}
 */
export function buildPersonProps(dbUser) {
  if (!dbUser) return {};

  const out = {};
  const setIfPresent = (key, value) => {
    if (value !== undefined && value !== null) out[key] = value;
  };

  setIfPresent('email', dbUser.email);
  setIfPresent('name', dbUser.name);
  setIfPresent('gender', dbUser.gender);

  const age = ageRange(dbUser.birth_date);
  if (age !== null) out.age_range = age;

  setIfPresent('city', dbUser.city);
  setIfPresent('district', dbUser.district);
  setIfPresent('country', dbUser.country);
  setIfPresent('role', dbUser.role);
  setIfPresent('signup_at', dbUser.created_at);
  setIfPresent('provider_id', dbUser.provider_id);
  setIfPresent('is_active', dbUser.is_active);

  const cats = normalizePreferredCategories(
    dbUser.preferences ?? dbUser.preferred_categories ?? dbUser.user_preferences,
  );
  if (cats.length > 0) out.preferred_categories = cats;

  return out;
}
