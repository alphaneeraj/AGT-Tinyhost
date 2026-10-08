import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { zipDirectory } from './zip.js';

/** ZIP of dist/ with index.html at the root – for an optional copy on tiiny.host. */
export function makeSiteZip() {
  if (!fs.existsSync(path.join(config.paths.dist, 'index.html'))) {
    throw new Error('dist/ is empty – run a build first.');
  }
  return zipDirectory(config.paths.dist);
}
