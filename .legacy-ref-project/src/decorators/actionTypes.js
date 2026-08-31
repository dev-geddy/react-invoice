export default (scope) => (types) => Object.keys(types)
  .reduce((result, type) => {
    result[type] = `${scope}/${types[type]}`;

    return result;
  }, {});
