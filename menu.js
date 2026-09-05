(() => {
  "use strict";

  const games = [
    {
      number: "025",
      title: "三重振り子 DUEL",
      genre: "Physics / Action",
      description: "予測しにくい三重振り子を振り回し、固定と解放のタイミングで相手のコアを狙う物理対戦ゲーム。CPU戦と同じ画面での2人対戦に対応しています。",
      href: "./025_pendulum-duel/index.html",
      icon: "./assets/game-icons/025-pendulum-duel.jpg",
      alt: "シアンとオレンジの三重振り子が激突するゲームアイコン"
    },
    {
      number: "024",
      title: "ふたり対戦 ミニゲーム",
      genre: "Local Multiplayer / Mini games",
      description: "スマートフォン1台を左右から操作して、その場ですぐ2人で遊べる対戦ミニゲーム集。第1弾は、連打とタイミングで押し合う「トントン相撲DX」です。",
      href: "./024_two-player-minigames/index.html",
      icon: "./assets/game-icons/024-two-player-minigames.jpg",
      alt: "1台のスマートフォンを左右から操作する2人対戦ミニゲーム集のアイコン"
    },
    {
      number: "023",
      title: "効果音 全部オレゲーム",
      genre: "Sound / Mini games",
      description: "自分で録音した声や音が、そのままゲームの効果音になるミニゲーム集。シューティングやアクションなど、遊ぶたびに自分だけの音が鳴ります。",
      href: "./023_koukaon-ore-game/index.html",
      icon: "./assets/game-icons/023-ore-sound-game.jpg",
      alt: "マイクからゲームの効果音が飛び出すアイコン"
    },
    {
      number: "022",
      title: "コロコロ工作所",
      genre: "Physics / Puzzle",
      description: "坂道、ドミノ、シーソーなどを組み合わせて、ボールをゴールへ運ぶ連鎖装置を作る2D物理パズルです。",
      href: "./022_pythagora-lab/index.html",
      icon: "./assets/game-icons/022-pythagora-lab.jpg",
      alt: "ボールとドミノが連鎖する工作装置のアイコン"
    },
    {
      number: "021",
      title: "BEAT STACK",
      genre: "Rhythm / Puzzle",
      description: "積み上げたブロックが16ステップのビートになる、落ちものパズルと音楽シーケンサーを融合したリズムゲームです。",
      href: "./021_tetris-step-sequencer/index.html",
      icon: "./assets/game-icons/021-beat-stack.jpg",
      alt: "カラフルなブロックと光るビートパッドのアイコン"
    },
    {
      number: "020",
      title: "GPS Detective Chase",
      genre: "GPS / Online",
      description: "犯人と刑事に分かれ、目撃情報を頼りに街で追跡する位置情報ゲーム。周囲の安全を確認し、歩きながら画面を見続けずに遊んでください。",
      href: "./020_gps-detective-chase/index.html",
      icon: "./assets/game-icons/020-gps-detective.jpg",
      alt: "位置ピンと足跡が描かれた地図のアイコン"
    },
    {
      number: "019",
      title: "Bomber Lab",
      genre: "Action",
      description: "ランダム生成される研究施設でエネルギー爆弾を使い、壁を壊しながら出口を探すグリッドアクションです。",
      href: "./019_bomber-lab/index.html",
      icon: "./assets/game-icons/019-bomber-lab.jpg",
      alt: "ブロック迷路で光るエネルギー球のアイコン"
    },
    {
      number: "018",
      title: "スイカ・ドロップ",
      genre: "Physics",
      description: "フルーツを落とし、同じ種類どうしを合体させて大きく育てる物理マージゲーム。積み方を工夫してハイスコアを狙います。",
      href: "./018_suika-style-game/index.html",
      icon: "./assets/game-icons/018-suika-drop.jpg",
      alt: "器の中で丸いフルーツが合体するアイコン"
    },
    {
      number: "017",
      title: "Naval Strike",
      genre: "Strategy",
      description: "10×10の海域へ艦隊を配置し、レーダーを頼りにCPU艦隊の位置を読み切るターン制の海戦ボードゲームです。",
      href: "./017_naval-battle/index.html",
      icon: "./assets/game-icons/017-naval-strike.jpg",
      alt: "グリッドの海とレーダーに映る二隻の船のアイコン"
    },
    {
      number: "016",
      title: "潜入コード: ゼロ",
      genre: "Stealth",
      description: "警備員の視界をかわしながら施設の奥へ進む、スマートフォンでも遊べる見下ろし型ステルスアクションです。",
      href: "./016_stealth-infiltration/index.html",
      icon: "./assets/game-icons/016-stealth-code-zero.jpg",
      alt: "サーチライトを避けて進む潜入者のアイコン"
    },
    {
      number: "015",
      title: "いのちの箱庭",
      genre: "Simulation",
      description: "草、草食動物、肉食動物が世代交代と突然変異を重ねる小さな生態系を、じっくり観察する生命シミュレーターです。",
      href: "./015_inochi-no-hakoniwa/index.html",
      icon: "./assets/game-icons/015-life-garden.jpg",
      alt: "小さな生態系を閉じ込めたガラス箱のアイコン"
    },
    {
      number: "014",
      title: "最強生物トーナメント",
      genre: "Simulation",
      description: "64体の生物が自動で競い、勝者の遺伝子を次世代へつなぐ進化シミュレーション。世代ごとの変化を見守ります。",
      href: "./014_strongest-creature/index.html",
      icon: "./assets/game-icons/014-strongest-creature.jpg",
      alt: "生物のシルエットとDNAとトロフィーのアイコン"
    },
    {
      number: "013",
      title: "Rally Rush",
      genre: "Race",
      description: "ハンドルとターボを使い分け、見下ろし視点のコースを駆け抜けるスピード重視のラリーゲームです。",
      href: "./013_rally-rush/index.html",
      icon: "./assets/game-icons/013-rally-rush.jpg",
      alt: "砂煙を上げてカーブするラリーカーのアイコン"
    },
    {
      number: "012",
      title: "Paint Battle",
      genre: "Action / Online",
      description: "30×30のフィールドを制限時間内に自分の色で塗り広げる陣取りアクション。CPU対戦とオンライン対戦に対応しています。",
      href: "./012_paint-battle/index.html",
      icon: "./assets/game-icons/012-paint-battle.jpg",
      alt: "二色のペイントローラーが陣地を塗るアイコン"
    },
    {
      number: "011",
      title: "スキルオセロ",
      genre: "Board",
      description: "特別なスキルを使いながらCPUと戦う8×8のオセロ。盤面を返すだけではない逆転の駆け引きを楽しめます。",
      href: "./011_skill-othello/index.html",
      icon: "./assets/game-icons/011-skill-othello.jpg",
      alt: "スキルの光をまとって返るオセロ石のアイコン"
    },
    {
      number: "010",
      title: "Retro Plate Baseball",
      genre: "Sports",
      description: "1イニングで勝負する、テンポのよいレトロ野球ゲーム。投球を見極め、狙ったコースへ打ち返します。",
      href: "./010_retro-baseball/index.html",
      icon: "./assets/game-icons/010-retro-baseball.jpg",
      alt: "バットがボールを打ち返す野球のアイコン"
    },
    {
      number: "009",
      title: "Frontier Below",
      genre: "Sandbox",
      description: "地下世界を探索し、素材を採掘して道具や建物を作る2Dサンドボックス。暗い洞窟の奥へ自分の拠点を広げます。",
      href: "./009_block-sandbox/index.html",
      icon: "./assets/game-icons/009-frontier-below.jpg",
      alt: "ランタンを持つ探検家と地下洞窟のアイコン"
    },
    {
      number: "008",
      title: "消える三目並べ",
      genre: "Board",
      description: "古い手から順番に盤面から消えていくCPU対戦の三目並べ。置ける数が限られるため、先を読む力が試されます。",
      href: "./008_disappearing-tictactoe/index.html",
      icon: "./assets/game-icons/008-disappearing-tictactoe.jpg",
      alt: "一つの駒が消えかけている三目並べのアイコン"
    },
    {
      number: "007",
      title: "傾きバランス",
      genre: "Motion",
      description: "スマートフォンを傾けてボールを操作し、障害物を避けながらゴールを目指すバランスゲームです。",
      href: "./007_tilt-ball/index.html",
      icon: "./assets/game-icons/007-tilt-ball.jpg",
      alt: "傾いた台をボールが転がるアイコン"
    },
    {
      number: "006",
      title: "AI遺産",
      genre: "Sound novel",
      description: "残された記憶を文章、背景、音の演出でたどるSFサウンドノベル『Last Memory Protocol』。選択の先で物語が変化します。",
      href: "./006_sound-novel/index.html",
      icon: "./assets/game-icons/006-ai-legacy.jpg",
      alt: "記憶カプセルに浮かぶ光の花のアイコン"
    },
    {
      number: "005",
      title: "Spider Rush",
      genre: "Action",
      description: "ワイヤーを伸ばして地形を飛び移り、勢いを保ったまま進む高速スクロールアクションです。",
      href: "./005_spider-rush/index.html",
      icon: "./assets/game-icons/005-spider-rush.jpg",
      alt: "糸で夜の街をスイングするマスコットのアイコン"
    },
    {
      number: "004",
      title: "Trace Escape",
      genre: "Puzzle",
      description: "走るキャラクターの前に線を描いて橋や足場を作り、穴や障害物を越えてゴールへ導くパズルアクションです。",
      href: "./004_trace-escape/index.html",
      icon: "./assets/game-icons/004-trace-escape.jpg",
      alt: "光る線で描いた橋を走るキャラクターのアイコン"
    },
    {
      number: "003",
      title: "Rune Grid Duel",
      genre: "Battle / Cards",
      description: "盤面へカードを置いてポーカー役を作り、攻撃やスキルへ変換する戦術バトル。相手の配置を読みながらダンジョンを進みます。",
      href: "./003_SwordAndPoker/poker-dungeon/index.html",
      icon: "./assets/game-icons/003-rune-grid-duel.jpg",
      alt: "ルーンカードの盤面と剣と盾のアイコン"
    },
    {
      number: "002",
      title: "ひもパックバトル",
      genre: "Physics / Action",
      description: "紐を引いてパックを弾き、相手へぶつける物理対戦アクション。引く方向と力加減が勝負を左右します。",
      href: "./002_himopack-battle/index.html",
      icon: "./assets/game-icons/002-himopack-battle.jpg",
      alt: "紐で引かれた二つのパックがぶつかるアイコン"
    },
    {
      number: "001",
      title: "五目並べ",
      genre: "Board",
      description: "15×15の盤面へ黒石と白石を交互に置き、縦・横・斜めのいずれかに5個並べる定番ボードゲームです。",
      href: "./001_gomoku/index.html",
      icon: "./assets/game-icons/001-gomoku.jpg",
      alt: "木の盤に黒石と白石が五つ並ぶアイコン"
    }
  ];

  const HOLD_DELAY = 620;
  const MOVE_TOLERANCE = 12;
  const grid = document.querySelector("#games");
  const dialog = document.querySelector("#gameDetails");
  const closeButton = document.querySelector("#detailClose");
  const detailIcon = document.querySelector("#detailIcon");
  const detailGenre = document.querySelector("#detailGenre");
  const detailTitle = document.querySelector("#detailTitle");
  const detailDescription = document.querySelector("#detailDescription");
  const detailPlay = document.querySelector("#detailPlay");

  let holdTimer = 0;
  let activeCard = null;
  let startX = 0;
  let startY = 0;
  let suppressNextClick = false;

  function clearHold() {
    window.clearTimeout(holdTimer);
    holdTimer = 0;
    if (activeCard) activeCard.classList.remove("holding");
    activeCard = null;
  }

  function closeDetails() {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function openDetails(game) {
    detailIcon.src = game.icon;
    detailIcon.alt = game.alt;
    detailGenre.textContent = game.genre;
    detailTitle.textContent = game.title;
    detailDescription.textContent = game.description;
    detailPlay.href = game.href;

    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function bindLongPress(card, game) {
    card.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      clearHold();
      activeCard = card;
      startX = event.clientX;
      startY = event.clientY;
      card.classList.add("holding");

      holdTimer = window.setTimeout(() => {
        suppressNextClick = true;
        card.classList.remove("holding");
        activeCard = null;
        openDetails(game);
        if (navigator.vibrate) navigator.vibrate(22);
      }, HOLD_DELAY);
    });

    card.addEventListener("pointermove", (event) => {
      if (activeCard !== card) return;
      if (Math.hypot(event.clientX - startX, event.clientY - startY) > MOVE_TOLERANCE) {
        clearHold();
      }
    });

    ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
      card.addEventListener(eventName, clearHold);
    });

    card.addEventListener("click", (event) => {
      if (!suppressNextClick) return;
      event.preventDefault();
      suppressNextClick = false;
    });

    card.addEventListener("contextmenu", (event) => {
      if (window.matchMedia("(pointer: coarse)").matches) event.preventDefault();
    });
  }

  games.forEach((game, index) => {
    const item = document.createElement("article");
    item.className = "game-item";

    const card = document.createElement("a");
    card.className = "game-card";
    card.href = game.href;
    card.setAttribute("aria-label", game.title + "を遊ぶ");

    const number = document.createElement("span");
    number.className = "game-number";
    number.textContent = game.number;

    const image = document.createElement("img");
    image.src = game.icon;
    image.alt = game.alt;
    image.width = 384;
    image.height = 384;
    image.decoding = "async";
    image.loading = index < 3 ? "eager" : "lazy";
    if (index === 0) image.fetchPriority = "high";

    const copy = document.createElement("div");
    copy.className = "game-copy";

    const genre = document.createElement("span");
    genre.textContent = game.genre;

    const title = document.createElement("h2");
    title.textContent = game.title;

    const progress = document.createElement("i");
    progress.className = "hold-progress";
    progress.setAttribute("aria-hidden", "true");

    const details = document.createElement("button");
    details.className = "details-button";
    details.type = "button";
    details.textContent = "i";
    details.setAttribute("aria-label", game.title + "の説明を見る");
    details.addEventListener("click", () => openDetails(game));

    copy.append(genre, title);
    card.append(number, image, copy, progress);
    item.append(card, details);
    grid.append(item);
    bindLongPress(card, game);
  });

  closeButton.addEventListener("click", closeDetails);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDetails();
  });
  dialog.addEventListener("close", () => {
    detailIcon.removeAttribute("src");
    suppressNextClick = false;
  });

  window.addEventListener("blur", clearHold);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearHold();
  });
})();
