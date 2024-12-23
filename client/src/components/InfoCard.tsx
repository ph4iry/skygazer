import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { useState } from 'react';
import { IoClose, IoInformationCircleOutline } from 'react-icons/io5';

export default function InfoCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="hidden lg:block h-full overflow-y-auto bg-black/30 w-full lg:w-1/3 rounded-lg p-7 font-serif">
        <h1 className="text-3xl">about skygazer</h1>
        <h2 className="text-xl text-indigo-200 mt-3">what is the bortle scale?</h2>
        <p className='font-mono text-sm'>the <a href="https://en.wikipedia.org/wiki/Bortle_scale" className="underline">bortle scale</a> measures the brightness of the night sky at a specific location, ranking it on a scale from 1 (pristine dark skies) to 9 (inner-city light pollution). it helps astronomers and stargazers determine the visibility of celestial objects and the impact of artificial light.</p>
        <Image className="rounded-lg my-4" src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/How_light_pollution_affects_the_dark_night_skies_%28dark-skies%29_%28flipped_left-right%29.jpg/2880px-How_light_pollution_affects_the_dark_night_skies_%28dark-skies%29_%28flipped_left-right%29.jpg" alt="" width={640} height={360} />
        <p className="text-center italic text-xs">
          Image Credit: <a href="https://commons.wikimedia.org/wiki/File:How_light_pollution_affects_the_dark_night_skies_(dark-skies)_(flipped_left-right).jpg">ESO/P. Horálek, M. Wallner</a>, <a href="https://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>, via Wikimedia Commons
        </p>
        <h2 className="text-xl text-indigo-200 mt-3">how does skygazer find dark sites?</h2>
        <p className='font-mono text-sm'>the details can be found on the project&apos;s source on <a className='underline text-indigo-200' href="https://github.com/ph4iry/skygazer">github</a>.</p>
        <h2 className="text-xl text-indigo-200 mt-3">light pollution data attribution</h2>
        <p className="text-sm font-mono">Falchi, Fabio; Cinzano, Pierantonio; Duriscoe, Dan; Kyba, Christopher C. M.; Elvidge, Christopher D.; Baugh, Kimberly; Portnov, Boris; Rybnikova, Nataliya A.; Furgoni, Riccardo (2016): Supplement to: The New World Atlas of Artificial Night Sky Brightness. V. 1.1. GFZ Data Services. https://doi.org/10.5880/GFZ.1.4.2016.001</p>
      </div>
      <div className="block lg:hidden">
        <button onClick={() => setOpen(!open)} className="fixed bottom-12 right-6 bg-black/60 text-white p-2 rounded-full z-50">
          <IoInformationCircleOutline className="size-6" />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-black/75 backdrop-blur-md absolute top-0 left-0 z-50 h-screen w-screen px-4 py-14 font-serif">
              <div className="max-h-full overflow-y-scroll overflow-x-hidden p-4">
                <h1 className="text-3xl">about skygazer</h1>
                <h2 className="text-xl text-indigo-200 mt-3">what is the bortle scale?</h2>
                <p className='font-mono text-sm'>the <a href="https://en.wikipedia.org/wiki/Bortle_scale" className="underline">bortle scale</a> measures the brightness of the night sky at a specific location, ranking it on a scale from 1 (pristine dark skies) to 9 (inner-city light pollution). it helps astronomers and stargazers determine the visibility of celestial objects and the impact of artificial light.</p>
                <Image className="rounded-lg my-4" src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/How_light_pollution_affects_the_dark_night_skies_%28dark-skies%29_%28flipped_left-right%29.jpg/2880px-How_light_pollution_affects_the_dark_night_skies_%28dark-skies%29_%28flipped_left-right%29.jpg" alt="" width={640} height={360} />
                <p className="text-center italic text-xs">
                  Image Credit: <a href="https://commons.wikimedia.org/wiki/File:How_light_pollution_affects_the_dark_night_skies_(dark-skies)_(flipped_left-right).jpg">ESO/P. Horálek, M. Wallner</a>, <a href="https://creativecommons.org/licenses/by/4.0">CC BY 4.0</a>, via Wikimedia Commons
                </p>
                <h2 className="text-xl text-indigo-200 mt-3">how does skygazer find dark sites?</h2>
                <p className='font-mono text-sm'>the details can be found on the project&apos;s source on <a className='underline text-indigo-200' href="https://github.com/ph4iry/skygazer">github</a>.</p>
                <h2 className="text-xl text-indigo-200 mt-3">light pollution data attribution</h2>
                <p className="text-sm font-mono">Falchi, Fabio; Cinzano, Pierantonio; Duriscoe, Dan; Kyba, Christopher C. M.; Elvidge, Christopher D.; Baugh, Kimberly; Portnov, Boris; Rybnikova, Nataliya A.; Furgoni, Riccardo (2016): Supplement to: The New World Atlas of Artificial Night Sky Brightness. V. 1.1. GFZ Data Services. <a href="https://doi.org/10.5880/GFZ.1.4.2016.001" className="underline underline-offset-4 text-indigo-200">https://doi.org/10.5880/GFZ.1.4.2016.001</a></p>
              </div>
              <button onClick={() => setOpen(false)} className="fixed bottom-12 right-6 bg-indigo-800/30 text-white p-2 rounded-full">
                <IoClose className="size-6" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}