// Full backup: one JSON file carrying everything the app keeps — the match in
// progress, the whole match history, every season with its minutes cutoff and
// overrides, all training attendance and the app's own settings, wallpapers
// included. Export writes it out; Import reads one back in, either merged into
// what is on the phone or replacing everything.
//
// The file is deliberately plain data — no derived totals, no component state —
// so it reads back exactly as it went out, and a future version can add fields
// without breaking the ones already here. parseBackup never throws: it returns
// { ok: true, backup, summary, warnings } or { ok: false, error }, and repairs
// whatever it can the same way the store repairs older records on launch.

export const BACKUP_APP = 'MatchStatsLog';
export const BACKUP_FORMAT = 'full-backup';
export const BACKUP_VERSION = 1;

// "MatchStatsLog-backup-2025-01-04-1930.json" — the moment it was made.
export function backupFileName() {
  const now = new Date();
  const stamp = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16) // "2025-01-04T19:30"
    .replace('T', '-')
    .replace(':', '');
  return `MatchStatsLog-backup-${stamp}.json`;
}

/// The backup as it is written: everything the two stores hold, exactly as
/// they hold it. The store normalises and freezes on the way back in, so no
/// cleanup happens here — the file is a faithful snapshot, nothing more.
export function buildBackup({
  match,
  savedMatches,
  seasons,
  currentSeasonId,
  trainingSessions,
  settings,
}) {
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    match: match || null,
    history: Array.isArray(savedMatches) ? savedMatches : [],
    seasons: {
      list: Array.isArray(seasons) ? seasons : [],
      currentId: currentSeasonId || null,
    },
    training: Array.isArray(trainingSessions) ? trainingSessions : [],
    settings: {
      teamName: settings.teamName,
      theme: settings.theme,
      accent: settings.accent,
      font: settings.font,
      competitions: settings.competitions,
      matchTypes: settings.matchTypes,
      homeImage: settings.homeImage,
      badgeImage: settings.badgeImage,
    },
  };
}

const asString = (v, fallback = '') => (typeof v === 'string' ? v : fallback);

// A stored option list must be strings, trimmed, unique and non-empty — the
// same discipline loadList applies to the live lists. Anything else is null,
// which the caller reports as a warning rather than guessing.
const asStringList = (v) => {
  if (!Array.isArray(v)) return null;
  const seen = new Set();
  const out = [];
  v.forEach((item) => {
    if (typeof item !== 'string') return;
    const t = item.trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k)) return;
    seen.add(k);
    out.push(t);
  });
  return out;
};

// A wallpaper travels exactly as the settings panel stores it — a data URL —
// and anything else is dropped rather than guessed at.
const asImage = (v) =>
  typeof v === 'string' && v.startsWith('data:image/') ? v : null;

// Training marks are the same three-state discipline as the period grid; only
// genuine Y/N values travel, exactly as cleanAttendance keeps on launch.
const asMark = (v) => (v === 1 || v === 2 ? v : null);

