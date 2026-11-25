import json, statistics as st, collections as C, math, sys
rows=[json.loads(l) for l in open(sys.argv[1])]
N=len(rows); out=[]
P=lambda *a: out.append(" ".join(str(x) for x in a))
def wilson(w,n,z=1.96):
    if n==0: return (0,0)
    p=w/n; d=1+z*z/n; c=p+z*z/(2*n); h=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))
    return (100*(c-h)/d,100*(c+h)/d)
pct=lambda x:f"{100*x:.1f}%"
q=lambda xs,p: sorted(xs)[int(p*(len(xs)-1))]
L=[r['len'] for r in rows]
P("## Overall (n=%d)"%N)
P("| metric | value |\n|---|---|")
P(f"| Match length median (p10–p90) | {q(L,.5):.0f} s ({q(L,.1):.0f}–{q(L,.9):.0f}) |")
P(f"| End reasons | {dict(C.Counter(r['reason'] for r in rows))} |")
bw=sum(r['winner']=='blue' for r in rows); lo,hi=wilson(bw,N)
P(f"| Blue side win | {100*bw/N:.1f}% (95% CI {lo:.1f}–{hi:.1f}) |")
src=C.Counter(); marg=[]
for r in rows:
    w=r['winner']
    if w not in('blue','red'): continue
    l='red' if w=='blue' else 'blue'
    for k in('kills','ticks','claims'): src[k]+=r['parts'][w][k]
    marg.append(r['score'][w]-r['score'][l])
t=sum(src.values())
P(f"| Winner's points: kills / majority ticks / claims | {100*src['kills']/t:.0f} / {100*src['ticks']/t:.0f} / {100*src['claims']/t:.0f}% |")
P(f"| Winning margin (mean) | {st.mean(marg):.1f} |")
m=lambda k:[r['m'][k] for r in rows]
P(f"| Kills per game | {st.mean(m('kills')):.1f} |")
P(f"| Quiet time (median) | {100*q(m('quiet'),.5):.1f}% |")
P(f"| Gang deaths (3+ assists) | {100*st.mean(m('gang')):.1f}% |")
P(f"| Solo kills / multikills per game | {st.mean(m('solo')):.2f} / {st.mean(m('multi')):.2f} |")
P(f"| Lead changes / comeback wins | {st.mean(m('lead_changes')):.2f} / {100*st.mean(m('comeback')):.1f}% |")
P(f"| Side and middle fighting at once | {100*st.mean(m('split')):.1f}% of fight time |")
fr=[r['t_first_R'] for r in rows if r['t_first_R'] is not None]; l7=[r['t_L7'] for r in rows if r['t_L7'] is not None]
P(f"| First ult (median) / games reaching L7 | {q(fr,.5):.0f} s / {100*len(l7)/N:.1f}% |")
pairs=C.defaultdict(dict)
for r in rows: pairs[r['i']][r['swapped']]=r['winner']
flip=sum(1 for v in pairs.values() if len(v)==2 and v[True]!=v[False])
P(f"| Swapped twin had the opposite winner | {100*flip/len(pairs):.1f}% |")

P("\n## Tactics (preset vs preset, both sides pooled; win % of the row preset)")
pre=["hold_the_pit","hunt","starve"]
mat=C.defaultdict(lambda:[0,0]); lens=C.defaultdict(list)
for r in rows:
    a,b=r['tactics']['blue']['preset'],r['tactics']['red']['preset']
    lens[tuple(sorted((a,b)))].append(r['len'])
    if a==b: continue
    mat[(a,b)][1]+=1; mat[(a,b)][0]+=r['winner']=='blue'
    mat[(b,a)][1]+=1; mat[(b,a)][0]+=r['winner']=='red'
P("| row vs col | "+" | ".join(pre)+" |\n|---|---|---|---|")
for a in pre:
    P(f"| {a} | "+" | ".join("—" if a==b else f"{100*mat[(a,b)][0]/mat[(a,b)][1]:.0f}% (n{mat[(a,b)][1]})" for b in pre)+" |")
P("Median length by pairing: "+", ".join(f"{a[:4]}/{b[:4]} {q(v,.5):.0f}s" for (a,b),v in sorted(lens.items())))

