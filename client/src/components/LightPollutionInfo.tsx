import { LightPollutionData } from "@/types";
import { IoLocationSharp } from "react-icons/io5";
import { motion, Variants } from "motion/react";

interface LightPollutionInfoProps {
  data: LightPollutionData;
}

export default function LightPollutionInfo({ data }: LightPollutionInfoProps) {
  const getBortleClassification = (input: string | number) => {
    switch (`${input}`) {
      case '1':
        return "Excellent dark-sky site";
      case '2':
        return "Typical truly dark site";
      case '3':
        return "Rural sky";
      case '4':
        return "Rural/suburban transition";
      case '5':
        return "Suburban sky";
      case '6':
        return "Bright suburban sky";
      case '7':
        return "City sky";
      case '8-9':
        return "Inner-city sky";
      default:
        return "Unknown";
    }
  }

  const bortleToColor = (bortle: string | number) => {
    switch (`${bortle}`) {
      case '1':
        return "text-green-300";
      case '2':
        return "text-green-200";
      case '3':
        return "text-green-100";
      case '4':
        return "text-yellow-300";
      case '5':
        return "text-yellow-200";
      case '6':
        return "text-yellow-100";
      case '7':
        return "text-red-300";
      case '8-9':
        return "text-red-200";
      default:
        return "text-gray-300";
    }
  }

  const idealBortleDescription = getBortleClassification(data.bortle);
  const inputBortleDescription = getBortleClassification(data.input.bortle);

  const informationVariants: Variants = {
    hidden: { opacity: 0, y: 0, height: 0 },
    visible: { opacity: 1, y: 10, height: '20rem', transition: { staggerChildren: 0.25 } },
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
    <motion.div variants={informationVariants} initial="hidden" animate="visible" exit="hidden" className="p-6 py-8 px-4 text-white font-mono overflow-hidden text-sm lg:text-base">
      <motion.h1 variants={infoItemVariants} className="text-xl lg:text-2xl font-serif mb-2 lg:mb-4">light pollution information</motion.h1>

      <motion.div variants={innerInformationVariants} initial="hidden" animate="visible" exit="hidden">
        <motion.p variants={infoItemVariants}>
          The light pollution at your location is rated as{" "}
        </motion.p>
        <motion.div variants={infoItemVariants} className={`text-base lg:text-xl font-serif italic lowercase ${bortleToColor(data.input.bortle)}`}>{data.input.bortle}: {inputBortleDescription}</motion.div>
        <motion.p variants={infoItemVariants}>on the Bortle scale.</motion.p>
      </motion.div>

      <motion.div variants={innerInformationVariantsB} initial="hidden" animate="visible" exit="hidden">
        <motion.p variants={infoItemVariants} className="mt-4">
          The ideal location for stargazing near you is at
          <span className="inline-block ml-2">
            <IoLocationSharp className="inline size-5 text-red-300 mr-1" />
            <a target="_blank" rel="noreferrer noopener" href={`https://www.google.com/maps/place/${data.latitude},${data.longitude}`} className="font-bold underline underline-offset-4 transition hover:text-indigo-300">
              {data.latitude.toFixed(4)}, {data.longitude.toFixed(4)}
            </a>
          </span>
          . This location is rated as{" "}
        </motion.p>
        <motion.div variants={infoItemVariants} className={`text-base lg:text-xl font-serif italic lowercase ${bortleToColor(data.bortle)}`}>
          {data.bortle}: {idealBortleDescription}
        </motion.div>
        <motion.p variants={infoItemVariants}>on the Bortle scale.</motion.p>
      </motion.div>
    </motion.div>
  )
}