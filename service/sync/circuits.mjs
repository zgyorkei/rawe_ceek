// Our own table of circuits (RW.RESEARCH 1.2, rule 2): the IANA zone and the country code of every circuit the six
// series race on in 2026 and 2027, so no source's printed offset is ever trusted. A source names a circuit in its own
// words (Jolpica's circuitId, a round page's slug, a city, a circuit's name): findCircuit matches any of them.

/** @typedef {{ key: string, city: string, country: string, countryCode: string, timeZone: string, aliases: string[] }} Circuit */

/** @type {Circuit[]} */
export const CIRCUITS = [
  { key: 'albert_park', city: 'Melbourne', country: 'Australia', countryCode: 'AU', timeZone: 'Australia/Melbourne', aliases: ['albert park', 'melbourne'] },
  { key: 'shanghai', city: 'Shanghai', country: 'China', countryCode: 'CN', timeZone: 'Asia/Shanghai', aliases: ['shanghai'] },
  { key: 'suzuka', city: 'Suzuka', country: 'Japan', countryCode: 'JP', timeZone: 'Asia/Tokyo', aliases: ['suzuka'] },
  { key: 'bahrain', city: 'Sakhir', country: 'Bahrain', countryCode: 'BH', timeZone: 'Asia/Bahrain', aliases: ['bahrain international', 'sakhir', 'bahrain'] },
  { key: 'jeddah', city: 'Jeddah', country: 'Saudi Arabia', countryCode: 'SA', timeZone: 'Asia/Riyadh', aliases: ['jeddah', 'saudi arabia'] },
  { key: 'miami', city: 'Miami Gardens', country: 'United States', countryCode: 'US', timeZone: 'America/New_York', aliases: ['miami gardens', 'miami'] },
  { key: 'villeneuve', city: 'Montreal', country: 'Canada', countryCode: 'CA', timeZone: 'America/Toronto', aliases: ['gilles villeneuve', 'montreal', 'canada'] },
  { key: 'monaco', city: 'Monte Carlo', country: 'Monaco', countryCode: 'MC', timeZone: 'Europe/Monaco', aliases: ['monte carlo', 'monaco'] },
  { key: 'catalunya', city: 'Barcelona', country: 'Spain', countryCode: 'ES', timeZone: 'Europe/Madrid', aliases: ['catalunya', 'barcelona', 'montmelo'] },
  { key: 'red_bull_ring', city: 'Spielberg', country: 'Austria', countryCode: 'AT', timeZone: 'Europe/Vienna', aliases: ['red bull ring', 'spielberg', 'austria'] },
  { key: 'silverstone', city: 'Silverstone', country: 'United Kingdom', countryCode: 'GB', timeZone: 'Europe/London', aliases: ['silverstone'] },
  { key: 'spa', city: 'Stavelot', country: 'Belgium', countryCode: 'BE', timeZone: 'Europe/Brussels', aliases: ['spa francorchamps', 'francorchamps', 'spa', 'belgium'] },
  { key: 'hungaroring', city: 'Budapest', country: 'Hungary', countryCode: 'HU', timeZone: 'Europe/Budapest', aliases: ['hungaroring', 'budapest', 'hungary'] },
  { key: 'zandvoort', city: 'Zandvoort', country: 'Netherlands', countryCode: 'NL', timeZone: 'Europe/Amsterdam', aliases: ['zandvoort', 'netherlands'] },
  { key: 'monza', city: 'Monza', country: 'Italy', countryCode: 'IT', timeZone: 'Europe/Rome', aliases: ['monza'] },
  { key: 'imola', city: 'Imola', country: 'Italy', countryCode: 'IT', timeZone: 'Europe/Rome', aliases: ['imola', 'enzo e dino ferrari'] },
  { key: 'madring', city: 'Madrid', country: 'Spain', countryCode: 'ES', timeZone: 'Europe/Madrid', aliases: ['madring', 'madrid'] },
  { key: 'baku', city: 'Baku', country: 'Azerbaijan', countryCode: 'AZ', timeZone: 'Asia/Baku', aliases: ['baku', 'azerbaijan'] },
  { key: 'sepang', city: 'Sepang', country: 'Malaysia', countryCode: 'MY', timeZone: 'Asia/Kuala_Lumpur', aliases: ['sepang', 'kuala lumpur', 'malaysia'] },
  { key: 'marina_bay', city: 'Singapore', country: 'Singapore', countryCode: 'SG', timeZone: 'Asia/Singapore', aliases: ['marina bay', 'singapore'] },
  { key: 'americas', city: 'Austin', country: 'United States', countryCode: 'US', timeZone: 'America/Chicago', aliases: ['circuit of the americas', 'americas', 'cota', 'austin'] },
  { key: 'rodriguez', city: 'Mexico City', country: 'Mexico', countryCode: 'MX', timeZone: 'America/Mexico_City', aliases: ['hermanos rodriguez', 'rodriguez', 'mexico city', 'mexico'] },
  { key: 'interlagos', city: 'Sao Paulo', country: 'Brazil', countryCode: 'BR', timeZone: 'America/Sao_Paulo', aliases: ['interlagos', 'carlos pace', 'sao paulo', 'brazil'] },
  { key: 'vegas', city: 'Las Vegas', country: 'United States', countryCode: 'US', timeZone: 'America/Los_Angeles', aliases: ['las vegas', 'vegas'] },
  { key: 'losail', city: 'Lusail', country: 'Qatar', countryCode: 'QA', timeZone: 'Asia/Qatar', aliases: ['losail', 'lusail', 'qatar'] },
  { key: 'yas_marina', city: 'Abu Dhabi', country: 'United Arab Emirates', countryCode: 'AE', timeZone: 'Asia/Dubai', aliases: ['yas marina', 'yas island', 'abu dhabi'] },
  { key: 'portimao', city: 'Portimao', country: 'Portugal', countryCode: 'PT', timeZone: 'Europe/Lisbon', aliases: ['portimao', 'algarve', 'portugal'] },
  { key: 'istanbul', city: 'Istanbul', country: 'Turkey', countryCode: 'TR', timeZone: 'Europe/Istanbul', aliases: ['istanbul', 'turkey', 'turkiye'] },
  { key: 'fuji', city: 'Oyama', country: 'Japan', countryCode: 'JP', timeZone: 'Asia/Tokyo', aliases: ['fuji'] },
  { key: 'le_mans', city: 'Le Mans', country: 'France', countryCode: 'FR', timeZone: 'Europe/Paris', aliases: ['le mans', 'la sarthe', 'sarthe'] },
];

/** Lower case, no accents, words of letters and digits only. @param {string} text */
export const normalise = (text) =>
  ` ${text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/**
 * The circuit any of the texts names (a circuitId, a slug, a city, a circuit's name, a race's name), or null. The
 * texts are tried in order, each against every alias as a whole word or phrase, longer aliases first ("spa
 * francorchamps" before "spa", so "Spain" is never Spa).
 * @param {...(string | null | undefined)} texts
 */
export function findCircuit(...texts) {
  const aliases = CIRCUITS.flatMap((c) => [c.key.replace(/_/g, ' '), ...c.aliases].map((a) => ({ c, a: normalise(a) })))
    .sort((x, y) => y.a.length - x.a.length);
  for (const t of texts) {
    if (!t) continue;
    const n = normalise(t);
    const hit = aliases.find(({ a }) => n.includes(a));
    if (hit) return hit.c;
  }
  return null;
}
