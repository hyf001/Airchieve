
export interface StoryPage {
  id: string;
  text: string;
  imageUrl: string;
  loading?: boolean;
}

export interface StoryTemplate {
  id: string;
  name: string;
  description: string;
  promptStyle: string;
  previewUrl: string;
}

export type AppView = 'home' | 'editor';

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
