"""Caption cues from content.json and the narration lengths -> out/cues.json (same rule as film.js subs())"""
import json, os
H = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
C = json.load(open(os.path.join(H, 'content.json'))); D = json.load(open(os.path.join(H, 'voices', 'dur.json'))); V = C['voice']; cues = []
for i, v in enumerate(V):
    t1 = max(v['at'] + D[v['id']] + .6, v['at'] + 1.8)
    if i + 1 < len(V): t1 = min(t1, V[i + 1]['at'] - .14)
    cues.append({'t0': round(v['at'] - .1, 3), 't1': round(t1, 3), 'text': v['sub']})
os.makedirs(os.path.join(H, 'out'), exist_ok=True); json.dump(cues, open(os.path.join(H, 'out', 'cues.json'), 'w'), indent=1)
