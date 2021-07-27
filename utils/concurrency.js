const { Qyu } = require("qyu");
/**
 * Scrapes objects with concurrency limitation.
 * @param {Array} iterable
 * @param {Function} promiseFunction
 * @param {number} concurrency
 */
async function mapPromisesWithLimitation(
  iterable,
  promiseFunction,
  concurrency
) {
  const q = new Qyu({ concurrency });
  await q(iterable, promiseFunction, concurrency);
}

module.exports = {
  mapPromisesWithLimitation,
};
