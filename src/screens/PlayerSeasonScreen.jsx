// One player's season: a header of their totals, then every match in the
// season as a row — whether they were available, whether they started, what
// they contributed, and how long they spent on the pitch.

import { useMemo, useState } from 'react';
import {
  Page, Navbar, NavbarBackLink, Block, BlockTitle, List, ListButton,
  Segmented, SegmentedButton,
} from 'konsta/react';
import { useSettings } from '../settings.jsx';
import { haptic } from '../haptics.js';
import {
  useMatch,
  computeSeasonStats, computePlayerMinutes, clockTotalMs, formatDate,
  PERIOD_UNSET, PERIOD_GREEN,
} from '../store.jsx';
import ExportSheet from '../components/ExportSheet.jsx';
import PhotosSheet from '../components/PhotosSheet.jsx';
import { playerSeasonCsv, playerSeasonFileName } from '../export.js';
import { buildPlayerSeasonPhotos } from '../photos.js';
import { Icon } from '../icons.js';

const BLANK_TOTALS = {
  played: 0, starts: 0, notAvailable: 0, goals: 0, assists: 0,
  potm: 0, minutes: 0, percentage: null,
};

export default function PlayerSeasonScreen({ season, playerName, matches, onBack }) {
  const { competitions } = useSettings();
  const { match } = useMatch();
  // Division filter: '__all' counts every game, a value counts only those games.
  // All is the default.
  const [compFilter, setCompFilter] = useState('__all');
  const fullRecs = Array.isArray(matches) ? matches : [];

  // The player's full name, typed on the Players tab's Edit screen, shown at
  // the top of this screen only. The current squad is the source of truth; the
  // season's saved records cover a player no longer in the current squad.
  const displayName = useMemo(() => {
    const pick = (p) =>
      p && typeof p.displayName === 'string' ? p.displayName.trim() : '';
    const live = pick((match.players || []).find((p) => p.name === playerName));
    if (live) return live;
    for (const record of fullRecs) {
      const m = record.match || {};
      const saved = pick(
        (Array.isArray(m.players) ? m.players : []).find((pl) => pl.name === playerName)
      );
      if (saved) return saved;
    }
    return '';
  }, [match.players, playerName, matches]);
  const { rows, me } = useMemo(() => {
    const recs =
      compFilter === '__all'
        ? fullRecs
        : fullRecs.filter((record) => {
            const m = record.match || {};
            return (
              typeof m.competition === 'string' &&
              m.competition.trim() === compFilter
            );
          });

    const gridUsed = (m) =>
      (Array.isArray(m.players) ? m.players : []).some(
        (p) => Array.isArray(p.periods) && p.periods.some((s) => s !== PERIOD_UNSET)
      );

    const matchRows = recs.map((record) => {
      const m = record.match || {};
      const p = (Array.isArray(m.players) ? m.players : []).find(
        (pl) => pl.name === playerName
      );
      const marked = gridUsed(m);
      const first = p && Array.isArray(p.periods) ? p.periods[0] : PERIOD_UNSET;
      const available = first !== PERIOD_UNSET;
      const started = first === PERIOD_GREEN;

      const timedMs = clockTotalMs(m.clock);
      const matchMinutes =
        timedMs >= 60000
          ? Math.floor(timedMs / 60000)
          : Number.isFinite(m.gameLength) && m.gameLength > 0
            ? m.gameLength
            : 0;
      const { minutes } = computePlayerMinutes(m);
      const mine = minutes.get(playerName) || 0;
      const pct =
        available && matchMinutes > 0 ? Math.round((100 * mine) / matchMinutes) : null;

      return {
        id: record.id,
        opposition: typeof m.opposition === 'string' ? m.opposition : '',
        date: typeof m.date === 'string' ? m.date : '',
        homeAway: typeof m.homeAway === 'string' ? m.homeAway : '',
        // null = the squad grid was never marked, so there is no data either way
        available: marked ? available : null,
        started: marked ? started : null,
        goals: p && Number.isFinite(p.goals) ? p.goals : 0,
        assists: p && Number.isFinite(p.assists) ? p.assists : 0,
        potm: typeof m.potm === 'string' && m.potm.trim() === playerName,
        minutes: marked && matchMinutes > 0 ? mine : null,
        pct,
      };
    });

    const stats = computeSeasonStats(recs);
    const totals =
      stats.players.find((p) => p.name === playerName) || BLANK_TOTALS;
    return { rows: matchRows, me: totals };
  }, [matches, playerName, compFilter]);

  // The division options the season's matches actually use, ordered as the
  // divisions are listed in Settings; values missing from that list follow
  // alphabetically. Only offered when at least one game carries a division.
  const compOptions = useMemo(() => {
    const present = new Set();
    fullRecs.forEach((record) => {
      const m = record.match || {};
      const v = typeof m.competition === 'string' ? m.competition.trim() : '';
      if (v) present.add(v);
    });
    return [
      ...competitions.filter((c) => present.has(c)),
      ...[...present]
        .filter((v) => !competitions.includes(v))
        .sort((a, b) => a.localeCompare(b)),
    ];
  }, [matches, competitions]);

  // Export & photos for this player's season — the same hand-over sheets the
  // Utilities screen uses for a match, fed with season data instead.
  const [exportOpen, setExportOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const division = compFilter === '__all' ? '' : compFilter;
  const modalOpen = exportOpen || photosOpen;
  const playerCsv = useMemo(
    () =>
      exportOpen
        ? playerSeasonCsv(season.name, playerName, division, me, rows)
        : '',
    [exportOpen, season.name, playerName, division, me, rows]
  );
  const playerFile = useMemo(
    () => playerSeasonFileName(season.name, playerName),
    [season.name, playerName]
  );

  const tiles = [
    { label: 'Games', value: me.played },
    { label: 'Starts', value: me.starts },
    { label: 'Goals', value: me.goals },
    { label: 'Assists', value: me.assists },
    { label: 'POTM', value: me.potm },
    { label: 'Minutes', value: `${me.minutes}m` },
    { label: 'Played', value: me.percentage === null ? '—' : `${me.percentage}%` },
  ];

  return (
    <Page
      colors={{ bgIos: 'bg-transparent' }}
      className={`relative pb-safe-24 ${modalOpen ? 'z-40' : 'z-10'}`}
    >
      <Navbar
        title={playerName}
        className="top-0 sticky"
        left={<NavbarBackLink text="Back" onClick={onBack} />}
      />

      {displayName ? (
        <Block className="!mb-1 text-center text-[19px] font-semibold">{displayName}</Block>
      ) : null}
      <Block className="!mb-2 text-[13px] text-gray-500 dark:text-gray-400">
        {season.name}
      </Block>

      {compOptions.length > 0 && (
        <div className="mx-4 mb-3">
          <Segmented strong rounded>
            <SegmentedButton
              strong
              rounded
              active={compFilter === '__all'}
              onClick={() => {
                haptic('tick');
                setCompFilter('__all');
              }}
            >
              All
            </SegmentedButton>
            {compOptions.map((c) => (
              <SegmentedButton
                key={c}
                strong
                rounded
                active={compFilter === c}
                onClick={() => {
                  haptic('tick');
                  setCompFilter(c);
                }}
              >
                {c}
              </SegmentedButton>
            ))}
          </Segmented>
        </div>
      )}

      <div className="mx-4 mb-2 grid grid-cols-4 gap-2">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-xl bg-black/5 px-1 py-2 text-center dark:bg-white/10"
          >
            <div className="text-[17px] font-semibold tabular-nums">{t.value}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t.label}
            </div>
          </div>
        ))}
      </div>

      <BlockTitle className="mb-2">
        Match by Match{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({rows.length} match{rows.length === 1 ? '' : 'es'})
        </span>
      </BlockTitle>

      {rows.length === 0 ? (
        <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
          No matches in this season yet.
        </Block>
      ) : (
        <div className="mx-4 mt-3 mb-2 overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/15 dark:bg-[#1c1c1e]">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="text-[10px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                <th className="border border-black/10 px-2 py-1.5 text-center align-middle dark:border-white/15">
                  Opposition
                </th>
                <th className="w-6 border border-black/10 px-1 py-1.5 text-center align-middle dark:border-white/15">H/A</th>
                <th className="w-6 border border-black/10 px-1 py-1.5 text-center align-middle dark:border-white/15">Av</th>
                <th className="w-6 border border-black/10 px-1 py-1.5 text-center align-middle dark:border-white/15">St</th>
                <th className="w-5 border border-black/10 px-1 py-1.5 text-center align-middle dark:border-white/15">G</th>
                <th className="w-5 border border-black/10 px-1 py-1.5 text-center align-middle dark:border-white/15">A</th>
                <th className="w-8 border border-black/10 px-1 py-1.5 text-center align-middle dark:border-white/15">POTM</th>
                <th className="w-9 border border-black/10 px-1 py-1.5 text-center align-middle dark:border-white/15">Time</th>
                <th className="w-9 border border-black/10 px-1 py-1.5 text-center align-middle dark:border-white/15">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="border border-black/10 px-2 py-2 text-center align-middle dark:border-white/15">
                    <span className="block font-medium">
                      {r.opposition || 'No opposition'}
                    </span>
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                      {formatDate(r.date)}
                    </span>
                  </td>
                  <td className="w-6 border border-black/10 px-1 py-2 text-center align-middle text-[12px] font-medium dark:border-white/15">
                    {r.homeAway === 'Home' ? 'H' : r.homeAway === 'Away' ? 'A' : '—'}
                  </td>
                  <td className="w-6 border border-black/10 px-1 py-2 text-center align-middle text-[12px] font-semibold dark:border-white/15">
                    {r.available ? 'Y' : r.available === null ? '—' : 'N'}
                  </td>
                  <td className="w-6 border border-black/10 px-1 py-2 text-center align-middle text-[12px] font-semibold dark:border-white/15">
                    {r.started ? 'Y' : r.started === null ? '—' : 'N'}
                  </td>
                  <td className="w-5 border border-black/10 px-1 py-2 text-center align-middle tabular-nums dark:border-white/15">
                    {r.goals}
                  </td>
                  <td className="w-5 border border-black/10 px-1 py-2 text-center align-middle tabular-nums dark:border-white/15">
                    {r.assists}
                  </td>
                  <td className="w-8 border border-black/10 px-1 py-2 text-center align-middle text-[12px] font-semibold dark:border-white/15">
                    {r.potm ? 'Y' : ''}
                  </td>
                  <td className="w-9 border border-black/10 px-1 py-2 text-center align-middle text-[12px] tabular-nums dark:border-white/15">
                    {r.minutes === null ? '—' : `${r.minutes}m`}
                  </td>
                  <td className="w-9 border border-black/10 px-1 py-2 text-center align-middle font-semibold tabular-nums dark:border-white/15">
                    {r.pct === null ? '—' : `${r.pct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Block className="!mt-1 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
        Stats cover the division picked at the top — All counts every game in{' '}
        {season.name}, newest first. H/A is home or away; Av is Y when the
        player was on the team sheet, N when not; St is Y when they started
        (green Period 1), N when not; POTM is Y for a player-of-the-match
        award. Time comes
        from the substitution log when the clock ran, otherwise from green grid
        periods against the game length; % is minutes on the pitch against that
        match's length, counted for matches they were available for. A dash
        means the match carries no data for that column — the squad grid was
        never marked, or there is no match time to measure against.
      </Block>

      <BlockTitle className="mt-2">Export</BlockTitle>
      <List strong inset>
        <ListButton
          onClick={() => {
            haptic('tick');
            setExportOpen(true);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="file-spreadsheet" size={20} />
            Export To Excel
          </span>
        </ListButton>
        <ListButton
          onClick={() => {
            haptic('archived');
            setPhotos(buildPlayerSeasonPhotos(season.name, playerName, division, me, rows));
            setPhotosOpen(true);
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="camera" size={20} />
            Export To Photos
          </span>
        </ListButton>
      </List>
      <Block className="!mt-1 text-[12px] text-gray-500 dark:text-gray-400">
        A spreadsheet and pictures of this player's season — the totals and the
        match-by-match table for the division picked at the top. The spreadsheet
        opens in Excel, Numbers or Google Sheets; the pictures save to your
        camera roll from the share sheet.
      </Block>

      <PhotosSheet
        opened={photosOpen}
        photos={photos}
        onClose={() => setPhotosOpen(false)}
      />

      <ExportSheet
        opened={exportOpen}
        onClose={() => setExportOpen(false)}
        match={null}
        csv={playerCsv}
        fileName={playerFile}
        description={`A spreadsheet of ${playerName}'s season in ${season.name}${division ? ` (${division})` : ''} — the totals plus a row for every match. For Excel, Numbers or Google Sheets.`}
      />
    </Page>
  );
}