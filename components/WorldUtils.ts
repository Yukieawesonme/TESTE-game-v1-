
// Função matemática determinística para altura do terreno
export const getTerrainHeight = (x: number, z: number) => {
  let h = 0.0;
  h += Math.sin(x * 0.015 + z * 0.008) * 2.5;
  h += Math.sin(x * 0.005 - z * 0.012) * 3.0;
  h += Math.sin(x * 0.03 + z * 0.03) * 0.4;
  return h;
};

// Gerador de Números Pseudo-Aleatórios (Mulberry32)
// Permite gerar a mesma floresta em Trees.tsx e Bushes.tsx
export class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Retorna um número entre 0 e 1 (igual Math.random())
  next(): number {
    let t = (this.seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Helper para range
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}
