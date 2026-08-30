/**
 * 杏坛 · 交互式元素周期表
 * 数据：Bowserinator/Periodic-Table-JSON（CC-BY-SA 3.0，vendor/PeriodicTableJSON.json）
 * 中文教学：内置 1-103 号元素中文名；104+ 人工合成元素显示符号。
 * 渲染：18 列标准周期表（镧系锕系独立两行），点元素看详情卡。
 */
const Periodic = (() => {
  'use strict';
  // 1-103 号元素中文名（按原子序数）
  const ZH = ['氢', '氦', '锂', '铍', '硼', '碳', '氮', '氧', '氟', '氖',
    '钠', '镁', '铝', '硅', '磷', '硫', '氯', '氩',
    '钾', '钙', '钪', '钛', '钒', '铬', '锰', '铁', '钴', '镍', '铜', '锌', '镓', '锗', '砷', '硒', '溴', '氪',
    '铷', '锶', '钇', '锆', '铌', '钼', '锝', '钌', '铑', '钯', '银', '镉', '铟', '锡', '锑', '碲', '碘', '氙',
    '铯', '钡', '镧', '铈', '镨', '钕', '钷', '钐', '铕', '钆', '铽', '镝', '钬', '铒', '铥', '镱', '镥',
    '铪', '钽', '钨', '铼', '锇', '铱', '铂', '金', '汞', '铊', '铅', '铋', '钋', '砹', '氡',
    '钫', '镭', '锕', '钍', '镤', '铀', '镎', '钚', '镅', '锔', '锫', '锎', '锿', '镄', '钔', '锘', '铹'];
  const CAT_ZH = {
    'diatomic nonmetal': '双原子非金属', 'polyatomic nonmetal': '多原子非金属',
    'noble gas': '稀有气体', 'alkali metal': '碱金属', 'alkaline earth metal': '碱土金属',
    'metalloid': '类金属', 'halogen': '卤素', 'post-transition metal': '过渡后金属',
    'transition metal': '过渡金属', 'lanthanide': '镧系元素', 'actinide': '锕系元素',
    'unknown, probably diatomic nonmetal': '待确认非金属', 'unknown, probably noble gas': '待确认稀有气体',
    'unknown, probably transition metal': '待确认过渡金属', 'unknown, probably post-transition metal': '待确认金属',
    'unknown, probably metalloid': '待确认类金属', 'unknown, probably alkali metal': '待确认碱金属',
    'unknown, probably alkaline earth metal': '待确认碱土金属', 'unknown, probably halogen': '待确认卤素',
    'unknown': '性质待确认'
  };
  const CAT_COLOR = {
    'alkali metal': '#ff9d9d', 'alkaline earth metal': '#ffd57e', 'transition metal': '#ffc9c9',
    'post-transition metal': '#b5e0b5', 'metalloid': '#c9e4a5', 'diatomic nonmetal': '#a5d8ff',
    'polyatomic nonmetal': '#b8f0d8', 'halogen': '#f5c6ff', 'noble gas': '#d4b8f5',
    'lanthanide': '#ffb8d9', 'actinide': '#e0c0a0'
  };
  const catColor = c => {
    for (const k in CAT_COLOR) if (c.startsWith(k)) return CAT_COLOR[k];
    return '#dfe5ee';
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = v => (v === null || v === undefined) ? '—' : (typeof v === 'number' ? (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString() : Math.round(v * 1000) / 1000) : v);

  let data = null;

  // xpos/ypos → 标准周期表布局（镧系锕系独立两行）
  function pos(e) {
    let x = e.xpos, y = e.ypos;
    if (y > 7) { y = e.number >= 57 && e.number <= 71 ? 9 : 10; x = e.number - 57 + 3; if (e.number >= 89) x = e.number - 89 + 3; }
    return { x, y };
  }

  function renderGrid(container) {
    container.innerHTML = '';
    container.style.display = 'grid';
    container.style.gridTemplateColumns = 'repeat(18, minmax(34px, 1fr))';
    container.style.gap = '2px';
    data.elements.forEach(e => {
      if (e.number > 118) return;
      const { x, y } = pos(e);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'pt-cell';
      cell.style.gridColumn = String(x);
      cell.style.gridRow = String(y);
      cell.style.background = catColor(e.category);
      cell.title = (e.number <= 103 ? ZH[e.number - 1] : e.symbol) + ' · ' + (CAT_ZH[e.category] || e.category);
      cell.innerHTML = `<span class="pt-num">${e.number}</span><span class="pt-sym">${esc(e.symbol)}</span>` +
        `<span class="pt-zh">${e.number <= 103 ? esc(ZH[e.number - 1]) : '&nbsp;'}</span>`;
      cell.addEventListener('click', () => {
        container.querySelectorAll('.pt-cell.sel').forEach(c => c.classList.remove('sel'));
        cell.classList.add('sel');
        showDetail(e);
      });
      container.appendChild(cell);
    });
    // 占位提示：镧系/锕系行首
    const hint = (row, label) => {
      const d = document.createElement('div');
      d.className = 'pt-lant';
      d.style.gridColumn = '1';
      d.style.gridRow = String(row);
      d.textContent = label;
      container.appendChild(d);
    };
    hint(9, '镧系');
    hint(10, '锕系');
  }

  function showDetail(e) {
    const zh = e.number <= 103 ? ZH[e.number - 1] : '（人工合成）';
    const shell = (e.shells || []).join(' · ');
    document.getElementById('pt-detail').innerHTML = `
      <div class="ptd-head">
        <div class="ptd-badge" style="background:${catColor(e.category)}">
          <div class="ptd-num">${e.number}</div><div class="ptd-sym">${esc(e.symbol)}</div>
        </div>
        <div>
          <div class="ptd-name">${esc(zh)} <span class="ptd-en">${esc(e.name)}</span></div>
          <div class="ptd-cat">${esc(CAT_ZH[e.category] || e.category)} · 第 ${e.period} 周期${e.group ? ' · 第 ' + e.group + ' 族' : ''}</div>
        </div>
      </div>
      <div class="ptd-rows">
        <div><i>相对原子质量</i><b>${fmt(e.atomic_mass)}</b></div>
        <div><i>电子排布</i><b>${esc(shell || '—')}</b></div>
        <div><i>电负性</i><b>${fmt(e.electronegativity_x)}</b></div>
        <div><i>常温状态</i><b>${e.phase === 'Gas' ? '气态' : e.phase === 'Liquid' ? '液态' : e.phase === 'Solid' ? '固态' : '—'}</b></div>
        <div><i>密度 (g/L·固态 g/cm³)</i><b>${fmt(e.density)}</b></div>
        <div><i>熔点 (K)</i><b>${fmt(e.melt)}</b></div>
        <div><i>沸点 (K)</i><b>${fmt(e.boil)}</b></div>
        <div><i>放射性与半衰期</i><b>${e.radioactive ? `${esc(e.radioactive)}${e.half_life ? ' · ' + esc(e.half_life) : ''}` : '—'}</b></div>
      </div>
      ${e.summary ? `<details class="ptd-sum"><summary>简介（英文，源自维基百科）</summary><p>${esc(e.summary).slice(0, 600)}…</p></details>` : ''}`;
  }

  function init() {
    if (data) return Promise.resolve();
    const grid = document.getElementById('pt-grid');
    grid.innerHTML = '<div class="pt-loading">周期表数据加载中…</div>';
    return fetch('vendor/PeriodicTableJSON.json')
      .then(r => r.json())
      .then(d => {
        data = d;
        renderGrid(grid);
        // 默认展示氢
        showDetail(data.elements[0]);
      })
      .catch(() => { grid.innerHTML = '<div class="pt-loading">周期表数据加载失败（vendor/PeriodicTableJSON.json 缺失）</div>'; });
  }

  return { init };
})();
