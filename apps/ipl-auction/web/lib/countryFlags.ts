/**
 * Official Country Flag Logos for Cricket Nations
 * Sourced from Cricinfo high-resolution transparent PNGs
 */

export const COUNTRY_FLAG_URLS: Record<string, string> = {
  "Australia": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/340400/340493.png",
  "Afghanistan": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/381800/381892.png",
  "Bangladesh": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/341400/341456.png",
  "England": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/419200/419236.png",
  "India": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/381800/381895.png",
  "Ireland": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313149.logo.png",
  "New Zealand": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/340500/340505.png",
  "Pakistan": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/419200/419214.png",
  "South Africa": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/382700/382733.png",
  "Sri Lanka": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/340000/340047.png",
  "West Indies": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/317600/317615.png",
  "Zimbabwe": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/340500/340503.png",
  "Namibia": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/381800/381857.png",
  "Nepal": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/319900/319958.png",
  "Netherlands": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/381800/381893.png",
  "Oman": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/381800/381858.png",
  "Papua New Guinea": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/383200/383206.png",
  "Scotland": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/313100/313150.logo.png",
  "United Arab Emirates": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/382100/382186.png",
  "United States of America": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_160,q_50/lsci/db/PICTURES/CMS/381800/381853.png",
};

// Aliases lookup map for abbreviations and variants
const COUNTRY_ALIASES: Record<string, string> = {
  ind: "India",
  india: "India",
  aus: "Australia",
  australia: "Australia",
  afg: "Afghanistan",
  afghanistan: "Afghanistan",
  ban: "Bangladesh",
  bangladesh: "Bangladesh",
  eng: "England",
  england: "England",
  uk: "England",
  ire: "Ireland",
  ireland: "Ireland",
  nz: "New Zealand",
  "new zealand": "New Zealand",
  pak: "Pakistan",
  pakistan: "Pakistan",
  sa: "South Africa",
  rsa: "South Africa",
  "south africa": "South Africa",
  sl: "Sri Lanka",
  "sri lanka": "Sri Lanka",
  wi: "West Indies",
  windies: "West Indies",
  "west indies": "West Indies",
  zim: "Zimbabwe",
  zimbabwe: "Zimbabwe",
  nam: "Namibia",
  namibia: "Namibia",
  nep: "Nepal",
  nepal: "Nepal",
  ned: "Netherlands",
  netherlands: "Netherlands",
  holland: "Netherlands",
  oma: "Oman",
  oman: "Oman",
  png: "Papua New Guinea",
  "papua new guinea": "Papua New Guinea",
  sco: "Scotland",
  scotland: "Scotland",
  uae: "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  usa: "United States of America",
  us: "United States of America",
  "united states": "United States of America",
  "united states of america": "United States of America",
};

/**
 * Returns the flag logo URL for any cricket country name or code.
 */
export function getCountryFlagUrl(country: string | null | undefined): string | null {
  if (!country) return null;
  const clean = country.trim().toLowerCase();

  // 1. Direct alias or canonical match
  const canonical = COUNTRY_ALIASES[clean];
  if (canonical && COUNTRY_FLAG_URLS[canonical]) {
    return COUNTRY_FLAG_URLS[canonical];
  }

  // 2. Fuzzy match against canonical keys
  for (const [key, url] of Object.entries(COUNTRY_FLAG_URLS)) {
    if (key.toLowerCase() === clean || clean.includes(key.toLowerCase()) || key.toLowerCase().includes(clean)) {
      return url;
    }
  }

  return null;
}
