// 線の練習アプリの本体。
// 開くとすぐ真っ白のキャンバスが出て、練習を1番から順番に進める。
// 記録は「≡ 記録」から見られる。途中で閉じても、続きから再開できる。
(function () {
  "use strict";

  var STORAGE_KEY = "line-practice-v1";
  function $(id) { return document.getElementById(id); }
  function h(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // =========================================================
  // 練習の「ステップ」
  //   2回やる練習(12・13番)は、1回目・2回目を別のステップにして、全部で15ステップにする。
  // =========================================================
  var STAGES = [];
  PRACTICES.forEach(function (p) {
    var n = p.times || 1;
    for (var r = 1; r <= n; r++) STAGES.push({ practice: p, round: r, rounds: n });
  });
  function practiceTimes(p) { return p.times || 1; }

  // =========================================================
  // 保存データ(localStorage)
  //   days:     { "2026-11-11": { done: { "1": 1, "12": 2 } } }   練習した記録
  //   progress: { date, stage }                                     今日どこまで進んだか
  //   drawings: { date, strokes: {ステップ: [...]}, dots: {...} }   今日描いている途中の絵
  // =========================================================
  function dateKey(d) {
    d = d || new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }

  function normalize(d) {
    if (!d || typeof d !== "object") d = {};
    if (!d.days || typeof d.days !== "object") d.days = {};
    if (!d.progress || typeof d.progress !== "object") d.progress = { date: "", stage: 0 };
    if (!d.drawings || typeof d.drawings !== "object") d.drawings = { date: "", strokes: {}, dots: {}, pages: {} };
    if (!d.drawings.strokes) d.drawings.strokes = {};
    if (!d.drawings.dots) d.drawings.dots = {};
    if (!d.drawings.pages) d.drawings.pages = {};
    return d;
  }
  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* 読めなければ空から始める */ }
    return normalize(null);
  }
  var state = loadState();
  var saveWarned = false;
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      if (!saveWarned) { saveWarned = true; toast("保存できなかったよ(ブラウザの設定を確認してね)"); }
      return false;
    }
  }

  // 日付が変わっていたら、1番からやり直しにして、前の日の途中の絵は消す
  var drawingsMem = {};   // ステップ → 線の配列(メモリ上)
  var dotsMem = {};       // ステップ → お手本の値(点の位置・立方体の形)
  function rolloverIfNeeded() {
    var today = dateKey();
    if (state.progress.date === today) return false;
    state.progress = { date: today, stage: 0 };
    state.drawings = { date: today, strokes: {}, dots: {}, pages: {} };
    drawingsMem = {}; dotsMem = {};
    saveState();
    return true;
  }

  // ---------- 練習した記録 ----------
  function doneCount(key, no) {
    var day = state.days[key];
    return (day && day.done && day.done[no]) || 0;
  }
  function dayHasAny(key) {
    var day = state.days[key];
    if (!day || !day.done) return false;
    return Object.keys(day.done).some(function (n) { return day.done[n] > 0; });
  }
  function changeDone(no, delta) {
    var key = dateKey();
    var day = state.days[key] || (state.days[key] = { done: {} });
    if (!day.done) day.done = {};
    var next = Math.max(0, (day.done[no] || 0) + delta);
    if (next === 0) delete day.done[no]; else day.done[no] = next;
    if (!dayHasAny(key)) delete state.days[key];
    saveState();
  }
  function todayTotal() {
    var day = state.days[dateKey()];
    if (!day || !day.done) return 0;
    return Object.keys(day.done).reduce(function (s, n) { return s + day.done[n]; }, 0);
  }
  // 今日(まだなら昨日)から何日続いているか
  function streak() {
    var d = new Date();
    if (!dayHasAny(dateKey(d))) d.setDate(d.getDate() - 1);
    var n = 0;
    while (dayHasAny(dateKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function totalDays() { return Object.keys(state.days).filter(dayHasAny).length; }

  // =========================================================
  // 今のステップ
  // =========================================================
  function stageIndex() { return state.progress.stage; }
  function finished() { return stageIndex() >= STAGES.length; }
  function currentStage() { return finished() ? null : STAGES[stageIndex()]; }
  // 描いた絵をしまっておく名前(練習が全部終わったあとは「自由に描く」用の "free")
  function stageKey() { return finished() ? "free" : String(stageIndex()); }

  // =========================================================
  // お絵かき画面
  // =========================================================
  var current = null;            // 今の練習(終わったあとは null)
  var strokes = [];              // 今のステップの線
  var tool = "pen";
  var color = "#2b2b2b";
  var guideOn = true, gridOn = false;
  var guideData = null;          // お手本のもとになる値(点の位置・立方体の形)
  var direction = 0;

  var stage = $("stage");
  var gc = $("guideCanvas"), dc = $("drawCanvas");
  var gctx = gc.getContext("2d"), dctx = dc.getContext("2d");
  var W = 0, H = 0, dpr = 1;

  function sizeCanvases() {
    var r = stage.getBoundingClientRect();
    var w = Math.floor(r.width), hh = Math.floor(r.height);
    if (!w || !hh) return;
    W = w; H = hh; dpr = window.devicePixelRatio || 1;
    [gc, dc].forEach(function (c) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      c.style.width = W + "px"; c.style.height = H + "px";
    });
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawGuide();
    redrawStrokes();
  }
  if (window.ResizeObserver) new ResizeObserver(sizeCanvases).observe(stage);
  window.addEventListener("resize", sizeCanvases);

  // ---------- お手本・方眼 ----------
  var GUIDE_COLOR = "rgba(176,137,104,0.55)";
  var HORIZON_COLOR = "rgba(140,106,76,0.75)";

  // 点pから、点aとbを通る直線までの距離(ピクセル)
  function distToLine(a, b, p) {
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
    return Math.abs(dx * (p.y - a.y) - dy * (p.x - a.x)) / len;
  }

  // お手本のもとになる値を、ランダムに作る。
  // 位置は画面に対する割合で持つので、画面サイズが変わってもずれない。
  function makeGuideData() {
    var kind = current && current.guide;
    if (kind === "dots") {
      // 点は最大8個。どの3つも一直線に並ばない(点と点をつなぐ線が、ほかの点の上を通らない)ようにする
      var best = [];
      for (var tryNo = 0; tryNo < 40 && best.length < 8; tryNo++) {
        var dots = [], guard = 0;
        var minGap = 80, minLine = 30 - Math.floor(tryNo / 10) * 6;   // うまくいかなければ、少しずつゆるめる
        while (dots.length < 8 && guard++ < 400) {
          var p = { x: 0.08 + Math.random() * 0.84, y: 0.08 + Math.random() * 0.84 };
          var P = { x: p.x * W, y: p.y * H };
          var ok = dots.every(function (q) {
            var dx = (p.x - q.x) * W, dy = (p.y - q.y) * H;
            return dx * dx + dy * dy > minGap * minGap;    // 近すぎる点は避ける
          });
          for (var i = 0; ok && i < dots.length; i++) {
            for (var j = i + 1; ok && j < dots.length; j++) {
              var A = { x: dots[i].x * W, y: dots[i].y * H }, B = { x: dots[j].x * W, y: dots[j].y * H };
              if (distToLine(A, B, P) < minLine || distToLine(P, A, B) < minLine || distToLine(P, B, A) < minLine) ok = false;
            }
          }
          if (ok) dots.push(p);
        }
        if (dots.length > best.length) best = dots;
      }
      return best;
    }
    if (kind === "perspective") {
      // 水平線と、左右の消失点(画面の外)に向かうパースの線。消失点そのものは画面に出さない
      function angles() {
        var out = [], sign = Math.random() < 0.5 ? 1 : -1;
        for (var k = 0; k < 4; k++) {
          out.push(sign * (5 + Math.random() * 25) * Math.PI / 180);
          sign = -sign;   // 水平線の上と下に、交互に出す
        }
        return out;
      }
      return {
        hy: 0.35 + Math.random() * 0.3,        // 水平線の高さ
        vl: -(0.4 + Math.random() * 0.9),      // 左の消失点の横位置(画面はば比。画面の外)
        vr: 1.4 + Math.random() * 0.9,         // 右の消失点の横位置
        left: angles(), right: angles()
      };
    }
    return null;
  }
  function newGuideData() {
    guideData = makeGuideData();
    dotsMem[stageKey()] = guideData;
    scheduleSave();
  }

  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  function drawGuide() {
    if (!W) return;
    gctx.clearRect(0, 0, W, H);

    if (gridOn) {
      gctx.fillStyle = "rgba(176,137,104,0.45)";
      for (var x = 40; x < W; x += 40) {
        for (var y = 40; y < H; y += 40) gctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }
    if (!guideOn || !current || !current.guide) return;

    var cx = W / 2, cy = H / 2, m = Math.min(W, H);
    gctx.strokeStyle = GUIDE_COLOR; gctx.fillStyle = GUIDE_COLOR; gctx.lineWidth = 1.5;

    switch (current.guide) {
      case "dots":
        // 古い形(点が9個以上など)で保存されていたら、作り直す
        if (!Array.isArray(guideData) || guideData.length > 8) newGuideData();
        guideData.forEach(function (p) {
          gctx.beginPath(); gctx.arc(p.x * W, p.y * H, 5, 0, Math.PI * 2); gctx.fill();
        });
        break;
      case "perspective": {
        if (!guideData || !guideData.left) newGuideData();
        var hy = guideData.hy * H, far = Math.max(W, H) * 4;
        gctx.strokeStyle = HORIZON_COLOR;
        line(gctx, 0, hy, W, hy);   // 水平線
        gctx.strokeStyle = GUIDE_COLOR;
        // 消失点(hy の高さ・画面の外)から、画面に向かって線を引く。はみ出した分は自動で切れる
        guideData.left.forEach(function (t) {
          line(gctx, guideData.vl * W, hy, guideData.vl * W + Math.cos(t) * far, hy + Math.sin(t) * far);
        });
        guideData.right.forEach(function (t) {
          line(gctx, guideData.vr * W, hy, guideData.vr * W - Math.cos(t) * far, hy + Math.sin(t) * far);
        });
        break;
      }
      case "cross":
        // 十字線だけ(画面いっぱいに)
        gctx.strokeStyle = HORIZON_COLOR;
        line(gctx, 0, cy, W, cy);
        line(gctx, cx, 0, cx, H);
        break;
      case "circleCross":
      case "circleCross8": {
        // 円と十字線。"circleCross8" は、そこに斜め線を2本足す
        var R = m * 0.42, ext = m * 0.47;
        gctx.beginPath(); gctx.arc(cx, cy, R, 0, Math.PI * 2); gctx.stroke();
        line(gctx, cx - ext, cy, cx + ext, cy);
        line(gctx, cx, cy - ext, cx, cy + ext);
        if (current.guide === "circleCross8") {
          var d = ext * Math.SQRT1_2;
          line(gctx, cx - d, cy - d, cx + d, cy + d);
          line(gctx, cx + d, cy - d, cx - d, cy + d);
        }
        break;
      }
    }
  }

  // ---------- 線を描く ----------
  // 筆圧つきの太さ。ペン以外(マウス・指)は筆圧がないので真ん中の値にする。
  function widthOf(s, p) {
    if (s.erase) return s.size * 4;
    return s.size * (0.25 + 1.5 * p);
  }
  function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  function setStyle(ctx, s, p) {
    ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    ctx.strokeStyle = s.erase ? "#000" : s.color;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = widthOf(s, p);
  }

  // i番目の点までの1区間を描く(なめらかになるよう、点と点の真ん中をつなぐ)
  function segment(ctx, s, i) {
    var pts = s.pts, p = pts[i];
    setStyle(ctx, s, p.p);
    ctx.beginPath();
    if (i === 0) {
      ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.01, p.y);
    } else if (i === 1) {
      var m1 = mid(pts[0], pts[1]);
      ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(m1.x, m1.y);
    } else {
      var a = mid(pts[i - 2], pts[i - 1]), b = mid(pts[i - 1], pts[i]);
      ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, b.x, b.y);
    }
    ctx.stroke();
  }
  // 線の最後(真ん中から終点まで)をつなぐ
  function finishStroke(ctx, s) {
    var pts = s.pts, n = pts.length;
    if (n < 2) return;
    var last = pts[n - 1], a = mid(pts[n - 2], last);
    setStyle(ctx, s, last.p);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(last.x, last.y); ctx.stroke();
  }

  function redrawStrokes() {
    if (!W) return;
    dctx.clearRect(0, 0, W, H);
    strokes.forEach(function (s) {
      for (var i = 0; i < s.pts.length; i++) segment(dctx, s, i);
      finishStroke(dctx, s);
    });
    dctx.globalCompositeOperation = "source-over";
  }

  var active = null;     // 描いている最中の線
  var penSeen = false;   // Apple Pencil を使ったら、指のタッチは無視する(手のひら対策)

  function toPoint(e, prev) {
    var r = dc.getBoundingClientRect();
    // 筆圧が取れるのはApple Pencilだけ。指やマウスは真ん中の値(0.5)にする
    var raw = e.pointerType === "pen" ? (e.pressure || 0.5) : 0.5;
    // 筆圧がガタガタしないよう、前の値とまぜる
    var p = prev ? prev.p * 0.6 + raw * 0.4 : raw;
    return { x: e.clientX - r.left, y: e.clientY - r.top, p: p };
  }

  dc.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "pen") penSeen = true;
    else if (e.pointerType === "touch" && penSeen) return;
    if (!e.isPrimary || active) return;
    e.preventDefault();
    try { dc.setPointerCapture(e.pointerId); } catch (err) { /* なくても描ける */ }
    active = {
      id: e.pointerId, erase: tool === "eraser", color: color,
      size: parseFloat($("size").value), pts: []
    };
    active.pts.push(toPoint(e, null));
    strokes.push(active);
    segment(dctx, active, 0);
  });

  dc.addEventListener("pointermove", function (e) {
    if (!active || e.pointerId !== active.id) return;
    e.preventDefault();
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!evs.length) evs = [e];
    evs.forEach(function (ev) {
      var prev = active.pts[active.pts.length - 1];
      active.pts.push(toPoint(ev, prev));
      segment(dctx, active, active.pts.length - 1);
    });
    dctx.globalCompositeOperation = "source-over";
  });

  function endStroke(e) {
    if (!active || e.pointerId !== active.id) return;
    finishStroke(dctx, active);
    dctx.globalCompositeOperation = "source-over";
    active = null;
    scheduleSave();
  }
  dc.addEventListener("pointerup", endStroke);
  dc.addEventListener("pointercancel", endStroke);
  // iPad の Safari で、長押しのメニューや拡大が出ないようにする
  dc.addEventListener("contextmenu", function (e) { e.preventDefault(); });

  // ---------- 描きかけの絵の保存・再開 ----------
  function packStrokes(arr) {
    return arr.map(function (s) {
      return {
        e: s.erase ? 1 : 0, c: s.color, s: s.size,
        p: s.pts.map(function (q) {
          return [Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10, Math.round(q.p * 100) / 100];
        })
      };
    });
  }
  function unpackStrokes(arr) {
    return (arr || []).map(function (o) {
      return {
        erase: !!o.e, color: o.c, size: o.s,
        pts: o.p.map(function (q) { return { x: q[0], y: q[1], p: q[2] }; })
      };
    });
  }
  // ---------- ページ(13番の1回目のように、白紙を次々に切り替えて描く練習用) ----------
  var usePages = false, pageIdx = 0, pageCount = 1;
  function pageKey(i) { return stageKey() + (i ? "." + i : ""); }   // 0ページ目は、ふつうの練習と同じ名前
  function savePages() {
    if (usePages) state.drawings.pages[stageKey()] = { cur: pageIdx, n: pageCount };
  }
  function renderPageBar() {
    $("pagebar").hidden = !usePages;
    $("pageLabel").textContent = (pageIdx + 1) + " / " + pageCount;
    $("pagePrev").disabled = pageIdx === 0;
    $("pageNext").disabled = pageIdx >= pageCount - 1;
  }
  function showPage(i) {
    if (i < 0 || i >= pageCount) return;
    pageIdx = i;
    strokes = strokesFor(pageKey(i));
    redrawStrokes(); renderPageBar(); savePages(); scheduleSave();
  }
  $("pagePrev").addEventListener("click", function () { showPage(pageIdx - 1); });
  $("pageNext").addEventListener("click", function () { showPage(pageIdx + 1); });
  // 新しいページ: いちばん後ろのページが白紙なら、そこへ移るだけ(白紙のページを増やさない)
  $("pageNew").addEventListener("click", function () {
    var last = pageCount - 1;
    if (strokesFor(pageKey(last)).length > 0) { pageCount++; last = pageCount - 1; }
    showPage(last);
  });

  function strokesFor(key) {
    if (!drawingsMem[key]) drawingsMem[key] = unpackStrokes(state.drawings.strokes[key]);
    return drawingsMem[key];
  }
  function flushDrawings() {
    state.drawings.date = state.progress.date;
    savePages();
    // まだ開いてないステップの保存分は残したまま、開いたステップの分だけ上書きする
    Object.keys(drawingsMem).forEach(function (k) {
      if (drawingsMem[k].length) state.drawings.strokes[k] = packStrokes(drawingsMem[k]);
      else delete state.drawings.strokes[k];
    });
    Object.keys(dotsMem).forEach(function (k) {
      if (dotsMem[k]) state.drawings.dots[k] = dotsMem[k];
    });
    saveState();
  }
  var saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushDrawings, 400);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    flushDrawings();
  }

  // ---------- ツール ----------
  function setTool(t) {
    tool = t;
    $("toolPen").classList.toggle("on", t === "pen");
    $("toolEraser").classList.toggle("on", t === "eraser");
  }
  $("toolPen").addEventListener("click", function () { setTool("pen"); });
  $("toolEraser").addEventListener("click", function () { setTool("eraser"); });
  Array.prototype.forEach.call(document.querySelectorAll(".color"), function (b) {
    b.addEventListener("click", function () {
      color = b.getAttribute("data-color");
      Array.prototype.forEach.call(document.querySelectorAll(".color"), function (o) { o.classList.toggle("on", o === b); });
      setTool("pen");
    });
  });
  $("undo").addEventListener("click", function () { strokes.pop(); redrawStrokes(); scheduleSave(); });
  $("clear").addEventListener("click", function () {
    if (!strokes.length) return;
    if (window.confirm("描いたものを全部消すよ。いい?")) { strokes.length = 0; redrawStrokes(); scheduleSave(); }
  });
  $("guideBtn").addEventListener("click", function () {
    guideOn = !guideOn; this.classList.toggle("on", guideOn); drawGuide();
  });
  $("gridBtn").addEventListener("click", function () {
    gridOn = !gridOn; this.classList.toggle("on", gridOn); drawGuide();
  });
  $("redots").addEventListener("click", function () { newGuideData(); drawGuide(); });

  // ---------- 画像で保存 ----------
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  // 共有シートが使えるiPadでは共有シート、使えなければふつうにダウンロード
  function shareOrDownload(blob, name, type) {
    var file;
    try { file = new File([blob], name, { type: type }); } catch (err) { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch(function () { /* やめた場合は何もしない */ });
    } else {
      downloadBlob(blob, name);
    }
  }
  // 線の配列から、白い背景の画像を作る(消しゴムを正しく効かせるため、線だけ別の紙に描いてから重ねる)
  function canvasFromStrokes(arr) {
    var layer = document.createElement("canvas");
    layer.width = dc.width; layer.height = dc.height;
    var lx = layer.getContext("2d");
    lx.setTransform(dpr, 0, 0, dpr, 0, 0);
    arr.forEach(function (s) {
      for (var i = 0; i < s.pts.length; i++) segment(lx, s, i);
      finishStroke(lx, s);
    });
    var out = document.createElement("canvas");
    out.width = dc.width; out.height = dc.height;
    var o = out.getContext("2d");
    o.fillStyle = "#fff"; o.fillRect(0, 0, out.width, out.height);
    o.drawImage(layer, 0, 0);
    return out;
  }
  function toBlobAsync(c) {
    return new Promise(function (resolve) { c.toBlob(resolve, "image/png"); });
  }

  $("saveImg").addEventListener("click", function () {
    var tag = current ? current.no : "free", date = dateKey();
    if (usePages) {
      // 描いたページを全部、まとめて保存する
      var jobs = [];
      for (var i = 0; i < pageCount; i++) {
        var arr = strokesFor(pageKey(i));
        if (arr.length) jobs.push({ name: "line-practice-" + tag + "-" + date + "-p" + (i + 1) + ".png", c: canvasFromStrokes(arr) });
      }
      if (!jobs.length) { toast("まだ何も描いてないよ"); return; }
      Promise.all(jobs.map(function (j) { return toBlobAsync(j.c); })).then(function (blobs) {
        var files = [];
        try { files = blobs.map(function (b, k) { return new File([b], jobs[k].name, { type: "image/png" }); }); } catch (err) { files = []; }
        if (files.length && navigator.canShare && navigator.canShare({ files: files })) {
          navigator.share({ files: files }).catch(function () {});
        } else {
          blobs.forEach(function (b, k) { downloadBlob(b, jobs[k].name); });
        }
      });
      return;
    }
    var out = document.createElement("canvas");
    out.width = dc.width; out.height = dc.height;
    var o = out.getContext("2d");
    o.fillStyle = "#fff"; o.fillRect(0, 0, out.width, out.height);
    if (guideOn || gridOn) o.drawImage(gc, 0, 0);
    o.drawImage(dc, 0, 0);
    var name = "line-practice-" + tag + "-" + date + ".png";
    out.toBlob(function (blob) {
      if (!blob) { toast("画像にできなかったよ"); return; }
      shareOrDownload(blob, name, "image/png");
    }, "image/png");
  });

  // ---------- タイマー(ストップウォッチ) ----------
  var timerSec = 0, timerId = null;
  function showTimer() {
    var m = Math.floor(timerSec / 60), s = timerSec % 60;
    $("timer").textContent = m + ":" + (s < 10 ? "0" : "") + s;
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
    $("timerBtn").textContent = "▶";
  }
  $("timerBtn").addEventListener("click", function () {
    if (timerId) { stopTimer(); return; }
    $("timerBtn").textContent = "⏸";
    timerId = setInterval(function () { timerSec++; showTimer(); }, 1000);
  });
  $("timer").addEventListener("dblclick", function () { stopTimer(); timerSec = 0; showTimer(); });

  var toastId = null;
  function toast(msg) {
    var t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastId);
    toastId = setTimeout(function () { t.hidden = true; }, 2200);
  }

  // ---------- 向きの選択(1・2番) ----------
  // 向きを変えたら、キャンバスを白紙に戻す(同じ向きをもう一度押したときは何もしない)
  function setDirection(i) {
    if (i === direction) return;
    direction = i;
    strokes.length = 0;
    redrawStrokes();
    scheduleSave();
    renderDirbar();
    updateDemo();
  }
  function renderDirbar() {
    var bar = $("dirbar");
    bar.textContent = "";
    if (!current || !current.directions) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.appendChild(h("span", "small", "いまの向き:"));
    DIRECTIONS.forEach(function (d, i) {
      var b = h("button", "btn" + (i === direction ? " on" : ""), d.arrow + " " + d.label);
      b.type = "button";
      b.addEventListener("click", function () { setDirection(i); });
      bar.appendChild(b);
    });
    var next = h("button", "btn", "次の向きへ");
    next.type = "button";
    next.addEventListener("click", function () { setDirection((direction + 1) % DIRECTIONS.length); });
    bar.appendChild(next);
  }

  // ---------- 見本アニメ ----------
  var demoOn = true;
  function updateDemo() {
    var make = current && DEMOS[current.no];
    $("demoBtn").hidden = !make;
    var show = !!make && demoOn;
    $("demoCanvas").hidden = !show;
    DemoPlayer.set(show ? make({ direction: direction }) : null);
  }
  $("demoBtn").addEventListener("click", function () {
    demoOn = !demoOn; this.classList.toggle("on", demoOn); updateDemo();
  });
  DemoPlayer.init($("demoCanvas"));

  // ---------- 今のステップを画面に出す ----------
  function renderProgress() {
    var bar = $("progress");
    bar.textContent = "";
    for (var i = 0; i < STAGES.length; i++) {
      bar.appendChild(h("span", i < stageIndex() ? "done" : (i === stageIndex() ? "now" : "")));
    }
  }

  // resetView: ステップが変わったときは true(タイマー・向き・お手本の設定を初期化する)
  function enterStage(resetView) {
    var st = currentStage();
    current = st ? st.practice : null;
    usePages = !!(current && current.pages && st.round === 1);
    var pg = state.drawings.pages[stageKey()];
    pageCount = usePages && pg ? Math.max(1, pg.n) : 1;
    pageIdx = usePages && pg ? Math.min(Math.max(0, pg.cur), pageCount - 1) : 0;
    strokes = strokesFor(pageKey(pageIdx));
    renderPageBar();
    guideData = dotsMem[stageKey()] || state.drawings.dots[stageKey()] || null;
    dotsMem[stageKey()] = guideData;

    if (resetView) {
      direction = 0;
      guideOn = true; gridOn = false;
      $("guideBtn").classList.add("on"); $("gridBtn").classList.remove("on");
      timerSec = 0; stopTimer(); showTimer();
      $("pointbox").hidden = true;
    }

    renderProgress();
    var pb = $("pointbox");
    if (current) {
      $("pNo").textContent = current.no + ".";
      $("pTitle").textContent = current.title;
      $("pRound").textContent = st.rounds > 1 ? st.round + "/" + st.rounds + "回目" : "";
      pb.textContent = "ポイント:" + current.point;
      if (current.link) {
        pb.appendChild(document.createTextNode("\n"));
        var a = h("a", null, current.link.label + " ↗");
        a.href = current.link.url; a.target = "_blank"; a.rel = "noopener";
        pb.appendChild(a);
      }
      $("done").textContent = stageIndex() === STAGES.length - 1 ? "できた! おしまい" : "できた! 次へ →";
    } else {
      $("pNo").textContent = "";
      $("pTitle").textContent = "今日の練習はおしまい!自由に描いてもいいよ";
      $("pRound").textContent = "";
      pb.textContent = "おつかれさま。もう1周したいときは、右上のボタンで1番からもう一度できるよ。";
      $("done").textContent = "もう一度1番から";
    }
    $("pointToggle").hidden = false;
    $("prev").disabled = stageIndex() === 0;
    var reroll = current && (current.guide === "dots" || current.guide === "perspective");
    $("redots").hidden = !reroll;
    if (reroll) $("redots").textContent = current.guide === "perspective" ? "パースの線を変える" : "点を打ち直す";
    $("guideBtn").hidden = !(current && current.guide);
    renderDirbar();
    updateDemo();
    sizeCanvases();
    drawGuide();
    redrawStrokes();
  }

  // ---------- できた!(次へ)/ 前へ ----------
  $("done").addEventListener("click", function () {
    flushDrawings();
    if (finished()) {
      state.progress.stage = 0;
      saveState();
      enterStage(true);
      toast("1番からもう一度!");
      return;
    }
    var st = currentStage();
    changeDone(st.practice.no, 1);
    state.progress.stage++;
    saveState();
    toast(finished() ? "全部できた!今日の分は終わり。おつかれさま" : "できた!次は " + currentStage().practice.no + "番");
    enterStage(true);
  });
  $("prev").addEventListener("click", function () {
    if (stageIndex() === 0) return;
    flushDrawings();
    state.progress.stage--;
    // 前に戻るときは、そのステップの「できた」も取り消す
    changeDone(currentStage().practice.no, -1);
    saveState();
    enterStage(true);
  });
  $("pointToggle").addEventListener("click", function () {
    var pb = $("pointbox");
    pb.hidden = !pb.hidden;
    sizeCanvases();
  });

  // =========================================================
  // 記録の画面
  // =========================================================
  function renderMenu() {
    $("streak").textContent = streak();
    $("todayCount").textContent = todayTotal();
    $("totalDays").textContent = totalDays();

    // 最近28日のカレンダー
    var cal = $("cal");
    cal.textContent = "";
    for (var i = 27; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var key = dateKey(d);
      var cell = h("span", (dayHasAny(key) ? "on" : "") + (i === 0 ? " today" : ""));
      cell.title = key;
      cal.appendChild(cell);
    }

    // 今日のメニューの進み具合(見るだけ。順番は1番から決まってる)
    var list = $("list");
    list.textContent = "";
    var now = stageIndex();
    PRACTICE_GROUPS.forEach(function (g) {
      var title = h("div", "group-title", g.name);
      title.appendChild(h("span", "small", g.purpose));
      list.appendChild(title);

      PRACTICES.filter(function (p) { return p.group === g.id; }).forEach(function (p) {
        var first = -1, last = -1;
        STAGES.forEach(function (s, i) { if (s.practice === p) { if (first < 0) first = i; last = i; } });
        var isDone = now > last, isNow = now >= first && now <= last;
        var item = h("div", "item" + (isDone ? " done" : "") + (isNow ? " current" : ""));
        item.appendChild(h("div", "no", String(p.no)));
        var body = h("div", "body");
        body.appendChild(h("div", "en", p.en));
        body.appendChild(h("div", "ttl", p.title));
        item.appendChild(body);
        var label = isDone ? "できた" : (isNow ? "いまここ" : "まだ");
        item.appendChild(h("div", "badge" + (isNow ? " now" : (isDone ? "" : " zero")), label));
        list.appendChild(item);
      });
    });
    $("credit").textContent = PRACTICE_CREDIT;
  }
  function openMenu() { renderMenu(); $("menu").hidden = false; $("menu").scrollTop = 0; }
  function closeMenu() { $("menu").hidden = true; }
  $("menuBtn").addEventListener("click", openMenu);
  $("menuClose").addEventListener("click", closeMenu);

  // ---------- バックアップ(練習した日の記録だけ。絵は入れない) ----------
  $("export").addEventListener("click", function () {
    var blob = new Blob([JSON.stringify({ days: state.days }, null, 2)], { type: "application/json" });
    shareOrDownload(blob, "line-practice-backup-" + dateKey() + ".json", "application/json");
  });
  $("import").addEventListener("click", function () { $("importFile").click(); });
  $("importFile").addEventListener("change", function () {
    var f = this.files && this.files[0];
    this.value = "";
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var d = JSON.parse(reader.result);
        if (!d || typeof d.days !== "object" || !d.days) throw new Error("形式がちがう");
        if (!window.confirm("いまの記録をこのファイルの内容に置きかえるよ。いい?")) return;
        state.days = d.days; saveState(); renderMenu(); toast("読み込んだよ");
      } catch (err) {
        toast("このファイルは読めなかったよ");
      }
    };
    reader.readAsText(f);
  });

  // =========================================================
  // 起動
  // =========================================================
  rolloverIfNeeded();
  enterStage(true);

  // アプリを閉じる・別のアプリに切り替えるときに、描きかけを保存する
  window.addEventListener("pagehide", saveNow);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { saveNow(); return; }
    // 戻ってきたとき、日付が変わっていたら1番からやり直す
    if (rolloverIfNeeded()) { enterStage(true); if (!$("menu").hidden) renderMenu(); }
  });

  // オフラインでも開けるようにする(https か localhost のときだけ)
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(function () { /* 失敗しても普通に使える */ });
  }
})();
