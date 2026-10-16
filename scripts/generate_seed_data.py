import csv
import json
import re
import os

TEAM_CODE_MAP = {
    'Chennai Super Kings': 'CSK',
    'Delhi Capitals': 'DC',
    'Gujarat Titans': 'GT',
    'Kolkata Knight Riders': 'KKR',
    'Lucknow Super Giants': 'LSG',
    'Mumbai Indians': 'MI',
    'Punjab Kings': 'PBKS',
    'Rajasthan Royals': 'RR',
    'Royal Challengers Bengaluru': 'RCB',
    'Sunrisers Hyderabad': 'SRH'
}

FRANCHISE_DETAILS = [
    {
        'id': 'f_csk',
        'code': 'CSK',
        'name': 'Chennai Super Kings',
        'shortName': 'Super Kings',
        'primaryColor': '#f9cd05',
        'secondaryColor': '#0081e8',
        'defaultPurse': 1300000000,
        'minSquad': 18,
        'maxSquad': 25,
        'maxOverseas': 8,
    },
    {
        'id': 'f_mi',
        'code': 'MI',
        'name': 'Mumbai Indians',
        'shortName': 'Indians',
        'primaryColor': '#004ba0',
        'secondaryColor': '#d1ab3e',
        'defaultPurse': 1300000000,
        'minSquad': 18,
        'maxSquad': 25,
        'maxOverseas': 8,
    },
    {
        'id': 'f_rcb',
        'code': 'RCB',
        'name': 'Royal Challengers Bengaluru',
        'shortName': 'Challengers',
        'primaryColor': '#d71920',
        'secondaryColor': '#000000',
        'defaultPurse': 1300000000,
        'minSquad': 18,
        'maxSquad': 25,
        'maxOverseas': 8,
    },
    {
        'id': 'f_kkr',
        'code': 'KKR',
        'name': 'Kolkata Knight Riders',
        'shortName': 'Knight Riders',
        'primaryColor': '#3a225d',
        'secondaryColor': '#b3995d',
        'defaultPurse': 1300000000,
        'minSquad': 18,
        'maxSquad': 25,
        'maxOverseas': 8,
    },
    {
        'id': 'f_srh',
        'code': 'SRH',
        'name': 'Sunrisers Hyderabad',
        'shortName': 'Sunrisers',
        'primaryColor': '#f26522',
        'secondaryColor': '#000000',
        'defaultPurse': 1300000000,
        'minSquad': 18,
        'maxSquad': 25,
        'maxOverseas': 8,
    },
    {
        'id': 'f_dc',
        'code': 'DC',
        'name': 'Delhi Capitals',
        'shortName': 'Capitals',
        'primaryColor': '#0078bc',
        'secondaryColor': '#d71920',
        'defaultPurse': 1300000000,
        'minSquad': 18,
        'maxSquad': 25,
        'maxOverseas': 8,
    },
    {
        'id': 'f_rr',
        'code': 'RR',
        'name': 'Rajasthan Royals',
        'shortName': 'Royals',
        'primaryColor': '#ea1a85',
        'secondaryColor': '#254aa5',
        'defaultPurse': 1300000000,
        'minSquad': 18,
        'maxSquad': 25,
        'maxOverseas': 8,
    },
    {
        'id': 'f_gt',
        'code': 'GT',
        'name': 'Gujarat Titans',
        'shortName': 'Titans',
        'primaryColor': '#1c1c2b',
        'secondaryColor': '#0b4973',
        'defaultPurse': 1300000000,
        'minSquad': 18,
        'maxSquad': 25,
        'maxOverseas': 8,
    },
    {
        'id': 'f_lsg',
        'code': 'LSG',
        'name': 'Lucknow Super Giants',
        'shortName': 'Super Giants',
        'primaryColor': '#0057e7',
        'secondaryColor': '#fa541c',
        'defaultPurse': 1300000000,
        'minSquad': 18,
        'maxSquad': 25,
        'maxOverseas': 8,
    },
    {
        'id': 'f_pbks',
        'code': 'PBKS',
        'name': 'Punjab Kings',
        'shortName': 'Kings',
        'primaryColor': '#dd1f2d',
        'secondaryColor': '#dcdfe4',
        'defaultPurse': 1300000000,
        'minSquad': 18,
        'maxSquad': 25,
        'maxOverseas': 8,
    },
]

