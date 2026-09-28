'use strict';
  // ============================================================================================
  // GROWN-UP VIEW
  // ============================================================================================
  function drawGrown(v) {
    const g = $('grown'); if (g.hidden || !S) return;
    const r = SIM.receipt(S), e = r.equation;
    const maxL = Math.max(10, ...CT.LOAD_ORDER.map(k => v.load[k]));
    const bars = CT.LOAD_ORDER.map(k => `<div class="bar"><span>${CT.LOADS[k].glyph} ${CT.LOADS[k].name}</span><i><em style="width:${v.load[k] / maxL * 100}%;background:${CT.LOADS[k].color}"></em></i><b>${v.load[k].toFixed(1)}</b></div>`).join('');
    const yes = b => b ? 'yes' : 'no';
    const disc = [...discovered].map(id => ({ hug: 'Pip loves hugs (hugs work extra well)', stomp: 'Pip calms with movement (+30%)', loud: 'Pip hates loud noise (sensory hits +30%)' }[id])).filter(Boolean);
    const phaseTip = v.phase === 'day' ? (v.masking ? 'At school Pip masks: calm face, full bucket. Expect it to come out after school (restraint collapse).' : 'Notice the early signs in yellow (heart, breathing, hot face) and use a tool then.') : CT.PHASES[v.phase].name + ': ' + CT.PHASES[v.phase].tip;
    g.innerHTML = `
      <div class="card"><h3>Right now · ${v.clock}</h3><p>${esc(phaseTip)}</p>
        ${v.flat ? `<p style="color:var(--plum);font-weight:700">${CT.STR.flat}</p>` : ''}
        <div class="stats"><span>Pressure / threshold</span><b>${v.pressure.toFixed(1)} / ${v.threshold}</b><span>Zone</span><b>${v.zone}</b>
        <span>Hungry · tired · rushed</span><b>${yes(v.hungry)} · ${yes(v.tired)} · ${yes(v.rushed)}</b>
        <span>Adrenaline (fast)</span><b>${v.adrenaline.toFixed(0)}</b><span>Cortisol (slow)</span><b>${v.cortisol.toFixed(0)}${v.cortisol > SIM.CONFIG.CORT_TALK ? ' · too soon to talk' : ''}</b>
        <span>Recovery floor</span><b>${v.floor.toFixed(1)}</b><span>Grown-up’s stress</span><b>${v.adult.toFixed(0)} ${v.wave === 'blue' ? '(calm waves)' : v.wave === 'red' ? '(stress waves)' : ''}</b>
        <span>Puppet strings</span><b>${v.strings}</b><span>Skills (breath · stomp)</span><b>L${S.skills.breathe.level} · L${S.skills.stomp.level}</b>
        <span>Predictions tried</span><b>${predictScore.total}</b></div>
        ${disc.length ? `<p class="note">Discovered: ${disc.join('; ')}.</p>` : '<p class="note">Pip has hidden preferences. Try things to discover them.</p>'}</div>
      <div class="card"><h3>What’s in the bucket</h3><div class="bars">${bars}</div>
        <p class="note">Threshold = 60 + 2 × My Choice + I Can Do It + Together = ${v.threshold}</p></div>
      <div class="card"><h3>The equation, so far today</h3>
        <div class="eq">${CT.STR.equation}<br><b>${e.load.toFixed(0)}</b> − <b>${e.recovery.toFixed(0)}</b> − <b>${e.skills.toFixed(0)}</b> − <b>${e.support.toFixed(0)}</b> = <b>${e.total >= 0 ? '+' : ''}${e.total.toFixed(0)}</b></div>
        <p class="note">Load: everything that added drops. Recovery: rest, meals, movement, nature. Skills: Pip’s own tools. Support: helpers and calm grown-ups.</p>
        <p class="note">${CT.STR.disclaimer}</p><p class="note">${esc(voiceStatusText())}</p></div>
      <div class="card"><h3>Science cards</h3><div class="sci-list">${Object.entries(CT.SCIENCE).map(([k, s]) => `<button class="chip" type="button" data-sci="${k}">${esc(s.title)}</button>`).join('')}</div></div>`;
  }
  $('grown').addEventListener('click', e => { const b = e.target.closest('[data-sci]'); if (b) scienceCard(b.dataset.sci); });

