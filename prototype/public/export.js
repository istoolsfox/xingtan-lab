/**
 * PPTX 导出（杏坛 · 原型）
 * 依赖 pptxgenjs（CDN 全局 PptxGenJS）。交互演示页导出为说明页 + 占位。
 */
async function exportPptx(deck) {
  if (typeof PptxGenJS === 'undefined') {
    toast('导出组件未能加载，请联网后刷新重试', true);
    return;
  }
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  const accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '4F6EF2';
  const dark = '1F2430', gray = '5A6474', soft = 'EEF1FF';

  const typeKicker = { cover: '', objectives: 'LEARNING GOALS', text: 'COURSEWARE', demo: 'INTERACTIVE', summary: 'SUMMARY', homework: 'HOMEWORK' };
  const typeZh = { cover: '封面', objectives: '学习目标', text: '讲解', demo: '互动演示', summary: '小结', homework: '作业' };

  deck.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    // 左侧主题色条
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.12, h: 7.5, fill: { color: accent } });
    const kicker = typeKicker[s.type];
    if (kicker) slide.addText(kicker, { x: 0.7, y: 0.35, fontSize: 11, color: accent, charSpacing: 4, bold: true });

    if (s.type === 'cover') {
      slide.addText(s.title || deck.title, { x: 0.7, y: 2.2, w: 11.5, fontSize: 40, bold: true, color: dark });
      const sub = s.subtitle || [deck.grade, deck.subject, deck.textbook].filter(Boolean).join(' · ');
      if (sub) slide.addText(sub, { x: 0.7, y: 3.6, fontSize: 18, color: gray });
      slide.addText('杏坛教师助手 · AI 生成课件', { x: 0.7, y: 6.7, fontSize: 11, color: gray });
      return;
    }

    slide.addText(s.title || '', { x: 0.7, y: 0.75, w: 11.5, fontSize: 28, bold: true, color: dark });

    if (s.type === 'demo') {
      // 交互演示占位框
      slide.addShape(pptx.ShapeType.roundRect, {
        x: 0.7, y: 1.7, w: 12, h: 4.3, rectRadius: 0.1,
        fill: { color: 'FFFFFF' }, line: { color: accent, width: 1.5, dashType: 'dash' }
      });
      slide.addText([
        { text: (Demos.LABELS[s.demo] || s.demo) + '\n', options: { fontSize: 20, bold: true, color: accent, breakLine: true } },
        { text: '▶ 此页为课堂实时交互演示', options: { fontSize: 13, color: gray, breakLine: true } },
        { text: '请在「杏坛教师助手」演示模式中打开本课件进行操作', options: { fontSize: 11, color: gray } }
      ], { x: 2.2, y: 2.9, w: 9, h: 1.8, align: 'center' });
      if (s.note) slide.addText('演示要点：' + s.note, { x: 0.7, y: 6.2, w: 12, fontSize: 12, color: gray });
    } else if (Array.isArray(s.bullets) && s.bullets.length) {
      const rows = s.bullets.map(b => ({ text: b, options: { fontSize: 17, color: '2A3040', bullet: { characterCode: '25CF', indent: 18 }, lineSpacingMultiple: 1.4, paraSpaceAfter: 10 } }));
      slide.addText(rows, { x: 0.95, y: 1.8, w: 11.5, h: 4.8, valign: 'top' });
    }

    slide.addText(String(i + 1) + ' / ' + deck.slides.length + ' · ' + (typeZh[s.type] || ''), {
      x: 10.9, y: 7.0, fontSize: 10, color: gray, align: 'right'
    });
  });

  const fname = (deck.title || '课件').replace(/[\\/:*?"<>|]/g, '_') + '.pptx';
  const b64 = await pptx.write({ outputType: 'base64' });

  // 主路径：服务端落盘（应用内浏览器/无下载权限环境也可用）
  let savedPath = '';
  try {
    const r = await fetch('/api/save-pptx', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fname, b64 })
    });
    const d = await r.json();
    if (d.ok) savedPath = d.file;
  } catch (e) { /* 忽略，走浏览器下载 */ }

  // 备选：触发浏览器下载（本地 Chrome 等环境）
  try {
    const a = document.createElement('a');
    a.href = 'data:application/vnd.openxmlformats-officedocument.presentationml.presentation;base64,' + b64;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) { /* 忽略 */ }

  toast(savedPath ? '已导出：' + savedPath : '已导出（浏览器下载）：' + fname);
}
