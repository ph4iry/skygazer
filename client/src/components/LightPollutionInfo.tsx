import { LightPollutionData, Spot } from "@/types";
import { bortleToColor, getBortleClassification } from "@/utils/bortle";
import { FiArrowUpRight } from "react-icons/fi";
import { motion, Variants } from "motion/react";

interface LightPollutionInfoProps {
  data: LightPollutionData;
  // the option the user picked; the card describes it instead of the recommended spot
  spot: Spot;
}

export default function LightPollutionInfo({ data, spot }: LightPollutionInfoProps) {
  const idealBortleDescription = getBortleClassification(spot.bortle);
  const inputBortleDescription = getBortleClassification(data.input.bortle);

  const informationVariants: Variants = {
    hidden: { opacity: 0, y: 0, height: 0 },
    // sized to its content: in the narrow right column the text wraps onto more lines
    visible: { opacity: 1, y: 10, height: 'auto', transition: { staggerChildren: 0.25 } },
  }

  const innerInformationVariants: Variants = {
    hidden: { opacity: 0, y: 0 },
    visible: { opacity: 1, y: 10, transition: { delayChildren: 0.75, staggerChildren: 0.25 } },
  }

  const innerInformationVariantsB: Variants = {
    hidden: { opacity: 0, y: 0 },
    visible: { opacity: 1, y: 10, transition: { delayChildren: 2, staggerChildren: 0.25 } },
  }

  const infoItemVariants: Variants = {
    hidden: { opacity: 0, y: 0 },
    visible: { opacity: 1, y: 10 },
  }
  return (
    <motion.div variants={informationVariants} initial="hidden" animate="visible" exit="hidden" className="pt-5 pb-6 text-left text-white font-body overflow-hidden text-xs lg:text-sm">
      <motion.h1 variants={infoItemVariants} className="text-lg lg:text-xl font-display mb-2">light pollution information</motion.h1>

      <motion.div variants={innerInformationVariants} initial="hidden" animate="visible" exit="hidden">
        <motion.p variants={infoItemVariants}>
          The sky brightness at this location is approximately:{" "}
        </motion.p>
        <motion.div variants={infoItemVariants} className={`text-sm lg:text-base font-bold ${bortleToColor(data.input.bortle)}`}>{inputBortleDescription} (Bortle {data.input.bortle})</motion.div>
      </motion.div>

      <motion.div variants={innerInformationVariantsB} initial="hidden" animate="visible" exit="hidden" className="">
        <motion.p variants={infoItemVariants} className="mt-2 pt-2 overflow-visible border-t border-white/30">
          The ideal location for stargazing near you is
          {spot.place?.name ? (
            <>
              {" "}<span className="font-bold underline underline-offset-2">{spot.place.name}</span>
              {spot.place.label && <> in {spot.place.label}</>}, at coordinates
            </>
          ) : " at coordinates"}
          <span className="block text-xl overflow-visible mt-0.5">
            {/* hovering highlights the coordinates and arrow together: white background, dark indigo text */}
            <a
              target="_blank"
              rel="noreferrer noopener"
              href={`https://www.google.com/maps/place/${spot.latitude},${spot.longitude}`}
              className="inline-flex items-center gap-1 underline underline-offset-4 rounded px-1 font-bold transition-colors hover:bg-white hover:text-indigo-950 focus-visible:bg-white focus-visible:text-indigo-950 focus-visible:outline-none"
            >
              {spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}
              <FiArrowUpRight aria-hidden className="size-[0.9em] shrink-0" />
              <span className="sr-only">(opens Google Maps in a new tab)</span>
            </a>
          </span>
          <span className="block font-bold">{spot.place && !spot.place.name && <> {spot.place.label}</>}.</span>
          {/* a block span, not a div: divs aren't allowed inside the <p> */}
          <span className="block">This site's sky brightness is approximately:{" "}</span>
        </motion.p>
        <motion.div variants={infoItemVariants} className={`text-sm lg:text-base font-bold ${bortleToColor(spot.bortle)}`}>
          {idealBortleDescription} ({spot.bortle})
        </motion.div>
      </motion.div>
    </motion.div>
  )
}