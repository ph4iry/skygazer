import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { IoClose } from 'react-icons/io5';

interface InfoCardProps {
  open: boolean;
  onClose: () => void;
}

// "about skygazer" as a modal over a frosted-glass backdrop
export default function InfoCard({ open, onClose }: InfoCardProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    // remember what had focus (the trigger) so it gets it back on close
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          // above leaflet's panes and controls, which go up to z-index 1000
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/30 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/20 bg-white/10 p-7 text-left text-white font-serif shadow-2xl shadow-black/40 backdrop-blur-2xl"
          >
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 rounded-full bg-white/10 p-1.5 text-white transition-colors hover:bg-white/20"
            >
              <IoClose className="size-5" />
            </button>

            <h1 id="about-title" className="text-3xl">About skygazer</h1>
            <h2 className="text-xl text-indigo-200 mt-3">What is the Bortle scale?</h2>
            <p className='font-mono text-sm'>The <a href="https://en.wikipedia.org/wiki/Bortle_scale" className="underline">Bortle scale</a> measures the brightness of the night sky at a specific location, ranking it on a scale from 1 (pristine dark skies) to 9 (inner-city light pollution). It helps astronomers and stargazers determine the visibility of celestial objects and the impact of artificial light.</p>
            <Image className="rounded-lg my-4 mx-auto" src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/How_light_pollution_affects_the_dark_night_skies_%28dark-skies%29_%28flipped_left-right%29.jpg/2880px-How_light_pollution_affects_the_dark_night_skies_%28dark-skies%29_%28flipped_left-right%29.jpg" alt="" width={640} height={360} />
            <p className="text-center italic text-xs">
              Image Credit: <a href="https://commons.wikimedia.org/wiki/File:How_light_pollution_affects_the_dark_night_skies_(dark-skies)_(flipped_left-right).jpg">ESO/P. Horálek, M. Wallner</a>, <a href="https://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>, via Wikimedia Commons
            </p>
            <h2 className="text-xl text-indigo-200 mt-3">How does skygazer find dark sites?</h2>
            <p className='font-mono text-sm'>The details can be found on the project&apos;s source on <a className='underline text-indigo-200' href="https://github.com/ph4iry/skygazer">GitHub</a>.</p>
            <h2 className="text-xl text-indigo-200 mt-3">Light pollution data attribution</h2>
            <p className="text-sm font-mono">Falchi, Fabio; Cinzano, Pierantonio; Duriscoe, Dan; Kyba, Christopher C. M.; Elvidge, Christopher D.; Baugh, Kimberly; Portnov, Boris; Rybnikova, Nataliya A.; Furgoni, Riccardo (2016): Supplement to: The New World Atlas of Artificial Night Sky Brightness. V. 1.1. GFZ Data Services. <a href="https://doi.org/10.5880/GFZ.1.4.2016.001" className="underline underline-offset-4 text-indigo-200">https://doi.org/10.5880/GFZ.1.4.2016.001</a></p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
