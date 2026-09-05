import { reactDomClient as m } from './react-core.mjs';
export default (m.default ?? m);
export const { createRoot, hydrateRoot, version } = m;
