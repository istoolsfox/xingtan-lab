/**
 * 杏坛 · 语文模块（数据驱动，新增内容只需加 JSON 条目）
 * 三个板块：古诗文意境（canvas 场景绘制器）/ 课文脉络图 / 写作框架
 * 意境图：SCENERY 场景元素绘制器注册制——新元素类型加一个绘制函数即可。
 */
const Chinese = (() => {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = s => document.querySelector(s);

  // ---------------- 古诗文库（数据驱动） ----------------
  const POEMS = [
    {
      id: 'jingyesi', title: '静夜思', author: '李白', dynasty: '唐',
      grade: '小学',
      lines: [
        { text: '床前明月光', note: '月光洒在床前' },
        { text: '疑是地上霜', note: '好像地上泛起了一层白霜' },
        { text: '举头望明月', note: '抬起头来望着天上的明月' },
        { text: '低头思故乡', note: '低下头思念起远方的故乡' }
      ],
      translation: '明亮的月光洒在床前的窗户纸上，好像地上泛起了一层白霜。我抬起头来，看那天窗外空中的明月，不由得低下头来，思念起远方的家乡。',
      mood: '意境：秋夜、明月、游子。以月光起兴，用"霜"字营造清冷孤寂的氛围，抬头与低头之间，把思乡之情写得朴素而深挚。',
      scenery: [
        { type: 'night', x: 0, y: 0 }, { type: 'moon', x: 700, y: 90, size: 52 },
        { type: 'star', x: 150, y: 60 }, { type: 'star', x: 320, y: 110 }, { type: 'star', x: 520, y: 50 },
        { type: 'person', x: 380, y: 300, size: 90 }, { type: 'ground', x: 450, y: 400 }
      ]
    },
    {
      id: 'pubu', title: '望庐山瀑布', author: '李白', dynasty: '唐',
      grade: '小学',
      lines: [
        { text: '日照香炉生紫烟', note: '阳光照在香炉峰上，峰顶升起紫色的云烟' },
        { text: '遥看瀑布挂前川', note: '远远望去，瀑布像一条白练悬挂在山前' },
        { text: '飞流直下三千尺', note: '瀑布从高处飞泻而下，仿佛有三千尺' },
        { text: '疑是银河落九天', note: '让人以为是银河从九天之上倾泻下来' }
      ],
      translation: '香炉峰在阳光的照射下生起紫色烟霞，远远望见瀑布似白色绸缎挂在山川间。水流飞泻而下仿佛三千尺，就像是银河从天上垂落到人间。',
      mood: '意境：紫烟、飞瀑、银河。夸张的"三千尺"与浪漫的"银河落九天"，写出庐山瀑布的雄奇壮丽。',
      scenery: [
        { type: 'night', x: 0, y: 0, dawn: true }, { type: 'sun', x: 160, y: 80, size: 44 },
        { type: 'mountain', x: 450, y: 260, size: 200 }, { type: 'waterfall', x: 450, y: 120, size: 1 },
        { type: 'river', x: 450, y: 400 }, { type: 'cloud', x: 250, y: 160 }
      ]
    },
    {
      id: 'chunxiao', title: '春晓', author: '孟浩然', dynasty: '唐',
      grade: '小学',
      lines: [
        { text: '春眠不觉晓', note: '春天的觉睡得香甜，不知不觉天就亮了' },
        { text: '处处闻啼鸟', note: '醒来时到处都能听见鸟儿的啼叫' },
        { text: '夜来风雨声', note: '昨夜隐约听到风声雨声' },
        { text: '花落知多少', note: '不知有多少花儿被风雨打落了' }
      ],
      translation: '春夜酣睡，不知不觉天已破晓，醒来只听见到处是鸟儿的欢鸣。昨夜风雨声声，不知庭里枝头的花被吹落了多少。',
      mood: '意境：春晨、鸟啼、落花。由闻声想象落花，珍惜春光与淡淡的惜春之情自然流露。',
      scenery: [
        { type: 'dawn', x: 0, y: 0 }, { type: 'bird', x: 300, y: 100, size: 22 },
        { type: 'bird', x: 480, y: 70, size: 18 }, { type: 'bird', x: 620, y: 130, size: 20 },
        { type: 'willow', x: 150, y: 320 }, { type: 'flower', x: 600, y: 320 }
      ]
    },
    {
      id: 'dengguanque', title: '登鹳雀楼', author: '王之涣', dynasty: '唐',
      grade: '小学',
      lines: [
        { text: '白日依山尽', note: '夕阳依傍着山峦慢慢沉落' },
        { text: '黄河入海流', note: '黄河向着大海滔滔奔流' },
        { text: '欲穷千里目', note: '想要看到千里之外的风光' },
        { text: '更上一层楼', note: '就要再登上更高的一层楼' }
      ],
      translation: '夕阳依傍着西山慢慢地沉没，滔滔黄河朝着东海汹涌奔流。若想把千里的风光景物看够，那就要登上更高的一层城楼。',
      mood: '意境：落日、远山、奔流。后两句由景入理——站得高才能看得远，是唐人昂扬向上的精神写照。',
      scenery: [
        { type: 'night', x: 0, y: 0, dawn: true }, { type: 'sun', x: 200, y: 170, size: 40, low: true },
        { type: 'mountain', x: 260, y: 300, size: 130 }, { type: 'river', x: 600, y: 380 },
        { type: 'tower', x: 560, y: 280 }, { type: 'bird', x: 420, y: 120, size: 16 }
      ]
    },
    {
      id: 'yonge', title: '咏鹅', author: '骆宾王', dynasty: '唐',
      grade: '小学',
      lines: [
        { text: '鹅，鹅，鹅', note: '白鹅啊，白鹅啊' },
        { text: '曲项向天歌', note: '弯曲着脖颈，朝天鸣叫' },
        { text: '白毛浮绿水', note: '雪白的羽毛浮在碧绿的水面上' },
        { text: '红掌拨清波', note: '红色的脚掌拨动着清清的水波' }
      ],
      translation: '鹅呀，鹅呀，鹅呀，弯曲着长长的脖颈朝天欢叫。雪白的羽毛漂浮在碧绿的水面上，红色的脚掌拨动着清清的水波。',
      mood: '意境：绿水、白鹅、清波。色彩明丽（白毛、绿水、红掌、清波），是孩子眼中生动的世界。',
      scenery: [
        { type: 'day', x: 0, y: 0 }, { type: 'river', x: 450, y: 330 },
        { type: 'swan', x: 430, y: 290, size: 1 }, { type: 'willow', x: 130, y: 300 }
      ]
    },
    {
      id: 'jiangxue', title: '江雪', author: '柳宗元', dynasty: '唐',
      grade: '初中',
      lines: [
        { text: '千山鸟飞绝', note: '所有的山上，飞鸟的身影已经绝迹' },
        { text: '万径人踪灭', note: '所有道路上，都不见人的踪迹' },
        { text: '孤舟蓑笠翁', note: '江面孤舟上，一位披戴着蓑笠的老翁' },
        { text: '独钓寒江雪', note: '独自在漫天大雪中垂钓' }
      ],
      translation: '千山万岭不见飞鸟，千路万径不见行人。一叶孤舟上，披蓑戴笠的老翁，独自在寒冷的江面上冒着风雪垂钓。',
      mood: '意境：大雪、孤舟、寒江。天地空旷寂静，独钓的老翁是诗人孤傲不屈品格的化身。',
      scenery: [
        { type: 'night', x: 0, y: 0, winter: true }, { type: 'snow', x: 450, y: 200, size: 1 },
        { type: 'mountain', x: 180, y: 260, size: 140 }, { type: 'mountain', x: 720, y: 280, size: 120 },
        { type: 'river', x: 450, y: 380 }, { type: 'boat', x: 450, y: 360 }, { type: 'person', x: 470, y: 330, size: 34, fisher: true }
      ]
    },
    {
      id: 'xiaochi', title: '小池', author: '杨万里', dynasty: '宋',
      grade: '小学',
      lines: [
        { text: '泉眼无声惜细流', note: '泉眼悄然无声，是舍不得细细的水流' },
        { text: '树阴照水爱晴柔', note: '树荫倒映水面，喜爱这晴日的柔和' },
        { text: '小荷才露尖尖角', note: '小荷叶刚从水面露出尖尖的角' },
        { text: '早有蜻蜓立上头', note: '早就有一只小蜻蜓立在它的上头' }
      ],
      translation: '泉眼悄然无声，似舍不得涓涓细流；树荫倒映水面，喜爱晴日的温柔。小荷才露出尖尖的角，早有蜻蜓立在上面。',
      mood: '意境：细流、小荷、蜻蜓。细小景物里的生机与情趣，"才露""早有"写尽初夏的灵动。',
      scenery: [
        { type: 'day', x: 0, y: 0 }, { type: 'spring', x: 180, y: 250 },
        { type: 'river', x: 450, y: 360 }, { type: 'lotus', x: 520, y: 300 },
        { type: 'dragonfly', x: 545, y: 240, size: 16 }
      ]
    },
    {
      id: 'minnong', title: '悯农（其二）', author: '李绅', dynasty: '唐',
      grade: '小学',
      lines: [
        { text: '锄禾日当午', note: '农民在正午烈日下锄地' },
        { text: '汗滴禾下土', note: '汗水滴落在禾苗下的泥土里' },
        { text: '谁知盘中餐', note: '有谁知道盘中的饭食' },
        { text: '粒粒皆辛苦', note: '每一粒都饱含着辛苦' }
      ],
      translation: '盛夏中午，烈日炎炎，农民还在劳作，汗珠滴入泥土。有谁想到，我们碗中的米饭，粒粒都饱含农民的血汗？',
      mood: '意境：烈日、农田、汗水。前两句白描劳作之苦，后两句由物及人，是千古传诵的惜粮箴言。',
      scenery: [
        { type: 'day', x: 0, y: 0, hot: true }, { type: 'sun', x: 450, y: 80, size: 54 },
        { type: 'person', x: 400, y: 310, size: 70, farmer: true }, { type: 'field', x: 450, y: 400 }
      ]
    }
  ];

  // ---------------- 意境场景绘制器（注册制） ----------------
  let tGlobal = 0;
  const SCENERY = {
    night(ctx, x, y, s, t, o) { // 天空底色
      const g = ctx.createLinearGradient(0, 0, 0, 460);
      if (o && o.winter) { g.addColorStop(0, '#25304a'); g.addColorStop(1, '#8fa6c4'); }
      else if (o && o.dawn) { g.addColorStop(0, '#3c4a72'); g.addColorStop(0.7, '#c98a6b'); g.addColorStop(1, '#e8b88a'); }
      else { g.addColorStop(0, '#1b2440'); g.addColorStop(1, '#4a5a86'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, 900, 460);
    },
    day(ctx, x, y, s, t, o) {
      const g = ctx.createLinearGradient(0, 0, 0, 460);
      if (o && o.hot) { g.addColorStop(0, '#f0a54a'); g.addColorStop(1, '#f7d9a0'); }
      else { g.addColorStop(0, '#8ec9f0'); g.addColorStop(1, '#d9ecd8'); }
      ctx.fillStyle = g; ctx.fillRect(0, 0, 900, 460);
    },
    dawn(ctx, x, y, s, t, o) { SCENERY.night(ctx, x, y, s, t, { dawn: true }); },
    moon(ctx, x, y, s) {
      ctx.fillStyle = '#f7f0d8'; ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(247,240,216,.25)'; ctx.beginPath(); ctx.arc(x, y, s * 1.35, 0, Math.PI * 2); ctx.fill();
    },
    sun(ctx, x, y, s, t, o) {
      ctx.fillStyle = o && o.low ? '#e88a4a' : '#f7c948';
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(247,201,72,.4)'; ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + t / 3000;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * (s + 6), y + Math.sin(a) * (s + 6));
        ctx.lineTo(x + Math.cos(a) * (s + 16), y + Math.sin(a) * (s + 16)); ctx.stroke();
      }
    },
    star(ctx, x, y, s, t) {
      const tw = 0.5 + 0.5 * Math.sin(t / 500 + x);
      ctx.fillStyle = `rgba(255,255,240,${0.4 + 0.5 * tw})`;
      ctx.beginPath(); ctx.arc(x, y, 2.2 + tw, 0, Math.PI * 2); ctx.fill();
    },
    cloud(ctx, x, y) {
      ctx.fillStyle = 'rgba(190,120,160,.35)';
      [[0, 0, 34], [30, -8, 26], [-28, 4, 24], [56, 6, 20]].forEach(c => {
        ctx.beginPath(); ctx.arc(x + c[0], y + c[1], c[2], 0, Math.PI * 2); ctx.fill();
      });
    },
    mountain(ctx, x, y, s) {
      const g = ctx.createLinearGradient(x, y - s, x, y);
      g.addColorStop(0, '#5a6a8a'); g.addColorStop(1, '#2f3a52');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - s * 1.4, y);
      ctx.quadraticCurveTo(x - s * 0.4, y - s, x, y - s);
      ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.7, x + s * 1.4, y);
      ctx.closePath(); ctx.fill();
    },
    waterfall(ctx, x, y, s, t) {
      const g = ctx.createLinearGradient(x, y, x, y + 250);
      g.addColorStop(0, 'rgba(220,235,250,.95)'); g.addColorStop(1, 'rgba(180,210,240,.5)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 26, y, 52, 250);
      // 流动水纹
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const off = (t / 12 + i * 70) % 250;
        ctx.beginPath(); ctx.moveTo(x - 20 + i * 13, y + off); ctx.lineTo(x - 20 + i * 13, Math.min(y + off + 26, y + 250)); ctx.stroke();
      }
    },
    river(ctx, x, y, s, t) {
      const g = ctx.createLinearGradient(0, y - 10, 0, 460);
      g.addColorStop(0, 'rgba(110,160,210,.55)'); g.addColorStop(1, 'rgba(70,110,170,.75)');
      ctx.fillStyle = g; ctx.fillRect(0, y, 900, 460 - y);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 5; i++) {
        const yy = y + 12 + i * 14, ph = t / 600 + i;
        ctx.beginPath();
        for (let xx = 0; xx <= 900; xx += 30) ctx.lineTo(xx, yy + Math.sin(xx / 90 + ph) * 3);
        ctx.stroke();
      }
    },
    bird(ctx, x, y, s, t) {
      const flap = Math.sin(t / 260 + x) * 5;
      ctx.strokeStyle = '#2f3a52'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - s, y + flap * 0.4); ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.55 - flap, x, y);
      ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.55 - flap, x + s, y + flap * 0.4);
      ctx.stroke();
    },
    swan(ctx, x, y, s, t) { // 白鹅
      const bob = Math.sin(t / 700) * 3;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(x, y + bob, 52, 30, 0, 0, Math.PI * 2); ctx.fill(); // 身体
      ctx.beginPath(); ctx.ellipse(x, y + bob, 44, 18, 0, 0, Math.PI); ctx.fill();     // 尾部水线
      ctx.strokeStyle = '#e8848a'; ctx.lineWidth = 5; ctx.lineCap = 'round';           // 红掌
      ctx.beginPath(); ctx.moveTo(x - 18, y + bob + 26); ctx.lineTo(x - 26, y + bob + 34); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 14, y + bob + 26); ctx.lineTo(x + 8, y + bob + 35); ctx.stroke();
      ctx.fillStyle = '#fff';                                                           // 颈与头
      ctx.beginPath(); ctx.moveTo(x + 34, y + bob - 6);
      ctx.quadraticCurveTo(x + 58, y + bob - 14, x + 56, y + bob - 44);
      ctx.lineTo(x + 44, y + bob - 44); ctx.quadraticCurveTo(x + 44, y + bob - 18, x + 26, y + bob - 4);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 50, y + bob - 50, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e67e22';                                                        // 鹅冠与喙
      ctx.beginPath(); ctx.moveTo(x + 59, y + bob - 52); ctx.lineTo(x + 72, y + bob - 47); ctx.lineTo(x + 59, y + bob - 44); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2f3a52'; ctx.beginPath(); ctx.arc(x + 53, y + bob - 52, 2, 0, Math.PI * 2); ctx.fill();
    },
    boat(ctx, x, y, s, t) {
      ctx.fillStyle = '#5b4632';
      ctx.beginPath(); ctx.moveTo(x - 46, y); ctx.quadraticCurveTo(x, y + 18, x + 46, y); ctx.closePath(); ctx.fill();
    },
    person(ctx, x, y, s, t, o) {
      ctx.fillStyle = o && o.farmer ? '#7a5c3a' : '#3a4258';
      ctx.beginPath(); ctx.arc(x, y - s * 0.78, s * 0.16, 0, Math.PI * 2); ctx.fill();          // 头
      if (o && o.farmer) { ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 3;                       // 斗笠
        ctx.beginPath(); ctx.arc(x, y - s * 0.82, s * 0.24, Math.PI, 0); ctx.stroke(); }
      ctx.beginPath();                                                                            // 身
      ctx.moveTo(x - s * 0.14, y + s * 0.28); ctx.quadraticCurveTo(x - s * 0.1, y - s * 0.5, x, y - s * 0.6);
      ctx.quadraticCurveTo(x + s * 0.1, y - s * 0.5, x + s * 0.14, y + s * 0.28); ctx.closePath(); ctx.fill();
      if (o && o.fisher) { ctx.strokeStyle = '#5b6575'; ctx.lineWidth = 1.5;                      // 钓竿与线
        ctx.beginPath(); ctx.moveTo(x + s * 0.1, y - s * 0.5); ctx.lineTo(x + s * 0.85, y - s * 1.1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + s * 0.85, y - s * 1.1); ctx.lineTo(x + s * 0.85, y + s * 0.55); ctx.stroke(); }
    },
    snow(ctx, x, y, s, t) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 60; i++) {
        const sx = (i * 137.5) % 900, sy = (t / 28 + i * 89) % 460;
        ctx.beginPath(); ctx.arc(sx, sy, 1.6 + (i % 3), 0, Math.PI * 2); ctx.fill();
      }
    },
    willow(ctx, x, y, s, t) {
      ctx.strokeStyle = '#6b5a3e'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y + 110); ctx.quadraticCurveTo(x - 6, y + 20, x, y - 30); ctx.stroke();
      ctx.lineWidth = 2;
      for (let i = -4; i <= 4; i++) {
        ctx.strokeStyle = '#7aa860';
        ctx.beginPath(); ctx.moveTo(x, y - 30);
        ctx.quadraticCurveTo(x + i * 14, y + 20, x + i * 18 + Math.sin(t / 800 + i) * 5, y + 92);
        ctx.stroke();
      }
    },
    flower(ctx, x, y) {
      ctx.fillStyle = '#e8848a';
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 8, y - 40 + Math.sin(a) * 8, 7, 4.5, a, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#f7c948'; ctx.beginPath(); ctx.arc(x, y - 40, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6b8a4e'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(x, y - 32); ctx.lineTo(x, y + 60); ctx.stroke();
    },
    tower(ctx, x, y) {
      ctx.fillStyle = '#5b4632';
      for (let i = 0; i < 3; i++) {
        const w = 70 - i * 16, yy = y - i * 42;
        ctx.fillRect(x - w / 2, yy - 30, w, 30);
        ctx.beginPath(); ctx.moveTo(x - w / 2 - 10, yy - 30); ctx.lineTo(x, yy - 48); ctx.lineTo(x + w / 2 + 10, yy - 30); ctx.closePath(); ctx.fill();
      }
    },
    lotus(ctx, x, y, s, t) {
      ctx.strokeStyle = '#5e9c5e'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, y + 70); ctx.quadraticCurveTo(x + 4, y + 20, x, y - 8); ctx.stroke();
      ctx.fillStyle = '#f0a8b8';
      ctx.beginPath(); ctx.moveTo(x, y - 10);
      ctx.quadraticCurveTo(x - 16, y - 22, x - 8, y - 34); ctx.quadraticCurveTo(x, y - 42, x + 8, y - 34);
      ctx.quadraticCurveTo(x + 16, y - 22, x, y - 10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7aa860';
      ctx.beginPath(); ctx.ellipse(x - 22, y + 26, 18, 6, -0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 20, y + 38, 16, 5, 0.4, 0, Math.PI * 2); ctx.fill();
    },
    dragonfly(ctx, x, y, s, t) {
      const hov = Math.sin(t / 350) * 4;
      ctx.fillStyle = '#e05656';
      ctx.beginPath(); ctx.ellipse(x + s, y + hov, s * 1.2, s * 0.34, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(224,86,86,.65)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x - s * 0.4, y + hov - 3, s * 1.5, s * 0.4, -0.25, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(x - s * 0.4, y + hov + 3, s * 1.5, s * 0.4, 0.25, 0, Math.PI * 2); ctx.stroke();
    },
    field(ctx, x, y) {
      ctx.fillStyle = 'rgba(122,168,96,.85)'; ctx.fillRect(0, y, 900, 460 - y);
      ctx.strokeStyle = 'rgba(90,130,70,.9)'; ctx.lineWidth = 2.5;
      for (let i = 0; i < 16; i++) {
        const fx = 60 + i * 55;
        ctx.beginPath(); ctx.moveTo(fx, y + 30); ctx.lineTo(fx + 4, y - 16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(fx - 8, y + 34); ctx.lineTo(fx - 2, y + 2); ctx.stroke();
      }
    },
    spring(ctx, x, y) {
      ctx.fillStyle = '#7aa860';
      ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(140,190,230,.9)';
      ctx.beginPath(); ctx.ellipse(x, y + 26, 30, 9, 0, 0, Math.PI * 2); ctx.fill();
    },
    ground(ctx, x, y) {
      const g = ctx.createLinearGradient(0, y - 20, 0, 460);
      g.addColorStop(0, 'rgba(200,208,225,.55)'); g.addColorStop(1, 'rgba(160,170,195,.75)');
      ctx.fillStyle = g; ctx.fillRect(0, y - 10, 900, 470 - y);
    }
  };

  // ---------------- 课文脉络（数据驱动） ----------------
  const OUTLINES = [
    {
      id: 'beijing', title: '《背影》', author: '朱自清', grade: '八年级上册',
      idea: '以"背影"为线索，四次背影、四次泪水，写父爱深沉与"我"的愧疚懂得。',
      root: '背影（线索）',
      nodes: [
        { text: '开篇点题', tip: '思念父亲，最难忘他的背影', children: ['落笔点题 · 设置悬念'] },
        { text: '叙事回忆', tip: '回家奔丧 · 车站送别', children: ['祸不单行 · 惨淡家景', '嘱咐茶房 · 嘱托路上', '攀爬月台 · 买橘背影'] },
        { text: '别后思念', tip: '读信忆背影，泪光中再现背影', children: ['老境颓唐 · 牵挂惦念'] },
        { text: '卒章显志', tip: '"唉！我不知何时再能与他相见"', children: ['愧疚眷念 · 情感升华'] }
      ]
    },
    {
      id: 'jncd', title: '《济南的冬天》', author: '老舍', grade: '七年级上册',
      idea: '以"温晴"为文眼，从山、雪、水三个层面描绘济南冬天的山清水秀。',
      root: '济南的冬天（温晴）',
      nodes: [
        { text: '对比开篇', tip: '北平风 · 伦敦雾 · 热带毒日', children: ['突出"温晴"这一文眼'] },
        { text: '阳光下的老城', tip: '小山把济南围成摇篮', children: ['山景一：暖和安适'] },
        { text: '薄雪后的山', tip: '顶上髻儿白 · 山尖全白 · 水色蓝汪汪', children: ['山景二：妙趣秀美'] },
        { text: '城外远山', tip: '一道银边', children: ['山景三：淡雅如画'] },
        { text: '水与收束', tip: '水藻真绿 · 越晴越绿', children: ['水景：澄清空灵', '这就是冬天的济南'] }
      ]
    },
    {
      id: 'chun', title: '《春》', author: '朱自清', grade: '七年级上册',
      idea: '盼春—绘春—赞春，五幅春图展现生机，结尾三喻升华。',
      root: '春',
      nodes: [
        { text: '盼春', tip: '"盼望着，盼望着"——叠用见急切', children: ['总领全文 · 奠定基调'] },
        { text: '绘春（五图）', tip: '工笔细描，万物复苏', children: ['春草图：钻 · 偷 · 闹', '春花图：繁花争春', '春风图：触嗅听觉', '春雨图：细密斜织', '迎春图：人人迎春'] },
        { text: '赞春', tip: '三个比喻：娃娃 · 小姑娘 · 青年', children: ['新 · 美 · 力，层层递进'] }
      ]
    },
    {
      id: 'taohuayuan', title: '《桃花源记》', author: '陶渊明', grade: '八年级下册',
      idea: '以渔人行踪为线索：发现—进入—做客—离开—再寻，虚实相生寄托理想。',
      root: '桃花源记（渔人行踪）',
      nodes: [
        { text: '发现桃花源', tip: '缘溪行 · 忘路远近 · 忽逢桃林', children: ['芳草鲜美 · 落英缤纷'] },
        { text: '进入桃花源', tip: '初极狭 · 豁然开朗', children: ['土地平旷 · 黄发垂髫怡然'] },
        { text: '做客桃花源', tip: '设酒杀鸡 · 各复延家', children: ['避秦时乱 · 不知有汉'] },
        { text: '离开与再寻', tip: '处处志之 · 遂迷不复得路', children: ['虚实相生 · 理想难寻'] }
      ]
    }
  ];

  // ---------------- 写作框架（数据驱动） ----------------
  const WRITINGS = [
    {
      id: 'jixuwen', name: '记叙文', grade: '全学段',
      tip: '六要素：时间、地点、人物、起因、经过、结果；以细节动人。',
      blocks: [
        { title: '① 开头（凤头）', tips: ['开门见山 / 环境描写 / 悬念设问', '三两行内入题，忌绕远'] },
        { title: '② 发展（猪肚）', tips: ['一件核心事件，一波三折', '抓住动作·语言·神态·心理细节', '详略得当：高潮处慢镜头'] },
        { title: '③ 高潮', tips: ['情感最浓处放慢节奏', '让细节自己说话，少喊口号'] },
        { title: '④ 结尾（豹尾）', tips: ['点题升华 / 首尾呼应', '短促有力，余味悠长'] }
      ]
    },
    {
      id: 'yilunwen', name: '议论文', grade: '初中 → 高中',
      tip: '三要素：论点、论据、论证。观点鲜明，以理服人。',
      blocks: [
        { title: '① 引论（提出论点）', tips: ['材料/现象切入 → 亮明中心论点', '一句话可反复锤炼'] },
        { title: '② 本论（分析论证）', tips: ['分论点 2~3 个，层层递进', '论据：事例 + 名言 + 数据', '每段：观点句 → 阐释 → 论据 → 回扣'] },
        { title: '③ 辩证/让步', tips: ['承认对立面，再驳倒它，思辨加分'] },
        { title: '④ 结论（重申论点）', tips: ['呼应开头 + 发出号召', '避免新论点突袭'] }
      ]
    },
    {
      id: 'shuomingwen', name: '说明文', grade: '初中',
      tip: '抓住事物特征，用对说明方法与说明顺序。',
      blocks: [
        { title: '① 引出说明对象', tips: ['从生活现象 / 谜题切入', '点明对象与特征'] },
        { title: '② 分说特征', tips: ['空间 / 时间 / 逻辑顺序', '说明方法：列数字 · 打比方 · 作比较 · 举例子 · 分类别'] },
        { title: '③ 说明语言', tips: ['准确为先："大约、左右、之一"不可少', '生动说明可拟人化'] },
        { title: '④ 结尾', tips: ['总结特征 / 展望应用'] }
      ]
    },
    {
      id: 'duhougan', name: '读后感', grade: '全学段',
      tip: '以"感"为主，"读"为引——引议联结四步走。',
      blocks: [
        { title: '① 引（引材料）', tips: ['简要概括原作最触动你的点', '篇幅不超过全文两成'] },
        { title: '② 议（亮观点）', tips: ['一句"感点"作中心论点'] },
        { title: '③ 联（联系实际）', tips: ['联系生活 / 历史 / 自身经历', '这是全文重心'] },
        { title: '④ 结（收束点题）', tips: ['回扣感点 + 行动宣言'] }
      ]
    }
  ];

  // ---------------- 状态与渲染 ----------------
  let tab = 'poem';        // poem | outline | writing
  let poemId = POEMS[0].id;
  let canvas = null, ctx = null, raf = null;

  function renderPoemList() {
    const box = $('#cn-poem-list');
    box.innerHTML = '';
    POEMS.forEach(p => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'template-item' + (p.id === poemId ? ' active' : '');
      b.innerHTML = `<div class="t">${esc(p.title)}</div><div class="d">${esc(p.author)} · ${esc(p.dynasty)} · ${esc(p.grade)}</div>`;
      b.addEventListener('click', () => { poemId = p.id; renderPoemList(); renderPoem(); });
      box.appendChild(b);
    });
  }

  function renderPoem() {
    const p = POEMS.find(x => x.id === poemId) || POEMS[0];
    $('#cn-poem-head').innerHTML = `<b>${esc(p.title)}</b>　<span class="muted">${esc(p.author)} · ${esc(p.dynasty)} · ${esc(p.grade)}</span>`;
    $('#cn-poem-body').innerHTML =
      `<div class="cn-lines">${p.lines.map((l, i) =>
        `<div class="cn-line" data-i="${i}"><span class="txt">${esc(l.text)}</span><span class="note">${esc(l.note)}</span></div>`).join('')}</div>` +
      `<div class="cn-sec"><b>译文</b><br>${esc(p.translation)}</div>` +
      `<div class="cn-sec"><b>${esc(p.mood.split('：')[0])}</b><br>${esc(p.mood.split('：').slice(1).join('：'))}</div>`;
    // 意境 canvas
    canvas = $('#cn-scene');
    ctx = canvas.getContext('2d');
    if (raf) cancelAnimationFrame(raf);
    const draw = t => {
      tGlobal = t;
      if (p.id !== poemId || tab !== 'poem') return;   // 离开即停
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 先画底色类元素（night/day/dawn），再画其余
      p.scenery.forEach(s => {
        const fn = SCENERY[s.type];
        if (fn) fn(ctx, s.x, s.y, s.size || 1, t, s);
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
  }

  function showOutline(id) {
    const o = OUTLINES.find(x => x.id === id) || OUTLINES[0];
    $('#cn-outline-head').innerHTML = `<b>${esc(o.title)}</b>　<span class="muted">${esc(o.author)} · ${esc(o.grade)}</span>`;
    $('#cn-outline-body').innerHTML =
      `<div class="cn-idea">${esc(o.idea)}</div>` +
      `<div class="ol-tree"><div class="ol-root">${esc(o.root)}</div>` +
      o.nodes.map(n =>
        `<div class="ol-branch"><div class="ol-node">${esc(n.text)}<div class="ol-tip">${esc(n.tip)}</div></div>` +
        `<div class="ol-children">${(n.children || []).map(c => `<div class="ol-leaf">${esc(c)}</div>`).join('')}</div></div>`
      ).join('') + '</div>';
  }

  function renderOutlineList() {
    const box = $('#cn-outline-list');
    box.innerHTML = '';
    OUTLINES.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'template-item' + (o.id === OUTLINES[0].id ? ' active' : '');
      b.innerHTML = `<div class="t">${esc(o.title)}</div><div class="d">${esc(o.author)} · ${esc(o.grade)}</div>`;
      b.addEventListener('click', () => {
        box.querySelectorAll('.active').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        showOutline(o.id);
      });
      box.appendChild(b);
    });
    showOutline(OUTLINES[0].id);
  }

  function renderWriting() {
    const box = $('#cn-writing-list');
    box.innerHTML = '';
    WRITINGS.forEach(w => {
      const card = document.createElement('div');
      card.className = 'wr-card';
      card.innerHTML = `<div class="wr-name">${esc(w.name)} <span class="muted">${esc(w.grade)}</span></div>` +
        `<div class="wr-tip">${esc(w.tip)}</div>` +
        `<div class="wr-flow">${w.blocks.map(b =>
          `<div class="wr-block"><div class="wr-bt">${esc(b.title)}</div><ul>${b.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`
        ).join('<div class="wr-arrow">↓</div>')}</div>`;
      box.appendChild(card);
    });
  }

  function setTab(t) {
    tab = t;
    $$('#page-chinese .cn-tab').forEach(b => b.classList.toggle('active', b.dataset.cnTab === t));
    ['poem', 'outline', 'writing'].forEach(name => {
      const pane = $('#cn-pane-' + name);
      if (pane) pane.classList.toggle('hidden', name !== t);
    });
    if (t === 'poem') renderPoem();
    if (raf) cancelAnimationFrame(raf);
  }

  function init() {
    renderPoemList();
    renderPoem();
    renderOutlineList();
    renderWriting();
    $$('#page-chinese .cn-tab').forEach(b => {
      b.addEventListener('click', () => setTab(b.dataset.cnTab));
    });
  }

  function state() {
    return { kind: 'chinese', tab, poem: poemId };
  }

  function applyScene(s) {
    init();
    if (s.tab) setTab(s.tab);
    if (s.poem && POEMS.some(p => p.id === s.poem)) {
      poemId = s.poem;
      renderPoemList();
      renderPoem();
    }
  }

  return { init, state, applyScene };
})();
