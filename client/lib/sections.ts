export interface SectionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const SECTIONS: Record<string, SectionRect> = {
  gratitude: { x: 0.1, y: 0.5, w: 0.28, h: 0.28 },
  memory: { x: 0.0, y: 0.54, w: 0.18, h: 0.4 },
  hope: { x: 0.4, y: 0.4, w: 0.2, h: 0.32 },
  anger: { x: 0.3, y: 0.64, w: 0.22, h: 0.28 },
  feeling: { x: 0.76, y: 0.38, w: 0.24, h: 0.48 },
};

export const sectionCenter = (rect: SectionRect) => ({
  x: rect.x + rect.w / 2,
  y: rect.y + rect.h / 2,
});
