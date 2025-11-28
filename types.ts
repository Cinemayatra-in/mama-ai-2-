export enum AppView {
  WELCOME = 'WELCOME',
  CHAT = 'CHAT',
  FLAMES = 'FLAMES'
}

export interface FlamesResult {
  status: string;
  description: string;
  score: number;
}
