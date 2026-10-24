// Global data shared across the site. The canonical values live in
// src/config/site.ts (the single source of truth); this module only
// re-exports them under the names existing imports already use, so
// the two can never drift apart.
import { SITE_NAME, SITE_DESCRIPTION } from './config/site';

export const SITE_TITLE = SITE_NAME;
export { SITE_DESCRIPTION };
