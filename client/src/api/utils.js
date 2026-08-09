
const cleanParams = (params = {}) => {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .reduce((acc, key) => {
      const value = params[key]
      if (value instanceof Set) {
        acc[key] = [...value].join(",")
      } else if (Array.isArray(value)) {
        acc[key] = value.join(",")
      } else {
        acc[key] = value
      }
      return acc;
    }, {});
};

export {cleanParams}