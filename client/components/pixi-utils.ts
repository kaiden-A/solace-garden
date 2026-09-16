export function makeDotTexture(PIXI: any, renderer: any, color: number, radius: number, alpha = 1) {
  const graphics = new PIXI.Graphics().circle(0, 0, radius).fill({ color, alpha });
  const texture = renderer.generateTexture(graphics);
  graphics.destroy();
  return texture;
}

export function makeStreakTexture(PIXI: any, renderer: any, color: number, width: number, height: number, alpha = 1) {
  const graphics = new PIXI.Graphics().rect(-width / 2, -height / 2, width, height).fill({ color, alpha });
  const texture = renderer.generateTexture(graphics);
  graphics.destroy();
  return texture;
}

export function makePetalTexture(PIXI: any, renderer: any, color: number, rx: number, ry: number, alpha = 1) {
  const graphics = new PIXI.Graphics().ellipse(0, 0, rx, ry).fill({ color, alpha });
  const texture = renderer.generateTexture(graphics);
  graphics.destroy();
  return texture;
}

export function makeRadialTexture(PIXI: any, stops: Array<[number, string]>, size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  return PIXI.Texture.from(canvas);
}

export function makeVerticalGradientTexture(PIXI: any, stops: Array<[number, string]>, height = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    for (const [offset, color] of stops) gradient.addColorStop(offset, color);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 2, height);
  }
  return PIXI.Texture.from(canvas);
}
