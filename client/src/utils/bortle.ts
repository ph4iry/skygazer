export function getBortleClassification(input: string | number) {
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

export function bortleToColor(bortle: string | number) {
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

// accent gradient for the ranked spot options, brightest sky to darkest. `ink` is the
// text color that stays readable on top of each accent
const SKY_ACCENTS: Record<string, { color: string; ink: string; name: string }> = {
  '4': { color: '#E9C989', ink: '#192B52', name: 'warm city glow' },
  '3': { color: '#A5A9CF', ink: '#192B52', name: 'twilight lavender' },
  '2': { color: '#4F669D', ink: '#FFFFFF', name: 'dusk blue' },
  '1': { color: '#192B52', ink: '#FFFFFF', name: 'midnight navy' },
};

export function skyAccent(bortle: string | number) {
  return SKY_ACCENTS[`${bortle}`] ?? { color: '#9CA3AF', ink: '#111827', name: 'gray' };
}
