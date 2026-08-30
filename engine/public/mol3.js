/**
 * 杏坛 · 分子 3D 结构视图
 * 引擎：3Dmol.js 2.x（BSD，本地 vendor/3dmol.min.js）
 * 结构来源：PubChem CID 在线获取（此步骤需联网），内置教学常见分子。
 */
const Mol3 = (() => {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MOLS = [
    { cid: 962, name: '水', formula: 'H₂O' },
    { cid: 280, name: '二氧化碳', formula: 'CO₂' },
    { cid: 297, name: '甲烷', formula: 'CH₄' },
    { cid: 222, name: '氨', formula: 'NH₃' },
    { cid: 241, name: '苯', formula: 'C₆H₆' },
    { cid: 702, name: '乙醇', formula: 'C₂H₅OH' },
    { cid: 176, name: '乙酸', formula: 'CH₃COOH' },
    { cid: 5793, name: '葡萄糖', formula: 'C₆H₁₂O₆' }
  ];
  const STYLE_SPEC = {
    stick: { stick: { radius: 0.16 } },
    sphere: { sphere: { scale: 0.85 } },
    line: { line: {} }
  };

  let viewer = null, currentCid = null, ready = false, loadTimer = null;

  function ensureViewer() {
    const div = document.getElementById('mol3-view');
    if (!window.$3Dmol) {
      div.innerHTML = '<div class="mol3-err">3Dmol.js 未加载（vendor/3dmol.min.js 缺失）</div>';
      return null;
    }
    if (!viewer) {
      viewer = window.$3Dmol.createViewer(div, { backgroundColor: '#fdfdff' });
      viewer.zoomTo();
    }
    return viewer;
  }

  function setStyle(styleId) {
    viewer.setStyle({}, STYLE_SPEC[styleId] || STYLE_SPEC.stick);
    viewer.zoomTo();
    viewer.render();
  }

  function load(cid, styleId) {
    const v = ensureViewer();
    if (!v || !cid) return;
    currentCid = cid;
    const tip = document.getElementById('mol3-tip');
    tip.textContent = '正在从 PubChem 获取分子结构（需联网）…';
    if (loadTimer) clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
      if (tip.textContent && tip.textContent.includes('PubChem')) {
        tip.textContent = '获取超时或失败：分子结构来自 PubChem 在线数据库，请检查网络后重试';
      }
    }, 9000);
    v.clear();
    window.$3Dmol.download('cid:' + cid, v, { format: 'sdf' }, () => {
      if (loadTimer) clearTimeout(loadTimer);
      tip.textContent = '';
      const m = MOLS.find(x => x.cid === cid);
      document.getElementById('mol3-name').textContent = m ? `${m.name} · ${m.formula} · PubChem CID ${m.cid}` : `PubChem CID ${cid}`;
      setStyle(styleId || document.getElementById('mol3-style').value);
    });
  }

  function build() {
    ready = true;
    const list = document.getElementById('mol3-list');
    list.innerHTML = '';
    MOLS.forEach(m => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pt-cell mol3-item';
      b.title = m.name;
      b.innerHTML = `<span class="pt-sym">${esc(m.formula)}</span><span class="pt-zh">${esc(m.name)}</span>`;
      b.addEventListener('click', () => {
        list.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        load(m.cid, document.getElementById('mol3-style').value);
      });
      list.appendChild(b);
    });
    document.getElementById('mol3-go').addEventListener('click', () => {
      const cid = parseInt(document.getElementById('mol3-cid').value, 10);
      if (cid > 0) {
        list.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
        load(cid, document.getElementById('mol3-style').value);
      }
    });
    document.getElementById('mol3-style').addEventListener('change', () => {
      if (viewer && currentCid) setStyle(document.getElementById('mol3-style').value);
    });
    // 默认加载水
    list.querySelector('.mol3-item').classList.add('sel');
    load(962, 'stick');
  }

  function init() {
    if (ready) return;
    if (!window.$3Dmol) {
      const s = document.createElement('script');
      s.src = 'vendor/3dmol.min.js';
      s.onload = build;
      s.onerror = () => { document.getElementById('mol3-view').innerHTML = '<div class="mol3-err">3Dmol.js 加载失败（vendor/3dmol.min.js 缺失）</div>'; };
      document.head.appendChild(s);
    } else build();
  }

  return { init };
})();
