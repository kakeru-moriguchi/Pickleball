export type CommunityPost = {
  id: string;
  type: "practice" | "member" | "event";
  author_id: string;
  title: string;
  held_on: string;
  start_time: string;
  end_time: string;
  venue: string;
  prefecture: string;
  capacity: number;
  fee: number;
  level: string;
  category: string;
  description: string;
  organizer: string;
  status: "open" | "closed";
  participant_count: number;
  secondary_title: string;
  deadline: string;
  application_method: string;
  viewer_joined: number;
  created_at: string;
  is_demo?: boolean;
};

// UI確認専用。Supabaseには保存せず、development条件のフォールバックでのみ使用します。
export const developmentSamplePosts: CommunityPost[] = [
  {
    id: "demo-practice-night",
    type: "practice",
    author_id: "demo-user-1",
    title: "土曜ナイター練習会",
    held_on: "2026-09-12",
    start_time: "19:00",
    end_time: "21:00",
    venue: "宮崎市総合体育館",
    prefecture: "宮崎県",
    capacity: 8,
    fee: 500,
    level: "初心者歓迎",
    category: "",
    description: "ラリー中心の気軽な練習会です。初参加の方も歓迎します。室内シューズをご持参ください。",
    organizer: "森口",
    status: "open",
    participant_count: 5,
    secondary_title: "",
    deadline: "",
    application_method: "",
    viewer_joined: 0,
    created_at: "2026-09-07T09:00:00Z",
    is_demo: true,
  },
  {
    id: "demo-practice-beginner",
    type: "practice",
    author_id: "demo-user-2",
    title: "初心者歓迎 ゆる練習",
    held_on: "2026-09-14",
    start_time: "10:00",
    end_time: "12:00",
    venue: "清武体育館",
    prefecture: "宮崎県",
    capacity: 10,
    fee: 300,
    level: "初級",
    category: "",
    description: "ルール確認から始めます。ラケットの貸し出しも少しあります。",
    organizer: "田中",
    status: "open",
    participant_count: 4,
    secondary_title: "",
    deadline: "",
    application_method: "",
    viewer_joined: 0,
    created_at: "2026-09-06T11:00:00Z",
    is_demo: true,
  },
  {
    id: "demo-member-mixed",
    type: "member",
    author_id: "demo-user-3",
    title: "10月のミックス大会、一緒に出てくれる方探してます！",
    held_on: "2026-10-18",
    start_time: "",
    end_time: "",
    venue: "宮崎県体育館",
    prefecture: "宮崎県",
    capacity: 1,
    fee: 0,
    level: "中級",
    category: "ミックスダブルス",
    description: "勝ち負けよりも楽しく、最後まで声を掛け合える方だとうれしいです。",
    organizer: "佐藤",
    status: "open",
    participant_count: 0,
    secondary_title: "宮崎オータムカップ",
    deadline: "2026-09-30",
    application_method: "",
    viewer_joined: 0,
    created_at: "2026-09-07T12:00:00Z",
    is_demo: true,
  },
  {
    id: "demo-event-meetup",
    type: "event",
    author_id: "demo-user-4",
    title: "みやざきピックルボール交流会",
    held_on: "2026-09-20",
    start_time: "13:00",
    end_time: "16:00",
    venue: "生目の杜運動公園体育館",
    prefecture: "宮崎県",
    capacity: 24,
    fee: 1000,
    level: "",
    category: "交流会",
    description: "年代や経験を問わず楽しめる交流イベントです。ミニゲームも予定しています。",
    organizer: "宮崎ピックルボールクラブ",
    status: "open",
    participant_count: 11,
    secondary_title: "",
    deadline: "",
    application_method: "詳細ページの参加ボタンからお申し込みください。",
    viewer_joined: 0,
    created_at: "2026-09-05T08:00:00Z",
    is_demo: true,
  },
];
