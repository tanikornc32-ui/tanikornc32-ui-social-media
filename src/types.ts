export interface SocialLinks {
  google?: string;
  tiktok?: string;
  facebook?: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  socialLinks: SocialLinks;
  lastSync?: string;
}

export type Platform = 'google' | 'tiktok' | 'facebook';
export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface Metric {
  id?: string;
  branchId: string;
  platform: Platform;
  date: any; // Firestore Timestamp or Date
  likes: number;
  views: number;
  comments: number;
  rating?: number;
  sentiment?: Sentiment;
  engagementRate: number;
}

export interface SWOTAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface TOWSMatrix {
  so: string[]; // Strengths-Opportunities
  wo: string[]; // Weaknesses-Opportunities
  st: string[]; // Strengths-Threats
  wt: string[]; // Weaknesses-Threats
}
