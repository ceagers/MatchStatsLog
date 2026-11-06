// The per-player season totals, counted up from a season's saved matches.
// Shared by the Season screen's Players tab and the Squad screen — the Squad
// screen feeds it the current season, so the same detail follows the squad
// around. Tap a column title to sort by it; tap again to flip the order.
// Tap a player's row to open their own match-by-match season screen.

import { useRef, useState } from 'react';
import {
  Block, BlockTitle, List, ListInput, ListButton,
  Segmented, SegmentedButton,
} from 'konsta/react';
import { useSettings } from '../settings.jsx';
import { useMatch, computeSeasonStats } from '../store.jsx';
import { buildSeasonPhotos } from '../photos.js';
import { seasonSquadCsv, seasonSquadFileName } from '../export.js';
import { parseMinutesCsv } from '../bulkimport.js';
import { Icon } from '../icons.js';
import { haptic } from '../haptics.js';
import { showToast } from '../toast.jsx';

export default function PlayerTotals({ season, matches, onOpenPlayer, onExport, onPhotos }) {
  const { competitions } = useSettings();
  const { updateSeason } = useMatch();
  const minutesInputRef = useRef(null);
  // Division filter: '__all' counts every game, a value counts only those
  // games. All is the default.
  const [compFilter, setCompFilter] = useState('__all');
  const [sort, setSort] = useState(null); // { key, dir: 'asc' | 'desc' } | null

  // Label for exports and photos — empty string means every division.
  const division = compFilter === '__all' ? '' : compFilter;

  // The division options the season's matches actually use, ordered as the
  // divisions are listed in Settings; values missing from that list follow
  // alphabetically. Only offered when at least one game carries a division.
  const compOptions = (() => {
    const present = new Set();
    matches.forEach((r) => {
      const v =
        r.match && typeof r.match.competition === 'string'
          ? r.match.competition.trim()
          : '';
      if (v) present.add(v);
    });
    return [
      ...competitions.filter((c) => present.has(c)),
      ...[...present]
        .filter((v) => !competitions.includes(v))
        .sort((a, b) => a.localeCompare(b)),
    ];
  })();

  const filtered =
    compFilter === '__all'
      ? matches
      : matches.filter(
          (r) =>
            r.match &&
            typeof r.match.competition === 'string' &&
            r.match.competition.trim() === compFilter
        );

  const { players, matchesCounted } = computeSeasonStats(filtered, {
    cutoff: season.minutesCutoff,
    cutoffRecords: matches,
    overrides: season.minutesOverrides,
  });

  // The season's own minutes reliability, shown under the table and used in
  // the explanation above it.
  const overrideCount = Object.keys(season.minutesOverrides || {}).length;
  const cutoffNote =
    season.minutesCutoff > 0
      ? ` The oldest ${season.minutesCutoff} game${season.minutesCutoff === 1 ? '' : 's'} ` +
        `(date played order) are excluded from Minutes and %` +
        (overrideCount
          ? ', with the imported percentages folded back in for the players they cover'
          : '') +
        '.'
      : '';

  // The coach's spreadsheet of Player, Games Played and Total % for the
  // excluded oldest games. Names that match nobody are kept but flagged in
  // the toast, so a typo is visible rather than silently dropped.
  const onMinutesFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    event.target.value = ''; // so picking the same file again still fires
    if (!file) return;
    const parsed = parseMinutesCsv(await file.text());
    if (!parsed.ok) {
      haptic('removed');
      showToast(parsed.error);
      return;
    }
    const squadNames = new Set();
    matches.forEach((r) => {
      const ps = r.match && Array.isArray(r.match.players) ? r.match.players : [];
      ps.forEach((p) => squadNames.add(p.name));
    });
    const unknown = parsed.entries
      .map((e) => e.name)
      .filter((n) => !squadNames.has(n));
    updateSeason(season.id, {
      minutesOverrides: Object.fromEntries(
        parsed.entries.map((e) => [e.name, { games: e.games, pct: e.pct }])
      ),
    });
    haptic('archived');
    const bits = [
      `Imported percentages for ${parsed.entries.length} player${
        parsed.entries.length === 1 ? '' : 's'
      }`,
    ];
    if (unknown.length) {
      bits.push(`not in this season's squads: ${unknown.join(', ')}`);
    }
    parsed.warnings.forEach((w) => bits.push(w));
    showToast(bits.join(' · '));
  };

  const cols = [
    { key: 'name', label: 'Player', w: 'min-w-0 flex-1' },
    { key: 'played', label: 'GP', w: 'w-8' },
    { key: 'starts', label: 'St', w: 'w-8' },
    { key: 'notAvailable', label: 'NA', w: 'w-8' },
    { key: 'goals', label: 'G', w: 'w-8' },
    { key: 'assists', label: 'A', w: 'w-8' },
    { key: 'potm', label: 'POTM', w: 'w-10' },
    { key: 'percentage', label: '%', w: 'w-8' },
  ];

  const toggleSort = (key) => {
    haptic('tick');
    setSort((s) =>
      s && s.key === key
        ? s.dir === 'desc'
          ? { key, dir: 'asc' }
          : null
        : { key, dir: 'desc' }
    );
  };

  const sorted =
    sort === null
      ? players
      : [...players].sort((a, b) => {
          const va = sort.key === 'percentage'
            ? (a.percentage === null ? -1 : a.percentage)
            : a[sort.key];
          const vb = sort.key === 'percentage'
            ? (b.percentage === null ? -1 : b.percentage)
            : b[sort.key];
          const cmp =
            typeof va === 'string'
              ? va.localeCompare(vb)
              : va - vb;
          return sort.dir === 'asc' ? cmp : -cmp;
        });

  if (matches.length === 0) {
    return (
      <Block strong inset className="text-center text-gray-500 dark:text-gray-400">
        Totals appear once this season has matches in it.
      </Block>
    );
  }

  return (
    <>
      {compOptions.length > 0 && (
        <div className="mx-4 mb-2">
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
      <BlockTitle className="mb-2">
        Squad Totals{' '}
        <span className="font-normal text-gray-500 dark:text-gray-400">
          ({matchesCounted} match{matchesCounted === 1 ? '' : 'es'} counted)
        </span>
      </BlockTitle>
      <div className="mx-4 mt-3 overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/15 dark:bg-[#1c1c1e]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {cols.map((c) => {
                const active = sort !== null && sort.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={`border border-black/10 px-1 py-1.5 align-middle dark:border-white/15 ${
                      active
                        ? 'text-primary'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="flex w-full flex-col items-center gap-0.5
                                 text-[11px] font-medium uppercase tracking-wide
                                 transition-colors active:opacity-60"
                    >
                      <span>{c.label}</span>
                      <Icon
                        name={active && sort.dir === 'desc' ? 'chevron-down' : 'chevron-up'}
                        size={11}
                        className={active ? '' : 'opacity-0'}
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr
                key={p.name}
                onClick={() => {
                  haptic('tick');
                  onOpenPlayer(p.name);
                }}
                className="cursor-pointer transition-colors active:bg-black/5 dark:active:bg-white/10"
              >
                <td className="border border-black/10 px-2 py-2 text-center align-middle text-[15px] font-semibold dark:border-white/15">
                  {p.name}
                </td>
                <td className="border border-black/10 px-1 py-2 text-center align-middle text-[14px] tabular-nums dark:border-white/15">
                  {p.played}
                </td>
                <td className="border border-black/10 px-1 py-2 text-center align-middle text-[14px] tabular-nums dark:border-white/15">
                  {p.starts}
                </td>
                <td className="border border-black/10 px-1 py-2 text-center align-middle text-[14px] tabular-nums dark:border-white/15">
                  {p.notAvailable}
                </td>
                <td className="border border-black/10 px-1 py-2 text-center align-middle text-[14px] tabular-nums dark:border-white/15">
                  {p.goals}
                </td>
                <td className="border border-black/10 px-1 py-2 text-center align-middle text-[14px] tabular-nums dark:border-white/15">
                  {p.assists}
                </td>
                <td className="border border-black/10 px-1 py-2 text-center align-middle text-[14px] tabular-nums dark:border-white/15">
                  {p.potm}
                </td>
                <td className="border border-black/10 px-1 py-2 text-center align-middle text-[14px] font-semibold tabular-nums dark:border-white/15">
                  {p.percentage === null ? '—' : `${p.percentage}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Block className="!mt-1 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
        Stats cover the division picked at the top — All counts every game in
        the season. Counted from the saved matches in this season. Period 1 green is a
        start, red is the bench, no colour is not available — GP counts green or
        red. Percentage played is minutes on the pitch against the match time of
        only the games the player was available for (started or benched), not
        every match logged. POTM counts player-of-the-match awards. A match with an unmarked
        squad grid carries no appearance data and is left out of those counts;
        goals and awards logged in it still count. Tap a column title to sort
        the table; tap again to flip the order. Tap a player's row to see their
        match-by-match season.{cutoffNote}
      </Block>

      <BlockTitle className="mt-2">Minutes Reliability</BlockTitle>
      <List strong inset>
        <ListInput
          label="Excluded oldest games"
          type="number"
          value={season.minutesCutoff > 0 ? String(season.minutesCutoff) : ''}
          placeholder="0"
          onInput={(e) => {
            const n = Math.max(
              0,
              Math.min(999, Math.round(Number(e.target.value) || 0))
            );
            updateSeason(season.id, { minutesCutoff: n });
          }}
        />
        <ListButton
          onClick={() => {
            haptic('tick');
            if (minutesInputRef.current) minutesInputRef.current.click();
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="file-spreadsheet" size={20} />
            Import Percentages Spreadsheet
          </span>
        </ListButton>
        {overrideCount > 0 && (
          <ListButton
            onClick={() => {
              haptic('removed');
              updateSeason(season.id, { minutesOverrides: {} });
              showToast('Imported percentages cleared');
            }}
          >
            Clear Imported Percentages ({overrideCount})
          </ListButton>
        )}
      </List>
      <Block className="!mt-1 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">
        The season's first games — in date played order, the number above —
        carry minutes the app counted wrongly. They drop out of Minutes and %
        for every player. A spreadsheet of Player, Games Played and Total %
        gives each player's true percentage across those games; its minutes
        are folded back into the season totals alongside the games the app
        still counts, and the % column shows the combined share of total
        match time.
      </Block>
      <input
        ref={minutesInputRef}
        type="file"
        accept=".csv,text/csv,text/comma-separated-values,text/plain"
        className="hidden"
        onChange={onMinutesFile}
      />

      <BlockTitle className="mt-2">Export</BlockTitle>
      <List strong inset>
        <ListButton
          onClick={() => {
            haptic('tick');
            onExport({
              csv: seasonSquadCsv(season.name, division, matchesCounted, sorted),
              fileName: seasonSquadFileName(season.name),
              description: `A spreadsheet of the squad's ${season.name} totals — games, starts, goals, assists, POTM and % played — counted from the ${matchesCounted} match${matchesCounted === 1 ? '' : 'es'} in ${division || 'every division'}. For Excel, Numbers or Google Sheets.`,
            });
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
            onPhotos(buildSeasonPhotos(season.name, division, matchesCounted, sorted));
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Icon name="camera" size={20} />
            Export To Photos
          </span>
        </ListButton>
      </List>
      <Block className="!mt-1 text-[12px] text-gray-500 dark:text-gray-400">
        Hands over exactly this table — same division filter and sorting. The
        spreadsheet opens in Excel, Numbers or Google Sheets; the picture saves
        to your camera roll from the share sheet.
      </Block>
    </>
  );
}