KNOWN_PREVIOUS_FRANCHISE = {
    'Devon Conway': 'CSK',
    'Jake Fraser-McGurk': 'DC',
    'Cameron Green': 'RCB',
    'Sarfaraz Khan': 'DC',
    'David Miller': 'GT',
    'Prithvi Shaw': 'DC',
    'Gus Atkinson': 'KKR',
    'Wanindu Hasaranga': 'SRH',
    'Deepak Hooda': 'LSG',
    'Venkatesh Iyer': 'KKR',
    'Liam Livingstone': 'PBKS',
    'Rachin Ravindra': 'CSK',
    'Jonny Bairstow': 'PBKS',
    'Quinton de Kock': 'LSG',
    'Rahmanullah Gurbaz': 'KKR',
    'Gerald Coetzee': 'MI',
    'Akash Deep': 'RCB',
    'Fazalhaq Farooqi': 'SRH',
    'Matt Henry': 'LSG',
    'Spencer Johnson': 'GT',
    'Shivam Mavi': 'LSG',
    'Anrich Nortje': 'DC',
    'Matheesha Pathirana': 'CSK',
    'Ravi Bishnoi': 'LSG',
    'Rahul Chahar': 'PBKS',
    'Maheesh Theekshana': 'CSK',
    'Abhinav Manohar': 'GT',
    'Anmolpreet Singh': 'SRH',
    'Atharva Taide': 'PBKS',
    'Rajvardhan Hangargekar': 'CSK',
    'Tanush Kotian': 'RR',
    'Mahipal Lomror': 'RCB',
    'Kamlesh Nagarkoti': 'DC',
    'Vijay Shankar': 'GT',
    'Sanvir Singh': 'SRH',
    'Prashant Veer': 'CSK',
    'Kartik Sharma': 'CSK',
    'Akash Madhwal': 'MI',
    'Sushant Mishra': 'GT',
    'Simarjeet Singh': 'CSK',
    'Kartik Tyagi': 'GT',
    'Karn Sharma': 'RCB',
    'Kumar Kartikeya Singh': 'MI',
    'Prashant Solanki': 'CSK',
    'Mayank Agarawal': 'SRH',
    'Steve Smith': 'DC',
    'Rahul Tripathi': 'SRH',
    'Sean Abbott': 'SRH',
    'Michael Bracewell': 'RCB',
    'Jason Holder': 'RR',
    'Daryl Mitchell': 'CSK',
    'Daniel Sams': 'LSG',
    'Dasun Shanaka': 'GT',
    'Matthew Short': 'PBKS',
    'Tom Banton': 'KKR',
    'Shai Hope': 'DC',
    'Kyle Jamieson': 'CSK',
    'Saqib Mahmood': 'KKR',
    'Adam Milne': 'CSK',
    'Lungisani Ngidi': 'DC',
    'Mustafizur Rahman': 'CSK',
    'Chetan Sakariya': 'KKR',
    'Kuldeep Sen': 'RR',
    'Umesh Yadav': 'GT',
    'Rohan Kunnummal': 'RR',
    'Manan Vohra': 'LSG',
    'Aman Khan': 'DC',
    'Darshan Nalkande': 'GT',
    'Vicky Ostwal': 'DC',
    'Suyash Prabhudessai': 'RCB',
    'Ricky Bhui': 'DC',
    'Kunal Rathore': 'RR',
    'K.M Asif': 'CSK',
    'Vidwath Kaverappa': 'PBKS',
    'Murugan Ashwin': 'RR',
    'K.C. Cariappa': 'RR',
    'Pravin Dubey': 'DC',
    'Himanshu Sharma': 'RCB',
    'Rehan Ahmed': 'DC',
    'Tom Curran': 'RCB',
    'Gulbadin Naib': 'DC',
    'Alzarri Joseph': 'RCB',
    'Shamar Joseph': 'LSG',
    'Riley Meredith': 'MI',
    'Jhye Richardson': 'DC',
    'Navdeep Saini': 'RR',
    'Naveen Ul Haq': 'LSG',
    'Manoj Bhandage': 'RCB',
    'Mayank Dagar': 'RCB',
    'Raghav Goyal': 'MI',
    'Jalaj Saxena': 'PBKS',
    'Hritik Shokeen': 'MI',
    'Jagadeesha Suchith': 'SRH',
    'Joe Clarke': 'DC',
    'Tristan Luus': 'GT',
    'Sayed Irfan Aftab': 'KKR',
    'Kulwant Khejroliya': 'KKR',
    'Ishan Porel': 'DC',
    'Jason Behrendorff': 'MI',
    'Joshua Little': 'GT',
    'Obed McCoy': 'RR',
    'Billy Stanlake': 'SRH',
    'Sandeep Warrier': 'GT',
    'Chama Milind': 'SRH',
}

