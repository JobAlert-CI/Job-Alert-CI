/**
 * Nettoie les paramètres de requête avant envoi :
 * - retire undefined / null / "" (et tableaux vides)
 * - sérialise Set et Array en liste séparée par des virgules
 *   (format attendu par le backend : `filieres=info,elec`)
 * - convertit les Date en ISO 8601 (published_since / published_until)
 */
const cleanParams = (params = {}) => {
  return Object.keys(params).reduce((acc, key) => {
    const value = params[key];

    if (value === undefined || value === null || value === "") return acc;

    if (value instanceof Set) {
      const list = [...value].filter((v) => v !== undefined && v !== null && v !== "");
      if (list.length) acc[key] = list.join(",");
      return acc;
    }

    if (Array.isArray(value)) {
      const list = value.filter((v) => v !== undefined && v !== null && v !== "");
      if (list.length) acc[key] = list.join(",");
      return acc;
    }

    if (value instanceof Date) {
      acc[key] = value.toISOString();
      return acc;
    }

    acc[key] = value;
    return acc;
  }, {});
};

export { cleanParams };
