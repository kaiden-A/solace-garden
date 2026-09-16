export interface Firefly {
  left: number;
  top: number;
  dur: number;
  size: number;
  delay: number;
}

const noise = (n: number) => {
  const value = Math.sin(n * 127.1) * 43758.5453;
  return value - Math.floor(value);
};

export function makeFireflies(count: number): Firefly[] {
  return Array.from({ length: count }, (_, i) => ({
    left: noise(i + 1) * 100,
    top: 38 + noise(i + 7) * 58,
    dur: 6 + noise(i + 13) * 9,
    size: 2 + noise(i + 19) * 3,
    delay: -noise(i + 23) * 12,
  }));
}
