export function getLayout() {
  const VIZ_HEIGHT = window.innerHeight * 0.90;
  const VIZ_GAP = 20;

  const WAVE_H = VIZ_HEIGHT * 0.65;
  const SWARM_H = VIZ_HEIGHT - WAVE_H - VIZ_GAP;

  const width = window.innerWidth * 0.75;

  const wave = {
    width,
    height: WAVE_H,
    margin: { top: 80, right: 160, bottom: 80, left: 40 },
  };

  const swarm = {
    width,
    height: SWARM_H,
    margin: { top: 0, right: 160, bottom: 80, left: 40 },
  };

  wave.innerWidth  = wave.width  - wave.margin.left - wave.margin.right;
  wave.innerHeight = wave.height - wave.margin.top  - wave.margin.bottom;
  wave.baseline = wave.innerHeight / 2;

  swarm.innerWidth  = wave.innerWidth; // same width as waveform-baseline
  swarm.innerHeight = swarm.height - swarm.margin.top - swarm.margin.bottom;

  return { VIZ_GAP, wave, swarm };
}