def sideStat(key, label):
    d=C.defaultdict(lambda:[0,0])
    for r in rows:
        for s,o in(('blue','red'),('red','blue')):
            v=r['tactics'][s][key]; ov=r['tactics'][o][key]
            if v==ov: continue
            d[v][1]+=1; d[v][0]+=r['winner']==s
    P(f"- {label}: "+", ".join(f"{k}: {100*w/n:.1f}% (n{n}, CI {wilson(w,n)[0]:.0f}–{wilson(w,n)[1]:.0f})" for k,(w,n) in sorted(d.items(), key=lambda x:str(x[0]))))
P("\n## Coach settings (win % when the two sides differ on the setting)")
sideStat('aggression','Aggression'); sideStat('protect_the_carry','Protect the carry'); sideStat('combo_style','Combo style')

P("\n## Player attributes (team mean difference vs win)")
attrs=list(rows[0]['attrs']['blue'][0].keys())
for a in attrs:
    xs=[];ys=[]; hi=[0,0]
    for r in rows:
        d=st.mean(p[a] for p in r['attrs']['blue'])-st.mean(p[a] for p in r['attrs']['red'])
        y=1 if r['winner']=='blue' else 0
        xs.append(d); ys.append(y)
        if abs(d)>=4: hi[1]+=1; hi[0]+= (y==1)==(d>0)
    mx,my=st.mean(xs),st.mean(ys); cov=sum((x-mx)*(y-my) for x,y in zip(xs,ys))/len(xs)
    corr=cov/(st.pstdev(xs)*st.pstdev(ys))
    P(f"- {a}: corr {corr:+.3f}; team ahead by ≥4 wins {100*hi[0]/max(1,hi[1]):.1f}% (n{hi[1]})")

P("\n## Champions (side-swap pooled; 95% Wilson CI)")
slot=['top','jungle','mid','adc','support']
ch=C.defaultdict(lambda:{'w':0,'n':0,'k':0,'d':0,'a':0,'dmg':0,'slot':C.Counter()})
for r in rows:
    for idx,c in enumerate(r['champs']):
        side='blue' if idx<5 else 'red'; s=ch[c]; s['n']+=1; s['w']+=r['winner']==side
        kd=r['kda'][idx]; s['k']+=kd['k']; s['d']+=kd['d']; s['a']+=kd['a']; s['dmg']+=kd['dmg']; s['slot'][slot[idx%5]]+=1
P("| champion | role | win % | 95% CI | games | KDA | dmg/game | flag |\n|---|---|---|---|---|---|---|---|")
for c,s in sorted(ch.items(), key=lambda x:-x[1]['w']/x[1]['n']):
    lo,hi=wilson(s['w'],s['n']); wr=100*s['w']/s['n']
    flag="**strong**" if lo>52 else "**weak**" if hi<48 else ("lean strong" if lo>50 else "lean weak" if hi<50 else "")
    P(f"| {c} | {s['slot'].most_common(1)[0][0]} | {wr:.1f}% | {lo:.0f}–{hi:.0f} | {s['n']} | {(s['k']+s['a'])/max(1,s['d']):.2f} | {s['dmg']/s['n']:.0f} | {flag} |")

P("\n## Composition archetypes")
ar=C.defaultdict(lambda:[0,0]); am=C.defaultdict(lambda:[0,0])
for r in rows:
    for s,o in(('blue','red'),('red','blue')):
        a,b=r['arch'][s],r['arch'][o]; ar[a][1]+=1; ar[a][0]+=r['winner']==s
        if a!=b: am[(a,b)][1]+=1; am[(a,b)][0]+=r['winner']==s
P("vs field: "+", ".join(f"{a} {100*w/n:.0f}% (n{n})" for a,(w,n) in sorted(ar.items(), key=lambda x:-x[1][0]/x[1][1])))
P("head to head (n≥40): "+", ".join(f"{a}>{b} {100*w/n:.0f}% (n{n})" for (a,b),(w,n) in sorted(am.items()) if n>=40 and w/n>=0.5))
print("\n".join(out))
