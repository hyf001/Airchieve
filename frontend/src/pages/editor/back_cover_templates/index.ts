import FreshComponent from './fresh';

export interface BackCoverTemplate {
  id: string;
  name: string;
  component: React.FC<BackCoverTemplateProps>;
}

export interface BackCoverTemplateProps {
  storybookTitle: string;
  logoUrl: string;
  editorMessage: string;
  backgroundColor: string;
  aspectRatio: '1:1' | '16:9' | '4:3';
}

export const templates: BackCoverTemplate[] = [
  {
    id: 'fresh',
    name: '清新风格',
    component: FreshComponent,
  },
];

export const aspectRatios = [
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '16:9', label: '16:9 (横向)' },
  { value: '4:3', label: '4:3 (横向)' },
];

export const backgroundColors = [
  { name: '清新渐变', value: 'linear-gradient(135deg, #e0f7fa 0%, #ffffff 100%)' },
  { name: '温暖渐变', value: 'linear-gradient(135deg, #fff3e0 0%, #ffffff 100%)' },
  { name: '梦幻渐变', value: 'linear-gradient(135deg, #f3e5f5 0%, #ffffff 100%)' },
  { name: '自然渐变', value: 'linear-gradient(135deg, #e8f5e9 0%, #ffffff 100%)' },
  { name: '天空渐变', value: 'linear-gradient(135deg, #e3f2fd 0%, #ffffff 100%)' },
  { name: '纯白', value: '#ffffff' },
  { name: '浅灰', value: '#f5f5f5' },
  { name: '米色', value: '#faf8f0' },
];
