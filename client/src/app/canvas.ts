const element = document.getElementById('game') as HTMLCanvasElement;
const context = element.getContext('2d');
if (!context) throw new Error('Canvas 2D context unavailable');

export const canvas: HTMLCanvasElement = element;
export const ctx: CanvasRenderingContext2D = context;
