export type Profile = {
  displayName: string;
  username: string;
  avatarUrl?: string;
  followers: number;
  following: number;
  likes: number;
  videoCount: number;
};

export type Video = {
  id: string;
  createdAt: number; // unix seconds
  title: string;
  description: string;
  duration: number; // seconds
  coverUrl?: string;
  shareUrl?: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
};

export type Snapshot = {
  date: string; // YYYY-MM-DD
  followers: number;
  likes: number;
  videoCount: number;
};

export type DashboardData = {
  source: "tiktok" | "demo";
  profile: Profile;
  videos: Video[];
  snapshots: Snapshot[];
};
