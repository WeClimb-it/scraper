/**
 * Used by composite operations(operations that contain other operations)
 * @mixin
 */
const CompositeInjectMixin = {
  // Override the original init function of Operation
  injectScraper: function (ScraperInstance) {
    this.scraper = ScraperInstance;

    ScraperInstance.registerOperation(this);

    for (let operation of this.operations) {
      operation.injectScraper(ScraperInstance);
    }

    this.validateOperationArguments();
  },
};

module.exports = CompositeInjectMixin;
