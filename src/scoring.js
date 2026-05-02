import { GROUP_MATCHES, KNOCKOUT_MATCHES, SPEC_FIELDS } from './constants';

export function matchOutcome(h, a) {
  const hi = parseInt(h), ai = parseInt(a);
  if (isNaN(hi) || isNaN(ai)) return null;
  return hi > ai ? 'H' : hi < ai ? 'A' : 'D';
}

export function calcMatchPts(tip, act) {
  if (!tip || act?.home === undefined || act?.away === undefined) return 0;
  let p = 0;
  if (matchOutcome(tip.home, tip.away) === matchOutcome(act.home, act.away)) p += 2;
  if (parseInt(tip.home) === parseInt(act.home)) p += 1;
  if (parseInt(tip.away) === parseInt(act.away)) p += 1;
  // Superbonus: correct score AND 5+ goals total = 5p
  if (p === 4 && (parseInt(act.home) + parseInt(act.away)) >= 5) p = 5;
  return p;
}

export function calcScore(user, results) {
  let total = 0;
  let fulltreff = 0;
  const bd = { matches: {}, groups: {}, special: {} };

  [...GROUP_MATCHES, ...KNOCKOUT_MATCHES].forEach(m => {
    const tip = user.tips?.[m.id];
    const act = results[m.id];
    if (tip && act) {
      const p = calcMatchPts(tip, act);
      if (p > 0) { bd.matches[m.id] = p; total += p; }
      if (p === 4) fulltreff++;
    }
  });

  Object.keys(user.groupOrders || {}).forEach(g => {
    const act = results[`grp_${g}`];
    const tip = user.groupOrders[g];
    if (act && tip) {
      tip.forEach((team, i) => {
        if (team && team === act[i]) { bd.groups[`${g}${i}`] = 5; total += 5; }
      });
    }
  });

  SPEC_FIELDS.forEach(({ key, pts }) => {
    const sp = user.specialTips?.[key];
    if (sp && results[key] && sp === results[key]) {
      bd.special[key] = pts; total += pts;
    }
  });

  return { total, fulltreff, bd };
}
