#!/usr/bin/env node

import { Command } from 'commander';
import { registerGenerate } from './commands/generate.js';
import { registerGrid } from './commands/grid.js';
import { registerImage } from './commands/image.js';
import { registerConway } from './commands/conway.js';
import { registerBotanical } from './commands/botanical.js';
import { registerPlanet } from './commands/planet.js';
import { registerLandscape } from './commands/landscape.js';
import { registerGesture } from './commands/gesture.js';

const program = new Command();

program
  .name('flow-lines')
  .description('Generate beautiful flow line art for pen plotters')
  .version('0.1.0');

// Registration order matches the original single-file order: it fixes the
// command order in --help output.
registerGenerate(program);
registerGrid(program);
registerImage(program);
registerConway(program);
registerBotanical(program);
registerPlanet(program);
registerLandscape(program);
registerGesture(program);

program.parse();