export function parseBackup(text) {
  const fail = (error) => ({ ok: false, error });
  if (typeof text !== 'string' || !text.trim()) {
    return fail('That file could not be read.');
  }
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('That file is not a MatchStatsLog backup — it is not valid JSON.');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail('That file is not a MatchStatsLog backup.');
  }
  if (raw.app !== BACKUP_APP || raw.format !== BACKUP_FORMAT) {
    return fail('That file is not a MatchStatsLog full backup.');
  }
  const version = Number(raw.version);
  if (version !== BACKUP_VERSION) {
    return fail(
      version > BACKUP_VERSION
        ? 'That backup was made by a newer version of the app — update first.'
        : 'That backup is from an older version the app no longer reads.'
    );
  }

  const warnings = [];

  // Seasons — the same shape loadSeasonStore repairs on launch.
  const seasons = [];
  const seasonIds = new Set();
  const rawSeasons = raw.seasons && typeof raw.seasons === 'object' ? raw.seasons : {};
  (Array.isArray(rawSeasons.list) ? rawSeasons.list : []).forEach((s) => {
    if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !s.id) return;
    if (seasonIds.has(s.id)) return;
    seasonIds.add(s.id);
    seasons.push({
      id: s.id,
      name: asString(s.name).trim() || 'Season',
      createdAt: asString(s.createdAt) || new Date().toISOString(),
      minutesCutoff: Number.isFinite(s.minutesCutoff)
        ? Math.max(0, Math.round(s.minutesCutoff))
        : 0,
      minutesOverrides:
        s.minutesOverrides &&
        typeof s.minutesOverrides === 'object' &&
        !Array.isArray(s.minutesOverrides)
          ? s.minutesOverrides
          : {},
    });
  });
  let currentId = asString(rawSeasons.currentId);
  if (!currentId || !seasonIds.has(currentId)) {
    currentId = seasons.length ? seasons[0].id : null;
  }

  // History — each record is an id, a saved-at stamp, a season and a match.
  // The match itself is left to the store to normalise on the way in.
  const history = [];
  (Array.isArray(raw.history) ? raw.history : []).forEach((r) => {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id) {
      warnings.push('A history record without an id was skipped.');
      return;
    }
    if (!r.match || typeof r.match !== 'object') {
      warnings.push('A history record held no match and was skipped.');
      return;
    }
    history.push({
      id: r.id,
      savedAt: asString(r.savedAt) || new Date().toISOString(),
      seasonId: asString(r.seasonId),
      match: r.match,
    });
  });

  // Training — one record per date, its attendance a name → Y/N map.
  const training = [];
  const trainingDates = new Set();
  (Array.isArray(raw.training) ? raw.training : []).forEach((s) => {
    if (!s || typeof s !== 'object') return;
    const date = asString(s.date).slice(0, 10);
    if (!date || trainingDates.has(date)) return;
    const attendance = {};
    if (s.attendance && typeof s.attendance === 'object' && !Array.isArray(s.attendance)) {
      Object.entries(s.attendance).forEach(([name, v]) => {
        const mark = asMark(v);
        if (typeof name === 'string' && name && mark) attendance[name] = mark;
      });
    }
    trainingDates.add(date);
    training.push({ date, attendance });
  });

  // Settings — only what the app recognises, with a warning for anything that
  // does not read rather than dropping it silently.
  const rawSettings =
    raw.settings && typeof raw.settings === 'object' && !Array.isArray(raw.settings)
      ? raw.settings
      : {};
  const competitions = asStringList(rawSettings.competitions);
  const matchTypes = asStringList(rawSettings.matchTypes);
  if (rawSettings.competitions !== undefined && competitions === null) {
    warnings.push('The competitions list was skipped — it was not a list of names.');
  }
  if (rawSettings.matchTypes !== undefined && matchTypes === null) {
    warnings.push('The match types list was skipped — it was not a list of names.');
  }
  const settings = {
    teamName: asString(rawSettings.teamName),
    theme: ['system', 'light', 'dark'].includes(rawSettings.theme)
      ? rawSettings.theme
      : 'system',
    accent: asString(rawSettings.accent),
    font: asString(rawSettings.font),
    competitions: competitions || [],
    matchTypes: matchTypes || [],
    homeImage: asImage(rawSettings.homeImage),
    badgeImage: asImage(rawSettings.badgeImage),
  };
  if (rawSettings.homeImage !== undefined && rawSettings.homeImage !== null && !settings.homeImage) {
    warnings.push('The home wallpaper was skipped — it was not an image.');
  }
  if (rawSettings.badgeImage !== undefined && rawSettings.badgeImage !== null && !settings.badgeImage) {
    warnings.push('The badge watermark was skipped — it was not an image.');
  }

  // What the preview sheet shows, before anything is applied.
  const summary = {
    matches: history.length,
    seasons: seasons.length,
    seasonNames: seasons.map((s) => s.name),
    training: training.length,
    currentMatch:
      raw.match && typeof raw.match === 'object'
        ? {
            opposition: asString(raw.match.opposition),
            date: asString(raw.match.date).slice(0, 10),
          }
        : null,
    settings: {
      teamName: settings.teamName,
      wallpapers: (settings.homeImage ? 1 : 0) + (settings.badgeImage ? 1 : 0),
    },
  };

  return {
    ok: true,
    backup: {
      match: raw.match && typeof raw.match === 'object' ? raw.match : null,
      history,
      seasons,
      currentId,
      training,
      settings,
    },
    summary,
    warnings,
  };
}
