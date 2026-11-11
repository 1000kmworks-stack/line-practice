// 練習の「見本アニメ」。キャンバスの左上に小さく出て、ペンの動きをくり返し見せる。
// 動画ではなく、ここで書いた座標をプログラムで動かしているだけ。
// 練習ごとの見本は DEMOS に書く(番号 → 見本を返す関数)。12・13番は見本なし。
//
// 見本の形:
//   fixed:   最初から薄く出しておく線(ガイド)    [{ pts: [[x,y], ...] }, ...]
//   dots:    最初から出しておく点                  [[x,y], ...]
//   strokes: 順番に描いていく線                    [{ pts: [[x,y], ...], color: "...", w: 太さ or 関数 }, ...]
// 座標は、見本の枠(横200 × 縦130)の中の位置。

var DEMO_W = 200, DEMO_H = 130;

(function () {
  "use strict";

  // ---------- 点を作る道具 ----------
  // 直線
  function seg(x1, y1, x2, y2, n) {
    n = n || 24;
    var p = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      p.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
    }
    return p;
  }
  // 楕円(rot=傾き(度)、cw=true で時計回り、startDeg=描き始めの角度、turns=何周するか)
  function ell(cx, cy, rx, ry, rotDeg, cw, startDeg, turns, n) {
    n = n || 60;
    var rot = rotDeg * Math.PI / 180, a0 = startDeg * Math.PI / 180, p = [];
    for (var i = 0; i <= n; i++) {
      var a = a0 + (cw ? 1 : -1) * 2 * Math.PI * turns * i / n;
      var x = rx * Math.cos(a), y = ry * Math.sin(a);
      p.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return p;
  }
  // S字カーブ
  function sCurve(cx, cy, len, angleDeg, amp) {
    var a = angleDeg * Math.PI / 180, p = [];
    for (var i = 0; i <= 40; i++) {
      var t = i / 40, u = (t - 0.5) * len, v = amp * Math.sin(2 * Math.PI * t);
      p.push([cx + u * Math.cos(a) - v * Math.sin(a), cy + u * Math.sin(a) + v * Math.cos(a)]);
    }
    return p;
  }
  // 横向きの8の字(∞)を、一筆で
  function figure8(cx, cy, w, h) {
    var p = [];
    for (var i = 0; i <= 100; i++) {
      var t = i / 100 * 2 * Math.PI, d = 1 + Math.sin(t) * Math.sin(t);
      p.push([cx + w * Math.cos(t) / d, cy + h * Math.sin(t) * Math.cos(t) / d]);
    }
    return p;
  }
  // 真ん中(cx,cy)から外へ向かうS字カーブ
  function sRay(cx, cy, len, angleDeg, amp) {
    var a = angleDeg * Math.PI / 180, p = [];
    for (var i = 0; i <= 40; i++) {
      var t = i / 40, u = t * len, v = amp * Math.sin(2 * Math.PI * t);
      p.push([cx + u * Math.cos(a) - v * Math.sin(a), cy + u * Math.sin(a) + v * Math.cos(a)]);
    }
    return p;
  }
  // 太さが「細い→太い→細い」と変わる関数(強弱のある線)
  function taper(max) { return function (t) { return 0.8 + max * Math.sin(Math.PI * t); }; }

  var LIGHT = "rgba(176,137,104,0.6)";
  var RED = "#c0392b";

  // 円と十字線(と、diag が true なら斜め線2本)のガイド
  function circleGuide(diag) {
    var f = [{ pts: ell(100, 65, 48, 48, 0, true, 0, 1, 80) },
             { pts: seg(46, 65, 154, 65, 2) }, { pts: seg(100, 11, 100, 119, 2) }];
    if (diag) {
      f.push({ pts: seg(66, 31, 134, 99, 2) });
      f.push({ pts: seg(134, 31, 66, 99, 2) });
    }
    return f;
  }

  // 向きidx(data.js の DIRECTIONS の順番)に平行な線を5本。強弱をつけるなら taperOn。
  var DIR_VEC = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
  function parallel(idx, taperOn) {
    var v = DIR_VEC[idx], l = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
    var dx = v[0] / l, dy = v[1] / l, nx = -dy, ny = dx;
    var len = Math.abs(dy) > 0.9 ? 80 : (Math.abs(dx) > 0.9 ? 120 : 90);
    var strokes = [];
    for (var i = -2; i <= 2; i++) {
      var ox = 100 + nx * i * 14, oy = 65 + ny * i * 14;
      strokes.push({
        pts: seg(ox - dx * len / 2, oy - dy * len / 2, ox + dx * len / 2, oy + dy * len / 2, 30),
        w: taperOn ? taper(1.2 + (i + 2) * 0.7) : 2
      });
    }
    return { strokes: strokes };
  }

  // 曲線にそって、バネ(ぐるぐる)を描く
  function coil(centerFn, turns, rx, ry) {
    var p = [];
    for (var i = 0; i <= 260; i++) {
      var t = i / 260, c = centerFn(t), th = 2 * Math.PI * turns * t;
      p.push([c[0] + rx * Math.cos(th), c[1] + ry * Math.sin(th)]);
    }
    return p;
  }

  // =========================================================
  // 練習ごとの見本
  // =========================================================
  window.DEMOS = {
    // 1: いろんな向きの線(向きの選択に合わせて変わる)
    1: function (o) { return parallel(o.direction, false); },
    // 2: 同じ線を、強弱をつけて(だんだん太く)
    2: function (o) { return parallel(o.direction, true); },
    // 3: 1つの点から、まわりの点へ放射状に
    3: function () {
      var c = [100, 65], pts = [[30, 22], [170, 28], [34, 108], [172, 100], [96, 12], [118, 120], [22, 62]];   // 点は全部で8個。一直線に並ばない
      return {
        dots: [c].concat(pts),
        strokes: pts.map(function (p) { return { pts: seg(c[0], c[1], p[0], p[1], 20) }; })
      };
    },
    // 5: うずまき。時計回りで小さく、反時計回りで外へ
    5: function () {
      var inward = [], outward = [], i, u;
      for (i = 0; i <= 150; i++) {
        u = i / 150;
        var a = 2 * Math.PI * 3 * u, r = 50 - 42 * u;
        inward.push([100 + r * Math.cos(a), 65 + r * Math.sin(a)]);
      }
      for (i = 0; i <= 150; i++) {
        u = i / 150;
        var b = Math.PI - 2 * Math.PI * 3 * u, q = 8 + 42 * u;
        outward.push([100 + q * Math.cos(b), 65 + q * Math.sin(b)]);
      }
      return { fixed: [{ pts: seg(0, 65, 200, 65, 2) }, { pts: seg(100, 0, 100, 130, 2) }], strokes: [{ pts: inward }, { pts: outward }] };
    },
    // 6: 円の中に、いろんな角度の楕円
    6: function () {
      return {
        fixed: circleGuide(false),
        strokes: [
          { pts: ell(100, 65, 48, 18, 0, true, 0, 1) },
          { pts: ell(100, 65, 48, 18, 60, false, 0, 1) },
          { pts: ell(100, 65, 48, 18, 120, true, 0, 1) }
        ]
      };
    },
    // 7: 真ん中から外へ、花びらの形
    7: function () {
      var s = [];
      for (var k = 0; k < 8; k++) {
        var a = k * 45, r = a * Math.PI / 180;
        s.push({ pts: ell(100 + 24 * Math.cos(r), 65 + 24 * Math.sin(r), 24, 9, a, k % 2 === 0, 180, 1, 40) });
      }
      return { fixed: circleGuide(true), strokes: s };
    },
    // 8: 真ん中にきれいな円。それぞれの線の上に3個ずつ、外にいくほど角度をつけた(平らな)楕円
    8: function () {
      var cx = 100, cy = 65, strokes = [{ pts: ell(cx, cy, 9, 9, 0, true, 0, 1, 40) }];
      var dist = [19, 33, 46], size = [6, 7, 8], k = [0.85, 0.55, 0.25];
      for (var r = 0; r < 8; r++) {
        var phi = r * 45, rad = phi * Math.PI / 180;
        for (var j = 0; j < 3; j++) {
          strokes.push({ pts: ell(cx + dist[j] * Math.cos(rad), cy + dist[j] * Math.sin(rad),
                                  size[j], size[j] * k[j], phi + 90, (r + j) % 2 === 0, 0, 1, 30) });
        }
      }
      return { fixed: circleGuide(true), strokes: strokes, speed: 240, minDur: 0.2, gap: 0.06 };
    },
    // 9: くねくね線を描いて、その線にそってバネを描く
    9: function () {
      function c(t) { return [18 + 164 * t, 65 + 30 * Math.sin(2 * Math.PI * 1.2 * t)]; }
      var line = [];
      for (var i = 0; i <= 80; i++) line.push(c(i / 80));
      return { strokes: [{ pts: line, color: "rgba(61,49,40,0.35)" }, { pts: coil(c, 9, 7, 11) }] };
    },
    // 10: 真ん中から外へ向かうS字カーブ(それぞれの線にそって)
    10: function () {
      var strokes = [];
      for (var k = 0; k < 8; k++) strokes.push({ pts: sRay(100, 65, 48, k * 45, 7) });
      return { fixed: circleGuide(true), strokes: strokes };
    },
    // 11: 横は、S字をつなげて一筆で横向きの8の字。縦は、S字をそのまま
    11: function () {
      return {
        strokes: [
          { pts: figure8(58, 65, 50, 46) },
          { pts: sCurve(142, 65, 96, 90, 14) },
          { pts: sCurve(178, 65, 96, 90, 14) }
        ]
      };
    }
  };

  // =========================================================
  // 見本を動かす部品
  // =========================================================
  var SPEED = 120;     // ペンの速さ(1秒に進む長さ)
  var GAP = 0.18;      // 線と線のあいだの間
  var HOLD = 1.4;      // 描き終わってから、またはじめに戻るまで

  window.DemoPlayer = (function () {
    var cv = null, ctx = null, spec = null, plan = null, raf = 0, t0 = 0;

    function init(canvas) {
      cv = canvas;
      var dpr = window.devicePixelRatio || 1;
      cv.width = Math.round(DEMO_W * dpr); cv.height = Math.round(DEMO_H * dpr);
      ctx = cv.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // 各線の長さと、いつ描きはじめるかを計算しておく
    function prepare(s) {
      var t = 0, speed = s.speed || SPEED, minDur = s.minDur || 0.4, gap = s.gap != null ? s.gap : GAP;
      var items = s.strokes.map(function (st) {
        var cum = [0];
        for (var i = 1; i < st.pts.length; i++) {
          cum.push(cum[i - 1] + Math.hypot(st.pts[i][0] - st.pts[i - 1][0], st.pts[i][1] - st.pts[i - 1][1]));
        }
        var len = cum[cum.length - 1], dur = Math.max(minDur, len / speed);
        var it = { st: st, cum: cum, len: len, start: t, dur: dur };
        t += dur + gap;
        return it;
      });
      return { items: items, total: t + HOLD };
    }

    // 線を、長さ upto のところまで描く。戻り値は先端の位置
    function drawStroke(st, cum, len, upto, color) {
      var tip = st.pts[0];
      ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round";
      for (var i = 1; i < st.pts.length; i++) {
        if (cum[i - 1] >= upto) break;
        var a = st.pts[i - 1], b = st.pts[i], f = 1;
        if (cum[i] > upto) f = (upto - cum[i - 1]) / (cum[i] - cum[i - 1]);
        var ex = a[0] + (b[0] - a[0]) * f, ey = a[1] + (b[1] - a[1]) * f;
        ctx.lineWidth = typeof st.w === "function" ? st.w(cum[i] / len) : (st.w || 2);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(ex, ey); ctx.stroke();
        tip = [ex, ey];
      }
      return tip;
    }

    function draw(el) {
      ctx.clearRect(0, 0, DEMO_W, DEMO_H);
      // 最初から出しておくガイド
      (spec.fixed || []).forEach(function (f) {
        ctx.strokeStyle = LIGHT; ctx.lineWidth = 1.2; ctx.lineCap = "round";
        ctx.beginPath();
        f.pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
        ctx.stroke();
      });
      (spec.dots || []).forEach(function (d) {
        ctx.fillStyle = LIGHT;
        ctx.beginPath(); ctx.arc(d[0], d[1], 3, 0, Math.PI * 2); ctx.fill();
      });
      // 順番に描く線
      var tip = null;
      plan.items.forEach(function (it) {
        var color = it.st.color || "#2b2b2b";
        if (el >= it.start + it.dur) {
          drawStroke(it.st, it.cum, it.len, it.len + 1, color);
        } else if (el >= it.start) {
          var p = (el - it.start) / it.dur;
          p = p * p * (3 - 2 * p);   // はじめと終わりをゆっくりに
          tip = drawStroke(it.st, it.cum, it.len, it.len * p, color);
        }
      });
      if (tip) {   // ペン先
        ctx.fillStyle = "rgba(176,137,104,0.9)";
        ctx.beginPath(); ctx.arc(tip[0], tip[1], 3.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    function frame(now) {
      if (!spec) { raf = 0; return; }
      draw(((now - t0) / 1000) % plan.total);
      raf = requestAnimationFrame(frame);
    }

    // 見本をセットする(null なら止める)
    function set(s) {
      spec = s;
      if (!s) { if (raf) cancelAnimationFrame(raf); raf = 0; return; }
      plan = prepare(s);
      t0 = performance.now();
      if (!raf) raf = requestAnimationFrame(frame);
    }

    return { init: init, set: set };
  })();
})();
