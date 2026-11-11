// 線の練習メニューのデータ。
// 練習を増やしたり文言を直したりするときは、このファイルだけ直せばいい。
// app.js はここで定義したグローバル変数を読むだけ。

// 練習のグループ(見出し)
var PRACTICE_GROUPS = [
  { id: "straight",    name: "まっすぐな線",   purpose: "思いどおりに線を引けるようになる" },
  { id: "perspective", name: "パース",         purpose: "立体的にものを描けるようになる" },
  { id: "circle",      name: "円",             purpose: "思いどおりに線を引けるようになる(きれいな円はむずかしい)" },
  { id: "curve",       name: "曲線",           purpose: "思いどおりに線を引くため" },
  { id: "solid",       name: "立体の総まとめ", purpose: "ここまでの練習のまとめ" },
  { id: "figure",      name: "人のスケッチ",   purpose: "体のつくりを理解するため" }
];

// 1・2番で使う8つの向き
var DIRECTIONS = [
  { id: "h-left",  label: "横(左へ)",     arrow: "←" },
  { id: "h-right", label: "横(右へ)",     arrow: "→" },
  { id: "v-up",    label: "たて(上へ)",   arrow: "↑" },
  { id: "v-down",  label: "たて(下へ)",   arrow: "↓" },
  { id: "tl",      label: "ななめ左上へ", arrow: "↖" },
  { id: "tr",      label: "ななめ右上へ", arrow: "↗" },
  { id: "bl",      label: "ななめ左下へ", arrow: "↙" },
  { id: "br",      label: "ななめ右下へ", arrow: "↘" }
];

