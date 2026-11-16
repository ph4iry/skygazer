import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { IoLocationSharp } from 'react-icons/io5';
import { Suggestion } from '@/types';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 350;
// a free-tier API sleeps when idle and takes a while to wake; past this, say so
const SLOW_MS = 2500;

interface SearchBarProps {
  onPlaceSelect: (place: Suggestion) => void;
  onReset: () => void;
  showMap: boolean;
  selectedPlace: Suggestion | null;
}

export default function SearchBar({ onPlaceSelect, onReset, showMap, selectedPlace }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // an autocomplete request has been waiting longer than SLOW_MS
  const [slow, setSlow] = useState(false);

  // only query while the user is typing; picking a suggestion pauses lookups until they type again
  const typingRef = useRef(false);

  useEffect(() => {
    if (!selectedPlace) {
      setQuery('');
      setSuggestions([]);
    }
  }, [selectedPlace]);

  useEffect(() => {
    const q = query.trim();
    if (!typingRef.current || q.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setSlow(false);
      return;
    }

    const controller = new AbortController();
    let slowTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(async () => {
      slowTimer = setTimeout(() => setSlow(true), SLOW_MS);
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/autocomplete?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const data: Suggestion[] = response.ok ? await response.json() : [];
        setSuggestions(data);
        setActiveIndex(-1);
        setOpen(true);
        setSlow(false);
      } catch (error) {
        // an abort means a newer keystroke took over; keep any "waking up" note until a reply arrives
        if ((error as Error).name !== 'AbortError') {
          setSuggestions([]);
          setSlow(false);
        }
      } finally {
        clearTimeout(slowTimer);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      clearTimeout(slowTimer);
      controller.abort();
    };
  }, [query]);

  const selectSuggestion = (suggestion: Suggestion) => {
    typingRef.current = false;
    setQuery(suggestion.label);
    setSuggestions([]);
    setOpen(false);
    setSlow(false);
    onPlaceSelect(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectSuggestion(suggestions[Math.max(activeIndex, 0)]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showSuggestions = open && suggestions.length > 0;

  return (
    <div>
      {/* the buttons are centered on this box, so the note below doesn't shift them */}
      <div className="relative">
        <input
          id="address-input"
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSuggestions}
          aria-controls="address-suggestions"
          aria-activedescendant={activeIndex >= 0 ? `address-suggestion-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder="Enter an address..."
          value={query}
          onChange={(e) => {
            typingRef.current = true;
            setQuery(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="w-full px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {showSuggestions && (
          <ul
            id="address-suggestions"
            role="listbox"
            className="absolute z-[1000] top-full left-4 right-4 mt-1 bg-white rounded-md shadow-lg overflow-hidden text-left"
          >
            {suggestions.map((suggestion, i) => {
              const [main, ...rest] = suggestion.label.split(', ');
              return (
                <li
                  key={`${suggestion.label}-${i}`}
                  id={`address-suggestion-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  // keep focus in the input so the blur handler doesn't close the list first
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectSuggestion(suggestion)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer border-t border-gray-200 first:border-t-0 ${i === activeIndex ? 'bg-gray-100' : ''}`}
                >
                  <IoLocationSharp className="shrink-0 size-4 text-gray-400" />
                  <span className="truncate">
                    <span className="text-gray-900">{main}</span>
                    {rest.length > 0 && <span className="ml-1 text-gray-500">{rest.join(', ')}</span>}
                  </span>
                </li>
              );
            })}
            <li role="presentation" className="px-3 py-1 text-[11px] text-right text-gray-400 border-t border-gray-200">
              search by Photon · © OpenStreetMap contributors
            </li>
          </ul>
        )}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-2">
          {showMap && (
            <button
              type="button"
              onClick={onReset}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-full transition-colors"
            >
              Reset
            </button>
          )}
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full flex items-center gap-2 transition-colors"
            disabled={!selectedPlace}
          >
            <span>Search</span>
          </button>
        </div>
      </div>
      <AnimatePresence>
        {slow && (
          <motion.p
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 overflow-hidden text-center font-body text-xs text-gray-400"
          >
            The server may be waking up. This can take up to a minute.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
