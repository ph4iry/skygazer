import { useRef } from 'react';
import { motion } from 'motion/react';
import { SpotOption } from '@/types';
import { getBortleClassification, skyAccent } from '@/utils/bortle';
import { DistanceUnit, formatDistance, fromKm, RANGE_CHOICES } from '@/utils/units';

interface SpotOptionsProps {
  options: SpotOption[];
  missing: string[];
  // the range the server searched, in km
  maxKm: number;
  // the selected range pill, in `unit`
  range: number;
  unit: DistanceUnit;
  selectedIndex: number;
  loading: boolean;
  onSelect: (index: number) => void;
  onRangeChange: (range: number) => void;
  onUnitChange: (unit: DistanceUnit) => void;
}

const PILL = 'px-3 py-1 rounded-full text-xs transition-colors';
const pillState = (active: boolean) => (active ? 'bg-blue-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20');

function spotName(option: SpotOption) {
  if (option.place?.name) return option.place.name;
  if (option.place?.label) return option.place.label;
  return `${option.latitude.toFixed(3)}, ${option.longitude.toFixed(3)}`;
}

export default function SpotOptions({ options, missing, maxKm, range, unit, selectedIndex, loading, onSelect, onRangeChange, onUnitChange }: SpotOptionsProps) {
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const closest = options[0]?.distance ?? 0;
  // the server falls back to the nearest dark spot when nothing is within range
  const outOfRange = options.length > 0 && closest > maxKm;
  const largerRange = RANGE_CHOICES.find((choice) => choice > range);
  const rangeLabel = `${range} ${unit}`;

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (index + 1) % options.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (index - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    onSelect(next);
    rowRefs.current[next]?.focus();
  };

  return (
    <motion.section
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={`w-full mt-4 md:mt-0 text-left font-body text-sm text-white overflow-hidden transition-opacity ${loading ? 'opacity-60' : ''}`}
    >
      <h2 className="font-display text-lg lg:text-xl mb-2">optimal locations</h2>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-3">
        <div role="group" aria-label="Maximum distance" className="flex items-center gap-1">
          <span className="mr-1 text-xs text-gray-400">range:</span>
          {RANGE_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={choice === range}
              disabled={loading}
              onClick={() => onRangeChange(choice)}
              className={`${PILL} ${pillState(choice === range)}`}
            >
              {choice} {unit}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Distance unit" className="flex items-center rounded-full bg-white/10 p-0.5">
          {(['mi', 'km'] as const).map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={u === unit}
              disabled={loading}
              onClick={() => onUnitChange(u)}
              className={`${PILL} ${u === unit ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-gray-200'}`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {outOfRange && (
        <p className="mb-2 text-gray-400">
          No dark sky within {rangeLabel}. This is the nearest one.
        </p>
      )}

      <div role="radiogroup" aria-label="Stargazing spots" className="rounded-xl border border-white/15 bg-white/5 divide-y divide-white/10 overflow-hidden">
        {options.map((option, i) => {
          const selected = i === selectedIndex;
          const extra = option.distance - closest;
          const accent = skyAccent(option.bortle);
          return (
            <button
              key={`${option.bortle}-${i}`}
              ref={(el) => { rowRefs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(i)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-l-4 transition-colors ${selected ? 'bg-white/10' : 'hover:bg-white/5'}`}
              style={{ borderLeftColor: selected ? accent.color : 'transparent' }}
            >
              <span
                aria-hidden
                className={`size-3 shrink-0 rounded-full border ${selected ? 'border-white' : 'border-gray-400'}`}
                style={selected ? { backgroundColor: accent.color } : undefined}
              />
              {/* the light ring keeps the darkest accent visible on the dark background */}
              <span
                className="w-10 shrink-0 rounded-full py-0.5 text-center text-xs font-bold ring-1 ring-white/30"
                style={{ backgroundColor: accent.color, color: accent.ink }}
                title={getBortleClassification(option.bortle)}
              >
                B{option.bortle}
              </span>
              <span className="flex-1 min-w-0">
                {/* names can be long ("Mount Evans Wilderness"), so allow two lines before cutting off */}
                <span className="block line-clamp-2">
                  {spotName(option)}
                  {option.snapping && <span aria-label="looking for a park nearby" className="ml-2 inline-block size-1.5 rounded-full bg-gray-400 animate-pulse" />}
                </span>
                <span className="block text-xs text-gray-400 lowercase">{getBortleClassification(option.bortle)}</span>
                {/* under the description rather than beside the distance, so names keep their width */}
                {option.recommended && <span className="block text-xs text-indigo-300">★ recommended</span>}
              </span>
              <span className="shrink-0 text-right">
                <span className="block">{formatDistance(option.distance, unit)}</span>
                <span className="block text-xs text-gray-400">
                  {Math.round(fromKm(extra, unit)) >= 1 ? `+${formatDistance(extra, unit)}` : 'closest'}
                </span>
              </span>
            </button>
          );
        })}

        {!outOfRange && [...missing].reverse().map((bortle) => (
          <div key={bortle} className="flex items-center gap-3 px-4 py-3 border-l-4 border-transparent text-gray-500">
            <span aria-hidden className="size-3 shrink-0" />
            <span
              className="w-10 shrink-0 rounded-full py-0.5 text-center text-xs font-bold opacity-40 ring-1 ring-white/30"
              style={{ backgroundColor: skyAccent(bortle).color, color: skyAccent(bortle).ink }}
            >
              B{bortle}
            </span>
            <span className="flex-1">none within {rangeLabel}</span>
            {largerRange && (
              <button
                type="button"
                disabled={loading}
                onClick={() => onRangeChange(largerRange)}
                className="shrink-0 text-xs underline underline-offset-4 hover:text-gray-300"
              >
                try {largerRange} {unit}
              </button>
            )}
          </div>
        ))}
      </div>
    </motion.section>
  );
}
