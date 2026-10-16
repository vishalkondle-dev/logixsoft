#!/usr/bin/env python3
"""
Exports a complete, comprehensive CSV file containing all 532 IPL players with all their
details from both the official real IPL 2026 data and the auction simulator database.
"""

import json
import csv
import os
import subprocess

def main():
    # 1. Ensure dump from TypeScript seed exists
    dump_path = "/tmp/seed_players_dump.json"
    if not os.path.exists(dump_path):
        subprocess.run([
            "npx", "tsx", "-e",
            """
            import { SEED_PLAYERS, SEED_SETS, OFFICIAL_FRANCHISE_RETENTIONS } from "./apps/ipl-auction/api/src/db/seedData";
            import * as fs from "fs";
            fs.writeFileSync("/tmp/seed_players_dump.json", JSON.stringify({
              players: SEED_PLAYERS,
              sets: SEED_SETS,
              retentions: OFFICIAL_FRANCHISE_RETENTIONS,
            }));
            """
        ], check=True)

    with open(dump_path, 'r', encoding='utf-8') as f:
        dump = json.load(f)

    seed_players = dump['players']
    sets_by_id = {s['id']: s for s in dump['sets']}
    retentions = dump['retentions']

    TEAM_CODE_TO_NAME = {
        'CSK': 'Chennai Super Kings',
        'DC': 'Delhi Capitals',
        'GT': 'Gujarat Titans',
        'KKR': 'Kolkata Knight Riders',
        'LSG': 'Lucknow Super Giants',
        'MI': 'Mumbai Indians',
        'PBKS': 'Punjab Kings',
        'RR': 'Rajasthan Royals',
        'RCB': 'Royal Challengers Bengaluru',
        'SRH': 'Sunrisers Hyderabad'
    }
    TEAM_NAME_TO_CODE = {v: k for k, v in TEAM_CODE_TO_NAME.items()}

    retained_player_ids = {}
    for code, r_data in retentions.items():
        for cand in r_data.get('candidates', []):
            retained_player_ids[cand['id']] = {
                'franchiseCode': code,
                'officialPrice': cand.get('officialPrice', 0)
            }

    with open('data/real_ipl_data.csv', 'r', encoding='utf-8') as f:
        real_rows = list(csv.DictReader(f))

    real_by_name = {r['Player'].strip().lower(): r for r in real_rows}

    def format_inr(val):
        if not val or val <= 0:
            return ''
        if val >= 10000000:
            cr = val / 10000000
            return f'₹{cr:.2f} Cr' if cr % 1 != 0 else f'₹{int(cr)} Cr'
        elif val >= 100000:
            lakh = val / 100000
            return f'₹{lakh:.2f} L' if lakh % 1 != 0 else f'₹{int(lakh)} L'
        return f'₹{val:,}'

    def format_role(role_raw):
        r = role_raw.upper()
        if r == 'BATTER': return 'Batter'
        if r == 'BOWLER': return 'Bowler'
        if r == 'ALL_ROUNDER': return 'All-rounder'
        if r == 'WICKETKEEPER': return 'Wicketkeeper'
        return role_raw

    out_rows = []

    for p in seed_players:
        name_key = p['name'].strip().lower()
        real = real_by_name.get(name_key, {})

        set_obj = sets_by_id.get(p.get('setId', ''), {})
        set_no = set_obj.get('setNumber', '')
        set_code = set_obj.get('setCode', '')
        set_name = set_obj.get('setName', '')

        real_status = real.get('Status', '')
        real_team_name = real.get('Current Team (IPL 2026)', '').strip()
        real_team_code = TEAM_NAME_TO_CODE.get(real_team_name, '')

        real_price_str = real.get('Price / Salary (₹)', '').strip()
        real_price_int = int(real_price_str) if real_price_str and real_price_str.isdigit() else 0

        ret_info = retained_player_ids.get(p['id'])
        is_retained_in_sim = 'Yes' if ret_info else 'No'
        sim_starting_team = ret_info['franchiseCode'] if ret_info else 'Auction Pool'

        base_price = p.get('basePrice', 0)

        prev_code = p.get('previousFranchise') or ''
        prev_name = TEAM_CODE_TO_NAME.get(prev_code, '')

        bat_style = p.get('battingStyle', '')
        if bat_style == 'RHB': bat_style = 'Right-hand bat (RHB)'
        elif bat_style == 'LHB': bat_style = 'Left-hand bat (LHB)'

        bowl_style = p.get('bowlingStyle', '')
        if bowl_style == 'None': bowl_style = '-'

        order_in_set = p.get('orderInSet')
        if order_in_set == 999:
            order_in_set = '-'

        row = {
            'Player ID': p['id'],
            'Player Name': p['name'],
            'Country': p['country'],
            'Is Overseas': 'Yes' if p.get('isOverseas') else 'No',
            'Role': format_role(p.get('role', '')),
            'Batting Style': bat_style,
            'Bowling Style': bowl_style,
            'Capped / Uncapped': 'Capped' if p.get('isCapped') else 'Uncapped',
            'Base Price (₹)': base_price,
            'Base Price Formatted': format_inr(base_price),
            'Set Number': set_no,
            'Set Code': set_code,
            'Set Name': set_name,
            'Order In Set': order_in_set,
            'Previous / Last Team Code': prev_code,
            'Previous / Last Team Name': prev_name,
            'Matches': p.get('matches', 0),
            'Runs': p.get('runs', 0),
            'Batting Average': p.get('battingAverage', 0),
            'Strike Rate': p.get('strikeRate', 0),
            'Wickets': p.get('wickets', 0),
            'Economy': p.get('economy', 0),
            'AI Rating Batting': p.get('hiddenRatingBatting', 0),
            'AI Rating Bowling': p.get('hiddenRatingBowling', 0),
            'AI Rating Keeping': p.get('hiddenRatingKeeping', 0),
            'AI Rating Overall': p.get('hiddenRatingOverall', 0),
            'Official IPL 2026 Status': real_status,
            'Official IPL 2026 Team Code': real_team_code,
            'Official IPL 2026 Team Name': real_team_name,
            'Official IPL 2026 Price / Salary (₹)': real_price_int if real_price_int > 0 else '',
            'Official IPL 2026 Price Formatted': format_inr(real_price_int) if real_price_int > 0 else '',
            'Simulator Starting Squad': sim_starting_team,
            'Is Starting Retained': is_retained_in_sim
        }
        out_rows.append(row)

    def sort_key(r):
        s_no = r['Set Number']
        s_int = int(s_no) if isinstance(s_no, int) or (isinstance(s_no, str) and s_no.isdigit()) else 999
        ord_val = r['Order In Set']
        ord_int = int(ord_val) if isinstance(ord_val, int) or (isinstance(ord_val, str) and ord_val.isdigit()) else 999
        return (s_int, ord_int, r['Player Name'])

    out_rows.sort(key=sort_key)

    fieldnames = list(out_rows[0].keys())

    out_paths = [
        'all_players_full_details.csv',
        'data/all_players_full_details.csv',
        '/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/all_players_full_details.csv'
    ]

    for out_path in out_paths:
        with open(out_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(out_rows)
        print(f'Saved {len(out_rows)} players to {out_path} ({os.path.getsize(out_path):,} bytes)')

if __name__ == '__main__':
    main()
