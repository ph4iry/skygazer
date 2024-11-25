import "@/styles/globals.css";
import type { AppProps } from "next/app";
import React from 'react';


// const MapComponent = () => {
//   const [scriptLoaded, setScriptLoaded] = useState(false);

//   useEffect(() => {
//     const googleMapScript = loadMapApi();
//     const handleLoad = () => {
//       setScriptLoaded(true);
//     };

//     googleMapScript.addEventListener("load", handleLoad);

//     return () => {
//       googleMapScript.removeEventListener("load", handleLoad);
//     };
//   }, []);

//   return (
//     <div className="map-container">
//       {scriptLoaded ? (
//         <div id="map" style={{ width: "100%", height: "500px" }}></div>
//       ) : (
//         <p>Loading map...</p>
//       )}
//     </div>
//   );
// };

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
    </>
  );
}
