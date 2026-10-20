// Real / realistic age lookup and estimation for IPL players
const KNOWN_PLAYER_AGES: Record<string, number> = {
  // Top Retained & Marquee Players
  "dewald brevis": 22,
  "virat kohli": 37,
  "rohit sharma": 38,
  "ms dhoni": 44,
  "rishabh pant": 28,
  "shubman gill": 26,
  "jasprit bumrah": 32,
  "kl rahul": 33,
  "hardik pandya": 32,
  "suryakumar yadav": 35,
  "shreyas iyer": 31,
  "heinrich klaasen": 34,
  "glenn maxwell": 37,
  "travis head": 32,
  "kane williamson": 35,
  "mitchell starc": 36,
  "pat cummins": 32,
  "rashid khan": 27,
  "varun chakravarthy": 34,
  "sherfane rutherford": 27,
  "jake fraser-mcgurk": 23,
  "cameron green": 26,
  "sarfaraz khan": 28,
  "devon conway": 34,
  "ruturaj gaikwad": 29,
  "tilak varma": 23,
  "rinku singh": 28,
  "yashasvi jaiswal": 24,
  "shivam dube": 32,
  "axar patel": 32,
  "ravindra jadeja": 37,
  "mohammed shami": 35,
  "mohammed siraj": 31,
  "arshdeep singh": 27,
  "kuldeep yadav": 31,
  "yuzvendra chahal": 35,
  "nicholas pooran": 30,
  "sanju samson": 31,
  "jos buttler": 35,
  "trent boult": 36,
  "kagiso rabada": 30,
  "anrich nortje": 32,
  "quinton de kock": 33,
  "david miller": 36,
  "faf du plessis": 41,
  "marcus stoinis": 36,
  "liam livingstone": 32,
  "sam curran": 27,
  "phil salt": 29,
  "will jacks": 27,
  "matheesha pathirana": 23,
  "maheesh theekshana": 25,
  "wanindu hasaranga": 28,
  "gerald coetzee": 25,
  "spencer johnson": 30,
  "nuwan thushara": 31,
  "harshit rana": 24,
  "mayank yadav": 23,
  "abhishek sharma": 25,
  "nitish kumar reddy": 22,
  "sai sudharsan": 24,
  "dhruv jurel": 25,
  "prabhsimran singh": 25,
  "jitesh sharma": 32,
  "shahrukh khan": 30,
  "rahul tewatia": 32,
  "vijay shankar": 35,
  "washington sundar": 26,
  "deepak chahar": 33,
  "shardul thakur": 34,
  "bhuvneshwar kumar": 36,
  "t natarajan": 35,
  "mohit sharma": 37,
  "sandeep sharma": 32,
  "avesh khan": 29,
  "prasidh krishna": 30,
  "mukesh kumar": 32,
  "khaleel ahmed": 28,
  "ishant sharma": 37,
  "umesh yadav": 38,
  "piyush chawla": 37,
  "amit mishra": 43,
  "karn sharma": 38,
  "mayank agarwal": 35,
  "ajinkya rahane": 37,
  "manish pandey": 36,
  "karun nair": 34,
  "wriddhiman saha": 41,
  "dinesh karthik": 40,
  "robin uthappa": 40,
  "suresh raina": 39,
  "ambati rayudu": 40,
  "tim david": 29,
  "romario shepherd": 31,
  "lockie ferguson": 34,
  "alzarri joseph": 29,
  "jason holder": 34,
  "shimron hetmyer": 29,
  "rovman powell": 32,
  "andre russell": 37,
  "sunil narine": 37,
  "devdutt padikkal": 25,
  "glenn phillips": 29,
  "matthew breetzke": 27,
};

export function getPlayerAge(name?: string, matches = 0, isCapped = true): number {
  if (!name) return 26;
  const normalized = name.trim().toLowerCase();
  if (KNOWN_PLAYER_AGES[normalized]) {
    return KNOWN_PLAYER_AGES[normalized];
  }

  // Deterministic realistic estimation based on experience
  if (matches > 120) {
    return 32 + (matches % 6); // 32 - 37
  }
  if (matches > 60) {
    return 27 + (matches % 5); // 27 - 31
  }
  if (matches > 20) {
    return 24 + (matches % 4); // 24 - 27
  }
  if (isCapped) {
    return 23 + (name.length % 5); // 23 - 27
  }
  return 20 + (name.length % 4); // 20 - 23 (Emerging/Uncapped)
}