def slugify(text):
    text = re.sub(r'[^a-zA-Z0-9]+', '_', text.strip().lower()).strip('_')
    return text

def get_retained_fallback_set(role, is_capped, bowl):
    bowl_l = bowl.lower()
    prefix = '' if is_capped else 'U'
    if role == 'WICKETKEEPER':
        return prefix + 'WK1', 'set_3' if is_capped else 'set_8'
    elif role == 'BATTER':
        return prefix + 'BA1', 'set_1' if is_capped else 'set_6'
    elif role == 'ALL_ROUNDER':
        return prefix + 'AL1', 'set_2' if is_capped else 'set_7'
    elif role == 'BOWLER':
        if 'spin' in bowl_l or 'orthodox' in bowl_l or 'unorthodox' in bowl_l:
            return prefix + 'SP1', 'set_5' if is_capped else 'set_10'
        else:
            return prefix + 'FA1', 'set_4' if is_capped else 'set_9'
    return prefix + 'BA1', 'set_1' if is_capped else 'set_6'

def main():
    stats_path = 'data/real_player_stats.json' if os.path.exists('data/real_player_stats.json') else '/tmp/player_real_stats.json'
    with open(stats_path, 'r') as sf:
        REAL_STATS = json.load(sf)
    with open('data/real_ipl_data.csv', 'r') as f:
        rows = list(csv.DictReader(f))

    auction_rows = [r for r in rows if r['List No'] and r['List No'].isdigit()]
    retained_rows = [r for r in rows if r['Set Code'] == 'RETAINED' or r['Status'] == 'Retained']

    # 1. Sets
    sets_dict = {}
    for r in auction_rows:
        s_no = int(r['Set No'])
        code = r['Set Code'].strip()
        name = r['Set Name'].strip()
        if s_no not in sets_dict:
            sets_dict[s_no] = {
                'id': f'set_{s_no}',
                'setNumber': s_no,
                'setCode': code,
                'setName': f'Set {s_no}: {name} ({code})',
                'displayOrder': s_no,
                'description': f'{name} pool for the IPL 2026 auction.'
            }

    # 2. Auction Players
    all_players = []
    p_map = {}
    for r in auction_rows:
        name = r['Player'].strip()
        p_id = f'p_{slugify(name)}'
        s_no = int(r['Set No'])
        role_raw = r['Role'].strip().lower()
        if 'batter' in role_raw: role = 'BATTER'
        elif 'wicketkeeper' in role_raw: role = 'WICKETKEEPER'
        elif 'all-rounder' in role_raw or 'all_rounder' in role_raw: role = 'ALL_ROUNDER'
        else: role = 'BOWLER'

        country = r['Country'].strip()
        is_overseas = country != 'India'
        is_capped = r['Capped/Uncapped'].strip().lower() == 'capped'
        base_price = int(r['Base Price (₹)'])
        prev_franchise = KNOWN_PREVIOUS_FRANCHISE.get(name, None)
        if prev_franchise:
            p_map[p_id] = prev_franchise

        real_stat = REAL_STATS.get(name, {})
        matches = real_stat.get('matches', 65 if is_capped else 15)
        runs = real_stat.get('runs', 1800 if role in ['BATTER', 'WICKETKEEPER'] else 80)
        bat_avg = real_stat.get('battingAverage', 35.0)
        sr = real_stat.get('strikeRate', 135.0)
        wickets = real_stat.get('wickets', 65 if role == 'BOWLER' else 0)
        econ = real_stat.get('economy', 7.85 if role == 'BOWLER' else 0.0)

        status = r.get('Status', '').strip()
        team_name = r.get('Current Team (IPL 2026)', '').strip()
        team_code = TEAM_CODE_MAP.get(team_name, '')
        price_str = r.get('Price / Salary (₹)', '').strip()
        official_price = int(price_str) if price_str and price_str.isdigit() else 0

        all_players.append({
            'id': p_id,
            'name': name,
            'country': country,
            'isOverseas': is_overseas,
            'role': role,
            'battingStyle': r['Bat'].strip() or 'Right-hand bat',
            'bowlingStyle': r['Bowling Style'].strip() or 'None',
            'basePrice': base_price,
            'matches': matches,
            'runs': runs,
            'battingAverage': bat_avg,
            'strikeRate': sr,
            'wickets': wickets,
            'economy': econ,
            'isCapped': is_capped,
            'previousFranchise': prev_franchise,
            'setId': f'set_{s_no}',
            'orderInSet': int(r['List No']),
            'officialStatus': status,
            'officialTeam': team_name,
            'officialTeamCode': team_code,
            'officialPrice': official_price,
        })

    # 3. Retained Candidates and Rosters
    franchise_retentions = {}
    for code in ['CSK', 'DC', 'GT', 'KKR', 'LSG', 'MI', 'PBKS', 'RR', 'RCB', 'SRH']:
        franchise_retentions[code] = {
            'franchiseCode': code,
            'defaultRetainedIds': [],
            'candidates': []
        }

    for r in retained_rows:
        t_name = r['Current Team (IPL 2026)'].strip()
        code = TEAM_CODE_MAP.get(t_name)
        if not code: continue

        name = r['Player'].strip()
        c_id = f'{code.lower()}_{slugify(name)}'
        role_raw = r['Role'].strip().lower()
        if 'batter' in role_raw: role = 'BATTER'
        elif 'wicketkeeper' in role_raw: role = 'WICKETKEEPER'
        elif 'all-rounder' in role_raw or 'all_rounder' in role_raw: role = 'ALL_ROUNDER'
        else: role = 'BOWLER'

        country = r['Country'].strip()
        is_overseas = country != 'India'
        is_capped = r['Capped/Uncapped'].strip().lower() == 'capped'
        salary = int(r['Price / Salary (₹)']) if r['Price / Salary (₹)'] else 3000000
        bowl = r['Bowling Style'].strip()

        real_stat = REAL_STATS.get(name, {})
        matches = real_stat.get('matches', 120 if is_capped else 25)
        runs = real_stat.get('runs', 3500 if role in ['BATTER', 'WICKETKEEPER'] else 120)
        wickets = real_stat.get('wickets', 120 if role == 'BOWLER' else 0)
        bat_avg = real_stat.get('battingAverage', 38.0)
        sr = real_stat.get('strikeRate', 140.0)
        econ = real_stat.get('economy', 7.65 if role == 'BOWLER' else 0.0)

        cand = {
            'id': c_id,
            'name': name,
            'role': role,
            'country': country,
            'isOverseas': is_overseas,
            'isCapped': is_capped,
            'officialPrice': salary,
            'matches': matches,
            'runs': runs,
            'battingAverage': bat_avg,
            'strikeRate': sr,
            'wickets': wickets,
            'economy': econ,
            'battingStyle': r['Bat'].strip() or 'Right-hand bat',
            'bowlingStyle': bowl or 'None',
            'officialStatus': 'Retained',
            'officialTeam': t_name,
            'officialTeamCode': code,
        }
        franchise_retentions[code]['candidates'].append(cand)
        franchise_retentions[code]['defaultRetainedIds'].append(c_id)

        # Also add retained player to all_players as a fallback if they are un-retained!
        _, fallback_set_id = get_retained_fallback_set(role, is_capped, bowl)
        p_map[c_id] = code
        all_players.append({
            'id': c_id,
            'name': name,
            'country': country,
            'isOverseas': is_overseas,
            'role': role,
            'battingStyle': r['Bat'].strip() or 'Right-hand bat',
            'bowlingStyle': bowl or 'None',
            'basePrice': 20000000 if is_capped else 4000000,
            'matches': matches,
            'runs': runs,
            'battingAverage': bat_avg,
            'strikeRate': sr,
            'wickets': wickets,
            'economy': econ,
            'isCapped': is_capped,
            'previousFranchise': code,
            'setId': fallback_set_id,
            'orderInSet': 999,
            'officialStatus': 'Retained',
            'officialTeam': t_name,
            'officialTeamCode': code,
            'officialPrice': salary,
        })

    # Generate apps/ipl-auction/api/src/db/seedData.ts
    print('Generating apps/ipl-auction/api/src/db/seedData.ts...')
    with open('apps/ipl-auction/api/src/db/seedData.ts', 'w') as f:
        f.write('// Autogenerated official real IPL 2026 auction & retentions dataset\n')
        f.write('import { calculatePlayerHiddenRatings } from "../services/ratingService";\n\n')
        f.write('''export interface SeedFranchise {
  id: string;
  code: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  defaultPurse: number;
  minSquad: number;
  maxSquad: number;
  maxOverseas: number;
}

export interface SeedSet {
  id: string;
  setNumber: number;
  setCode: string;
  setName: string;
  displayOrder: number;
  description: string;
}

export interface SeedPlayer {
  id: string;
  name: string;
  country: string;
  isOverseas: boolean;
  role: "BATTER" | "BOWLER" | "ALL_ROUNDER" | "WICKETKEEPER";
  battingStyle: string;
  bowlingStyle: string;
  basePrice: number;
  matches: number;
  runs: number;
  battingAverage: number;
  strikeRate: number;
  wickets: number;
  economy: number;
  isCapped: boolean;
  previousFranchise?: string | null;
  setId: string;
  orderInSet: number;
  officialStatus?: string;
  officialTeam?: string;
  officialTeamCode?: string;
  officialPrice?: number;
}

export interface RetentionCandidate {
  id: string;
  name: string;
  role: "BATTER" | "BOWLER" | "ALL_ROUNDER" | "WICKETKEEPER";
  country: string;
  isOverseas: boolean;
  isCapped: boolean;
  officialPrice: number;
  matches?: number;
  runs?: number;
  wickets?: number;
  battingAverage?: number;
  strikeRate?: number;
  economy?: number;
  battingStyle?: string;
  bowlingStyle?: string;
  officialStatus?: string;
  officialTeam?: string;
  officialTeamCode?: string;
}

export interface FranchiseRetentionConfig {
  franchiseCode: string;
  defaultRetainedIds: string[];
  candidates: RetentionCandidate[];
}
\n''')
        f.write('export const SEED_FRANCHISES: SeedFranchise[] = ' + json.dumps(FRANCHISE_DETAILS, indent=2) + ';\n\n')

        sorted_sets = [sets_dict[k] for k in sorted(sets_dict.keys())]
        f.write('export const SEED_SETS: SeedSet[] = ' + json.dumps(sorted_sets, indent=2) + ';\n\n')

        f.write('export const RAW_SEED_PLAYERS: SeedPlayer[] = ' + json.dumps(all_players, indent=2) + ';\n\n')
        f.write('export const PLAYER_PREVIOUS_FRANCHISE_MAP: Record<string, string> = ' + json.dumps(p_map, indent=2) + ';\n\n')

        f.write('export const OFFICIAL_FRANCHISE_RETENTIONS: Record<string, FranchiseRetentionConfig> = ' + json.dumps(franchise_retentions, indent=2) + ';\n\n')

        f.write('''export function calculateRetentionDeduction(retained: { isCapped: boolean; officialPrice?: number }[], ruleset?: any): {
  totalDeduction: number;
  cappedCount: number;
  uncappedCount: number;
  rtmCards: number;
} {
  let cappedCount = 0;
  let uncappedCount = 0;
  let totalDeduction = 0;

  for (const p of retained) {
    if (p.isCapped) {
      cappedCount++;
    } else {
      uncappedCount++;
    }
    totalDeduction += (p.officialPrice || (p.isCapped ? 180000000 : 40000000));
  }

  const rtmCards = Math.max(0, Math.min(6, 25 - (cappedCount + uncappedCount)));
  return { totalDeduction, cappedCount, uncappedCount, rtmCards };
}

export const SEED_PLAYERS = RAW_SEED_PLAYERS.map((p) => {
  const hiddenRatings = calculatePlayerHiddenRatings({
    role: p.role,
    matches: p.matches,
    runs: p.runs,
    battingAverage: p.battingAverage,
    strikeRate: p.strikeRate,
    wickets: p.wickets,
    economy: p.economy,
    isCapped: p.isCapped,
  });

  return {
    ...p,
    previousFranchise: PLAYER_PREVIOUS_FRANCHISE_MAP[p.id] || p.previousFranchise || null,
    hiddenRatingBatting: hiddenRatings.batting,
    hiddenRatingBowling: hiddenRatings.bowling,
    hiddenRatingKeeping: hiddenRatings.keeping,
    hiddenRatingOverall: hiddenRatings.overall,
  };
});

/**
 * Authoritative dynamic lot decider:
 * Groups currently available (non-retained) players by Set,
 * shuffles dynamically within each active set, and numbers lots sequentially.
 */
export function computeDynamicAuctionLots(
  allRegisteredPlayers: typeof SEED_PLAYERS,
  allSets: SeedSet[],
  retainedPlayerNames: Set<string>
): any[] {
  const availablePlayers = allRegisteredPlayers.filter(
    (p) => !retainedPlayerNames.has(p.name.trim().toLowerCase())
  );

  const playersBySet = new Map<string, typeof SEED_PLAYERS>();
  for (const p of availablePlayers) {
    if (!playersBySet.has(p.setId)) {
      playersBySet.set(p.setId, []);
    }
    playersBySet.get(p.setId)!.push(p);
  }

  const orderedSets = [...allSets].sort((a, b) => a.displayOrder - b.displayOrder);
  const dynamicLots: any[] = [];
  let lotCounter = 1;

  for (const setInfo of orderedSets) {
    const setPlayers = playersBySet.get(setInfo.id);
    if (!setPlayers || setPlayers.length === 0) continue; // Dynamically omit sets with 0 available players

    // Dynamic shuffle within the set
    const shuffled = [...setPlayers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    shuffled.forEach((p, idx) => {
      dynamicLots.push({
        id: `lot_${lotCounter}`,
        lotNumber: lotCounter,
        setId: setInfo.id,
        setCode: setInfo.setCode,
        setName: setInfo.setName,
        orderInSet: idx + 1,
        playerId: p.id,
        playerName: p.name,
        country: p.country,
        isOverseas: p.isOverseas,
        role: p.role,
        battingStyle: p.battingStyle,
        bowlingStyle: p.bowlingStyle,
        basePrice: p.basePrice,
        matches: p.matches,
        runs: p.runs,
        battingAverage: p.battingAverage,
        strikeRate: p.strikeRate,
        wickets: p.wickets,
        economy: p.economy,
        isCapped: p.isCapped,
        previousFranchise: p.previousFranchise || null,
        hiddenRatingOverall: p.hiddenRatingOverall,
        status: "PENDING",
        currentBid: 0,
        highestBidderFranchise: null,
        soldToFranchise: null,
        finalPrice: null,
      });
      lotCounter++;
    });
  }

  return dynamicLots;
}
''')

    # Generate apps/ipl-auction/web/lib/retentions.ts
    print('Generating apps/ipl-auction/web/lib/retentions.ts...')
    with open('apps/ipl-auction/web/lib/retentions.ts', 'w') as f:
        f.write('// Autogenerated official real IPL 2026 franchise retentions\n')
        f.write('import { PlayerRole } from "./types";\n\n')
        f.write('''export interface RetainedCandidate {
  id: string;
  name: string;
  role: PlayerRole;
  country: string;
  isOverseas: boolean;
  isCapped: boolean;
  officialPrice: number;
  matches: number;
  runs: number;
  wickets: number;
  battingAverage?: number;
  strikeRate?: number;
  economy?: number;
  battingStyle?: string;
  bowlingStyle?: string;
  officialStatus?: string;
  officialTeam?: string;
  officialTeamCode?: string;
}

export interface FranchiseRetentionConfig {
  franchiseCode: string;
  defaultRetainedIds: string[];
  candidates: RetainedCandidate[];
}
\n''')
        f.write('export const OFFICIAL_FRANCHISE_RETENTIONS: Record<string, FranchiseRetentionConfig> = ' + json.dumps(franchise_retentions, indent=2) + ';\n\n')
        f.write('''export function calculateRetentionDeduction(retained: { isCapped: boolean; officialPrice?: number }[], ruleset?: any): {
  totalDeduction: number;
  cappedCount: number;
  uncappedCount: number;
  rtmCards: number;
} {
  let cappedCount = 0;
  let uncappedCount = 0;
  let totalDeduction = 0;

  for (const p of retained) {
    if (p.isCapped) {
      cappedCount++;
    } else {
      uncappedCount++;
    }
    totalDeduction += (p.officialPrice || (p.isCapped ? 180000000 : 40000000));
  }

  const rtmCards = Math.max(0, Math.min(6, 25 - (cappedCount + uncappedCount)));
  return { totalDeduction, cappedCount, uncappedCount, rtmCards };
}
''')

    print('Generation completed successfully!')

if __name__ == '__main__':
    main()