// 練習メニュー本体
//   no: 番号 / group: グループid / en: 英語の説明 / title: 見出し / point: ポイント
//   times: 1日にやる回数(省略すると1回)
//   pages: true なら、1回目は「新しいページ」で白紙を次々に切り替えて描ける
//   directions: true なら向きの選択ボタンを出す
//   guide: 画面に薄く出すお手本の種類
//     dots(点・毎回ランダム) / perspective(水平線+消失点2つ+そこへ向かう線・毎回ランダム) / cross(十字線だけ)
//     circleCross(円と十字線) / circleCross8(円と十字線+斜め線2本)
//   link: 外部サイトへのリンク { url, label }
var PRACTICES = [
  {
    no: 1, group: "straight", directions: true,
    en: "Practice straight lines at different angles",
    title: "いろんな向きのまっすぐな線を引く",
    point: "線を引く向きによって、引きやすさがちがう。苦手な向きを見つけて、そこを多めに練習するといいよ。"
  },
  {
    no: 2, group: "straight", directions: true,
    en: "Repeat straight line practice, adding gradual changes in thickness",
    title: "1と同じ線を、太さを少しずつ変えながら引く",
    point: "筆圧で太さを変える練習。入りと抜き(線の始まりと終わり)が細くなる「強弱のある線」が引けると、絵がいきいきするよ。"
  },
  {
    no: 3, group: "straight", guide: "dots",
    en: "Plot dots on the screen and connect them with straight lines",
    title: "画面に点を打って、点と点をまっすぐな線でつなぐ",
    point: "1つの点から、周りに打った点へ向かって放射状に線を引く。始めの点を変えて、何回もくり返す。「ここからここまで」とねらった場所に線を引く練習なので、点からはみ出さず、ぴったり止められるようにする。"
  },
  {
    no: 4, group: "perspective", guide: "perspective",
    en: "Perspective block practice: Draw a block and then plot dots to find the center line",
    title: "奥行きのある箱を描いて、点を打って真ん中の線を見つける",
    point: "水平線の上の2つの点が消失点(2点透視)。うすい線は全部、どちらかの消失点に向かっている。この線にそって、奥にいくほど小さくなる箱を描く。縦の線はまっすぐ立てる。面の真ん中は、角から角へ×を引くと見つかるよ(奥行きがあると、見た目の真ん中とずれる)。"
  },
  {
    no: 5, group: "circle", guide: "cross",
    en: "Draw circles clockwise and counterclockwise, slowly rotating to the center and then back",
    title: "時計回り・反時計回りで円を描く。少しずつ真ん中へ小さくして、また外へ戻る",
    point: "うずまきのように描く。手首だけでなく、ひじや肩から動かすと大きい円がきれいになるよ。"
  },
  {
    no: 6, group: "circle", guide: "circleCross",
    en: "Practice complete ellipses at different angles inside a perfect circle clockwise and counterclockwise",
    title: "きれいな円の中に、いろんな角度の楕円(つぶれた円)を描く",
    point: "時計回りと反時計回りの両方で。楕円の端が円にふれるように描くと、形がそろいやすい。"
  },
  {
    no: 7, group: "circle", guide: "circleCross8",
    en: "Draw petal-shaped ellipses from the center to the edge clockwise and counterclockwise",
    title: "真ん中から外へ、花びらの形の楕円を描く",
    point: "真ん中の1点から花びらを放射状に並べる。時計回りと反時計回りの両方で。"
  },
  {
    no: 8, group: "circle", guide: "circleCross8",
    en: "Perspective ellipse practice (circle shape in all angles)",
    title: "奥行きのある楕円の練習(いろんな角度から見た円)",
    point: "コップのふちやタイヤのように、ななめから見た円を描く練習。真ん中にきれいな円を描いたら、それぞれの線の上に3個くらい、外にいくほど角度をつけて(平らにして)描く。ガイドの円のあたりは、ほぼ横向きの平らな円になるよ。"
  },
  {
    no: 9, group: "curve",
    en: "Draw a curve with many bends and then draw a spring following the curve",
    title: "くねくね曲がる線を描いて、その線にそってバネ(ぐるぐる)を描く",
    point: "髪の毛やリボン、ホースのような「曲がった筒」を描く土台になる練習。"
  },
  {
    no: 10, group: "curve", guide: "circleCross8",
    en: "Repeat a curved spring shape similar to a skirt hem",
    title: "スカートのすそみたいな、波うったバネの形をくり返し描く",
    point: "服のひだやフリルを描くときに役立つよ。アプリでは、真ん中から外に向かって、それぞれの線にそってS字カーブを描いていくよ。"
  },
  {
    no: 11, group: "curve",
    en: "Arc practice (S-curve, S-curve at multiple angles)",
    title: "弧(カーブ)の練習。S字カーブを、いろんな角度で描く",
    point: "人の背中や手足のラインはS字が多い。なめらかに一気に引けるようにする。縦と横の両方で。横は、S字をつなげて一筆で横向きの8の字を描く。縦は、8の字にせずS字をそのまま描く。"
  },
  {
    no: 12, group: "solid",
    en: "Geometric shape + contour line practice x2",
    title: "図形+ふちの線(輪郭)の練習(1ページに2つ描く)",
    point: "円柱や直方体から、立体的で複雑な物を描く練習。円・楕円と箱の練習を組み合わせて、機械の部品や歯車、ゲーム機やテレビのような身近な物を描く。1ページの中に、2つ描く。"
  },
  {
    no: 13, group: "figure", times: 2, pages: true,
    en: "Full-body sketch x2 (line-of-action.com class mode 1hr)",
    title: "全身のスケッチ ×2回(line-of-action.com のクラスモード・1時間)",
    point: "line-of-action.com は、人のポーズの写真が時間を決めて次々に出てくるサイト。クラスモードは、短いスケッチから少しずつ長くなっていく1時間のコース。\n1回目:クラスモードを1時間。短いアタリだけのスケッチから始まって、だんだん1枚の時間が長くなる。\n2回目:1回目に描いた中から気に入った構図を1つ選んで、色を塗るところまで仕上げる。",
    link: { url: "https://line-of-action.com/", label: "line-of-action.com を開く" }
  }
];

// 出どころ(画面の下に出す)
var PRACTICE_CREDIT = "練習メニュー:Carter Nanmen(@carternanmen)さんのポストより / 解説:松(A・TYPEcorp.)(@atype55)さんのポストを参考";
