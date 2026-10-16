import csv
import json
import re

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

def parse_data():
    with open('data/real_ipl_data.csv', 'r') as f:
        rows = list(csv.DictReader(f))

    auction = [r for r in rows if r['List No'] and r['List No'].isdigit()]
    retained = [r for r in rows if r['Set Code'] == 'RETAINED' or r['Status'] == 'Retained']

    # 1. Sets
    sets_dict = {}
    for r in auction:
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
                'description': f'{name} set for the IPL 2026 auction.'
            }

    # 2. Auction Players
    auction_players = []
    for r in auction:
        name = r['Player'].strip()
        p_id = f'p_{slugify(name)}'
        s_no = int(r['Set No'])
        role_raw = r['Role'].strip().lower()
        if 'batter' in role_raw:
            role = 'BATTER'
        elif 'wicketkeeper' in role_raw:
            role = 'WICKETKEEPER'
        elif 'all-rounder' in role_raw or 'all_rounder' in role_raw:
            role = 'ALL_ROUNDER'
        else:
            role = 'BOWLER'

        country = r['Country'].strip()
        is_overseas = country != 'India'
        is_capped = r['Capped/Uncapped'].strip().lower() == 'capped'
        base_price = int(r['Base Price (₹)'])
        prev_franchise = KNOWN_PREVIOUS_FRANCHISE.get(name, None)

        # Approximate cricket stats based on capped/uncapped and role
        matches = 65 if is_capped else 20
        runs = 1800 if role in ['BATTER', 'WICKETKEEPER'] else (1000 if role == 'ALL_ROUNDER' else 80)
        if not is_capped: runs = int(runs * 0.35); matches = 15
        bat_avg = 36.5 if role in ['BATTER', 'WICKETKEEPER'] else 26.0
        sr = 142.5 if is_capped else 132.0
        wickets = 65 if role == 'BOWLER' else (35 if role == 'ALL_ROUNDER' else 0)
        if not is_capped and role in ['BOWLER', 'ALL_ROUNDER']: wickets = int(wickets * 0.4)
        econ = 7.85 if role == 'BOWLER' else 8.45

        auction_players.append({
            'id': p_id,
            'name': name,
            'country': country,
            'isOverseas': is_overseas,
            'role': role,
            'battingStyle': r['Bat'].strip() or ('Right-hand bat' if 'RHB' in r['Bat'] else 'Left-hand bat'),
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
        })

    # 3. Retained Players per franchise
    franchise_retentions = {}
    for code in ['CSK', 'DC', 'GT', 'KKR', 'LSG', 'MI', 'PBKS', 'RR', 'RCB', 'SRH']:
        franchise_retentions[code] = {
            'franchiseCode': code,
            'defaultRetainedIds': [],
            'candidates': []
        }

    for r in retained:
        t_name = r['Current Team (IPL 2026)'].strip()
        code = TEAM_CODE_MAP.get(t_name)
        if not code: continue

        name = r['Player'].strip()
        c_id = f'{code.lower()}_{slugify(name)}'
        role_raw = r['Role'].strip().lower()
        if 'batter' in role_raw:
            role = 'BATTER'
        elif 'wicketkeeper' in role_raw:
            role = 'WICKETKEEPER'
        elif 'all-rounder' in role_raw or 'all_rounder' in role_raw:
            role = 'ALL_ROUNDER'
        else:
            role = 'BOWLER'

        country = r['Country'].strip()
        is_overseas = country != 'India'
        is_capped = r['Capped/Uncapped'].strip().lower() == 'capped'
        salary = int(r['Price / Salary (₹)']) if r['Price / Salary (₹)'] else 3000000

        matches = 120 if is_capped else 25
        runs = 3500 if role in ['BATTER', 'WICKETKEEPER'] else 1200
        wickets = 120 if role == 'BOWLER' else 50

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
            'wickets': wickets,
            'battingStyle': r['Bat'].strip() or 'Right-hand bat',
            'bowlingStyle': r['Bowling Style'].strip() or 'None',
        }
        franchise_retentions[code]['candidates'].append(cand)
        franchise_retentions[code]['defaultRetainedIds'].append(c_id)

    return sets_dict, auction_players, franchise_retentions

if __name__ == '__main__':
    sets_dict, auction_players, franchise_retentions = parse_data()
    print(f'Parsed {len(sets_dict)} sets, {len(auction_players)} auction players, {len(franchise_retentions)} franchise retention rosters.')
    for code, info in franchise_retentions.items():
        cands = info['candidates']
        print(f"{code}: {len(cands)} candidates")
