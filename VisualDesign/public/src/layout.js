export function getLayout() {
  const VIZ_HEIGHT = window.innerHeight * 0.80;
  const GAP_RATIO = 0.015;
  const VIZ_GAP = VIZ_HEIGHT * GAP_RATIO;

  const WAVE_H = VIZ_HEIGHT * 0.50;
  const SWARM_H = VIZ_HEIGHT - WAVE_H - VIZ_GAP;
  const DISCO_H = VIZ_HEIGHT;

  const width = window.innerWidth * 0.75;

  const wave = {
    width,
    height: WAVE_H,
    margin: { top: 80, right: 160, bottom: 0, left: 40 },
  };

  const swarm = {
    width,
    height: SWARM_H,
    margin: { top: 0, right: 160, bottom: 80, left: 40 },
  };

  const disco = {
    width,
    height: DISCO_H,
    margin: { top: 0, right: 0, bottom: 0, left: 0}
  }

  wave.innerWidth  = wave.width  - wave.margin.left - wave.margin.right;
  wave.innerHeight = wave.height - wave.margin.top  - wave.margin.bottom;
  wave.baseline = wave.innerHeight / 2;

  swarm.innerWidth  = wave.innerWidth; // same width as waveform-baseline
  swarm.innerHeight = swarm.height - swarm.margin.top - swarm.margin.bottom;

  disco.innerWidth  = disco.width  - disco.margin.left - disco.margin.right;
  disco.innerHeight = disco.height - disco.margin.top  - disco.margin.bottom;

  return { VIZ_GAP, wave, swarm, disco};
}