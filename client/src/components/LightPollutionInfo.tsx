import { LightPollutionData, Spot } from "@/types";
import { bortleToColor, getBortleClassification } from "@/utils/bortle";
import { IoLocationSharp } from "react-icons/io5";
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
          The light pollution at your location is rated as{" "}
        </motion.p>
        <motion.div variants={infoItemVariants} className={`text-sm lg:text-base font-display italic lowercase ${bortleToColor(data.input.bortle)}`}>{data.input.bortle}: {inputBortleDescription}</motion.div>
        <motion.p variants={infoItemVariants}>on the Bortle scale.</motion.p>
      </motion.div>

      <motion.div variants={innerInformationVariantsB} initial="hidden" animate="visible" exit="hidden">
        <motion.p variants={infoItemVariants} className="mt-4">
          The ideal location for stargazing near you is
          {spot.place?.name ? (
            <>
              {" "}<span className="font-bold text-indigo-200">{spot.place.name}</span>
              {spot.place.label && <> in {spot.place.label}</>}, at
            </>
          ) : " at"}
          <span className="inline-block ml-2">
            <IoLocationSharp className="inline size-5 text-red-300 mr-1" />
            <a target="_blank" rel="noreferrer noopener" href={`https://www.google.com/maps/place/${spot.latitude},${spot.longitude}`} className="font-bold underline underline-offset-4 transition hover:text-indigo-300">
              {spot.latitude.toFixed(4)}, {spot.longitude.toFixed(4)}
            </a>
          </span>
          {spot.place && !spot.place.name && <> {spot.place.label}</>}
          . This location is rated as{" "}
        </motion.p>
        <motion.div variants={infoItemVariants} className={`text-sm lg:text-base font-display italic lowercase ${bortleToColor(spot.bortle)}`}>
          {spot.bortle}: {idealBortleDescription}
        </motion.div>
        <motion.p variants={infoItemVariants}>on the Bortle scale.</motion.p>
      </motion.div>
    </motion.div>
  )
}