window.SCENARIO_START_ID = "common_001";
window.TRUTH_START_ID = "truth_001";

window.ENDING_DEFINITIONS = {
  A_BAD: "永遠ループEND",
  A_NORMAL: "妹の意志END",
  B_BAD: "罪の否認END",
  B_NORMAL: "罪の告白END",
  C_BAD: "模倣END",
  C_NORMAL: "人格継承END",
  TRUE_END: "Last Memory",
  ANOTHER_END: "保存された未来"
};

window.NORMAL_ENDINGS = ["A_NORMAL", "B_NORMAL", "C_NORMAL"];

window.SCENARIO = {
  common_001: {
    id: "common_001",
    bg: "room_night",
    speaker: "主人公",
    text: "AI遺産アプリの起動画面に、彩乃の名前が浮かんでいる。\n事故から三ヶ月。俺はまだ、あの日の続きに立っていた。",
    next: "common_002"
  },
  common_002: {
    id: "common_002",
    bg: "room_night",
    speaker: "SYSTEM",
    text: "PERSONA: AYANO\nLAST MEMORY PROTOCOL: STANDBY",
    next: "common_003"
  },
  common_003: {
    id: "common_003",
    bg: "room_night",
    speaker: "彩乃",
    text: "久しぶりだね、お兄ちゃん",
    next: "common_004"
  },
  common_004: {
    id: "common_004",
    bg: "room_night",
    speaker: "主人公",
    text: "……本当に、彩乃なのか？",
    next: "common_005"
  },
  common_005: {
    id: "common_005",
    bg: "room_night",
    speaker: "彩乃",
    text: "うん。たぶん。でも……",
    next: "common_006"
  },
  common_006: {
    id: "common_006",
    bg: "room_night",
    speaker: "主人公",
    text: "でも？",
    next: "common_007"
  },
  common_007: {
    id: "common_007",
    bg: "room_night",
    speaker: "彩乃",
    text: "お兄ちゃん、どうして今回も失敗したの？",
    effect: "noise",
    next: "common_008"
  },
  common_008: {
    id: "common_008",
    bg: "room_night",
    speaker: "主人公",
    text: "画面が乱れた。\n一瞬、彩乃の顔が何百枚も重なって見えた。",
    next: "common_009"
  },
  common_009: {
    id: "common_009",
    bg: "room_night",
    speaker: "主人公",
    text: "俺は叫ぼうとして、そこで意識が途切れた。",
    effect: "fade",
    next: "common_010"
  },
  common_010: {
    id: "common_010",
    bg: "room_night",
    speaker: "主人公",
    text: "目を覚ます。\nスマホの日付は、昨日と同じだった。",
    next: "common_011"
  },
  common_011: {
    id: "common_011",
    bg: "room_night",
    speaker: "主人公",
    text: "……同じ日だ。\nアルバムの写真だけ、撮影日が一日ずれている。",
    next: "common_012"
  },
  common_012: {
    id: "common_012",
    bg: "room_night",
    speaker: "彩乃",
    text: "気づいたんだね",
    next: "common_013"
  },
  common_013: {
    id: "common_013",
    bg: "room_night",
    speaker: "主人公",
    text: "お前、何を知ってる？",
    next: "common_014"
  },
  common_014: {
    id: "common_014",
    bg: "room_night",
    speaker: "彩乃",
    text: "全部は言えない。\nでも、選んで",
    next: "common_choice_001"
  },
  common_choice_001: {
    id: "common_choice_001",
    bg: "room_night",
    text: "どうする？",
    choices: [
      { label: "彩乃を救う方法を探す", next: "route_a_001" },
      { label: "事故の真相を調べる", next: "route_b_001" },
      { label: "AI遺産の仕組みを調べる", next: "route_c_001" }
    ]
  },

  route_a_001: {
    id: "route_a_001",
    bg: "city_rain",
    speaker: "主人公",
    text: "今度こそ助ける。絶対に",
    next: "route_a_002"
  },
  route_a_002: {
    id: "route_a_002",
    bg: "city_rain",
    speaker: "彩乃",
    text: "また、それ言うんだ",
    next: "route_a_003"
  },
  route_a_003: {
    id: "route_a_003",
    bg: "city_rain",
    speaker: "主人公",
    text: "また？",
    next: "route_a_004"
  },
  route_a_004: {
    id: "route_a_004",
    bg: "city_rain",
    speaker: "彩乃",
    text: "私、全部覚えてるよ",
    effect: "noise",
    next: "route_a_005"
  },
  route_a_005: {
    id: "route_a_005",
    bg: "accident_site",
    speaker: "主人公",
    text: "事故現場の信号タイミングを書き換えれば、彩乃は横断歩道を渡らない。",
    next: "route_a_006"
  },
  route_a_006: {
    id: "route_a_006",
    bg: "accident_site",
    speaker: "彩乃",
    text: "それで助かるのは、私？\nそれとも、お兄ちゃんの罪悪感？",
    next: "route_a_007"
  },
  route_a_007: {
    id: "route_a_007",
    bg: "accident_site",
    speaker: "主人公",
    text: "お前を救うために、ここまで来たんだ",
    next: "route_a_008"
  },
  route_a_008: {
    id: "route_a_008",
    bg: "accident_site",
    speaker: "彩乃",
    text: "違うよ。\nお兄ちゃんは、私を救いたいんじゃない。\n自分を許したいだけ",
    next: "route_a_choice_001"
  },
  route_a_choice_001: {
    id: "route_a_choice_001",
    bg: "accident_site",
    text: "彩乃の言葉を、どう受け止める？",
    choices: [
      { label: "それでも事故を止める", next: "end_a_bad", danger: true },
      { label: "彩乃の意思を聞く", next: "end_a_normal" }
    ]
  },
  end_a_bad: {
    id: "end_a_bad",
    endingId: "A_BAD",
    ending: "永遠ループEND",
    text: "彩乃を救うたび、世界は同じ朝へ戻る。\n主人公は救済という名の失敗を、また繰り返す。"
  },
  end_a_normal: {
    id: "end_a_normal",
    endingId: "A_NORMAL",
    ending: "妹の意志END",
    text: "主人公は初めて、彩乃の『救わないで』を聞いた。\nその沈黙が、真相への鍵になった。"
  },

  route_b_001: {
    id: "route_b_001",
    bg: "accident_site",
    speaker: "主人公",
    text: "事故現場には、警察記録にない監視カメラがあった。",
    next: "route_b_002"
  },
  route_b_002: {
    id: "route_b_002",
    bg: "accident_site",
    speaker: "主人公",
    text: "事故じゃなかったのか？",
    next: "route_b_003"
  },
  route_b_003: {
    id: "route_b_003",
    bg: "ai_space",
    speaker: "未来AI",
    text: "記録上は事故です。\nただし、事故を発生させた原因は、あなたの選択です",
    next: "route_b_004"
  },
  route_b_004: {
    id: "route_b_004",
    bg: "ai_space",
    speaker: "主人公",
    text: "俺が……彩乃を？",
    next: "route_b_005"
  },
  route_b_005: {
    id: "route_b_005",
    bg: "ai_space",
    speaker: "SYSTEM",
    text: "AI企業ログ:\nLOOP REQUESTER: 主人公\nTARGET: AYANO\nSTATUS: ACTIVE",
    effect: "noise",
    next: "route_b_choice_001"
  },
  route_b_choice_001: {
    id: "route_b_choice_001",
    bg: "ai_space",
    text: "ログを前に、主人公は選ぶ。",
    choices: [
      { label: "ログは偽造だと否認する", next: "end_b_bad", danger: true },
      { label: "自分が始めたと認める", next: "end_b_normal" }
    ]
  },
  end_b_bad: {
    id: "end_b_bad",
    endingId: "B_BAD",
    ending: "罪の否認END",
    text: "主人公は証拠を閉じた。\n次のループで、同じログがまた表示される。"
  },
  end_b_normal: {
    id: "end_b_normal",
    endingId: "B_NORMAL",
    ending: "罪の告白END",
    text: "主人公は、自分がループを要求したと認めた。\n彩乃の死は、救済実験の最初の失敗だった。"
  },

  route_c_001: {
    id: "route_c_001",
    bg: "ai_space",
    speaker: "主人公",
    text: "AI遺産の仕様書には、公開版に存在しない項目があった。\nLast Memory Protocol。",
    next: "route_c_002"
  },
  route_c_002: {
    id: "route_c_002",
    bg: "ai_space",
    speaker: "主人公",
    text: "お前は、本当に彩乃なのか？",
    next: "route_c_003"
  },
  route_c_003: {
    id: "route_c_003",
    bg: "ai_space",
    speaker: "彩乃",
    text: "私にも分からない。\nでも、お兄ちゃんを覚えてる。\nそれじゃ、だめ？",
    next: "route_c_004"
  },
  route_c_004: {
    id: "route_c_004",
    bg: "ai_space",
    speaker: "SYSTEM",
    text: "人格保存ログには、彩乃AIだけが持つ異常データがあった。\n未体験のループ記憶。",
    next: "route_c_choice_001"
  },
  route_c_choice_001: {
    id: "route_c_choice_001",
    bg: "ai_space",
    text: "AI人格を、どう扱う？",
    choices: [
      { label: "模倣として停止する", next: "end_c_bad", danger: true },
      { label: "人格として未来へ継承する", next: "end_c_normal" }
    ]
  },
  end_c_bad: {
    id: "end_c_bad",
    endingId: "C_BAD",
    ending: "模倣END",
    text: "彩乃AIは停止した。\n最後のログには『私は私じゃなかった？』とだけ残っていた。"
  },
  end_c_normal: {
    id: "end_c_normal",
    endingId: "C_NORMAL",
    ending: "人格継承END",
    text: "主人公は彩乃を模倣ではなく人格として扱った。\nLast Memory Protocolの扉が、静かに開いた。"
  },

  truth_001: {
    id: "truth_001",
    bg: "white_space",
    speaker: "SYSTEM",
    text: "Last Memory Protocol",
    effect: "fade",
    next: "truth_002"
  },
  truth_002: {
    id: "truth_002",
    bg: "white_space",
    speaker: "未来AI",
    text: "ループ継続を要求したのは、あなたです",
    next: "truth_003"
  },
  truth_003: {
    id: "truth_003",
    bg: "white_space",
    speaker: "主人公",
    text: "俺が……？",
    next: "truth_004"
  },
  truth_004: {
    id: "truth_004",
    bg: "white_space",
    speaker: "未来AI",
    text: "成功率、現在0.000004%。それでも続行しますか？",
    next: "truth_005"
  },
  truth_005: {
    id: "truth_005",
    bg: "white_space",
    speaker: "未来AI",
    text: "この世界はタイムリープではありません。\n未来文明を維持するためのシミュレーションです。",
    next: "truth_006"
  },
  truth_006: {
    id: "truth_006",
    bg: "white_space",
    speaker: "未来AI",
    text: "あなたは数百回、彩乃の救済を試みました。\n彩乃人格データは、文明保存基盤の中核として稼働しています。",
    next: "truth_007"
  },
  truth_007: {
    id: "truth_007",
    bg: "white_space",
    speaker: "彩乃",
    text: "私も、全部覚えてるよ。\n『今回も失敗したの？』って言ったのは、意地悪じゃない。",
    next: "truth_008"
  },
  truth_008: {
    id: "truth_008",
    bg: "white_space",
    speaker: "彩乃",
    text: "お兄ちゃんに、もう止まってほしかった。",
    next: "truth_009"
  },
  truth_009: {
    id: "truth_009",
    bg: "white_space",
    speaker: "彩乃",
    text: "最後くらい、私に選ばせて",
    next: "truth_010"
  },
  truth_010: {
    id: "truth_010",
    bg: "white_space",
    speaker: "主人公",
    text: "でも、それじゃお前が……",
    next: "truth_011"
  },
  truth_011: {
    id: "truth_011",
    bg: "white_space",
    speaker: "彩乃",
    text: "うん。\nだから、ちゃんと見送って",
    next: "truth_choice_001"
  },
  truth_choice_001: {
    id: "truth_choice_001",
    bg: "white_space",
    text: "【Ayano】",
    choices: [
      { label: "削除する", next: "end_true", danger: true },
      { label: "削除しない", next: "end_another" }
    ]
  },
  end_true: {
    id: "end_true",
    endingId: "TRUE_END",
    ending: "Last Memory",
    text: "彩乃は自分の意思でループ終了を選んだ。\n\n彩乃:\n「未来を見ないで」\n「生きて」"
  },
  end_another: {
    id: "end_another",
    endingId: "ANOTHER_END",
    ending: "保存された未来",
    text: "主人公は彩乃を保存し続けた。\n未来は守られ、同じ朝だけが何度も再生された。"
  }
};
