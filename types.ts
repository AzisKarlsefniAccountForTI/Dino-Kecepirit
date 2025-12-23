
export interface GameTheme {
  sky: string;
  ground: string;
  dino: string;
  cactus: string;
  particle: string;
  themeName: string;
}

export interface Obstacle {
  id: number;
  x: number;
  width: number;
  height: number;
  type: 'cactus';
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}
