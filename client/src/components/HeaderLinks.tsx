import { IoInformationCircleOutline } from 'react-icons/io5';
import { FaGithub } from 'react-icons/fa6';

// frosted-glass pill used for the header links
export const GLASS_PILL = "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 font-body text-sm text-indigo-100 shadow-md shadow-black/20 backdrop-blur-md transition-colors hover:bg-white/20 hover:border-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

interface HeaderLinksProps {
  onAbout: () => void;
  // in the topbar, phones get icon-only pills so they fit beside the title
  compact?: boolean;
}

export default function HeaderLinks({ onAbout, compact = false }: HeaderLinksProps) {
  const short = compact ? 'sr-only' : 'sm:hidden';
  return (
    <>
      <button
        type="button"
        onClick={onAbout}
        aria-haspopup="dialog"
        className={GLASS_PILL}
      >
        <IoInformationCircleOutline className="size-4" />
        {/* shorter labels on phones so both pills fit on one row */}
        <span className={short}>bortle scale?</span>
        <span className="hidden sm:inline">what&apos;s the bortle scale?</span>
      </button>
      <a
        href="https://github.com/ph4iry/skygazer"
        target="_blank"
        rel="noreferrer noopener"
        className={GLASS_PILL}
      >
        <FaGithub className="size-4" />
        <span className={short}>github</span>
        <span className="hidden sm:inline">ph4iry/skygazer</span>
      </a>
    </>
  );
}
