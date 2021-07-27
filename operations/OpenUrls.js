const HttpOperation = require("./HttpOperation");
const CompositeInjectMixin = require("./mixins/CompositeInjectMixin");
const CompositeScrapeMixin = require("./mixins/CompositeScrapeMixin");
const Operation = require("./Operation");
const PageHelper = require("./helpers/PageHelper");
const { mapPromisesWithLimitation } = require("../utils/concurrency");

/**
 * Receives a list of arbitrary URLs and scrapes them.
 * @mixes CompositeInjectMixin
 * @mixes CompositeScrapeMixin
 */
class OpenUrls extends HttpOperation {
  /**
   *
   * @param {string[]} urls list of URLs to scrape
   * @param {Object} [config]
   * @param {string} [config.name = 'Default OpenLinks name']
   * @param {Object} [config.pagination = null] Look at the pagination API for more details.
   * @param {number[]} [config.slice = null]
   * @param {Function} [config.condition = null] Receives a Cheerio node.  Use this hook to decide if this node should be included in the scraping. Return true or false
   * @param {Function} [config.getElementList = null] Receives an elementList array
   * @param {Function} [config.getPageData = null]
   * @param {Function} [config.getPageObject = null] Receives a dictionary of children, and an address argument
   * @param {Function} [config.getPageResponse = null] Receives an axiosResponse object
   * @param {Function} [config.getPageHtml = null] Receives htmlString and pageAddress
   * @param {Function} [config.getException = null] Listens to every exception. Receives the Error object.
   * @param {(href: string) => string} [config.transformHref = undefined] Callback that receives the href before it is opened.
   *
   */
  constructor(urls, config) {
    super(config);

    this.pageHelper = null;
    this.operations = [];
    this.urls = urls;

    this.transformHref =
      typeof config === "object" && typeof config.transformHref === "function"
        ? config.transformHref
        : (href) => href;
  }

  /**
   *
   * @param {Operation} Operation
   */
  addOperation(Operation) {
    this.operations.push(Operation);
  }

  initPageHelper() {
    this.pageHelper = new PageHelper(this);
  }

  validateOperationArguments() {
    if (!this.urls || typeof this.urls !== "object")
      throw new Error(
        `OpenUrls operation must be provided with a list of URLs.`
      );
  }

  /**
   *
   * @return {Promise<{type:string,name:string,data:[]}>}
   */
  async scrape() {
    if (!this.pageHelper) this.initPageHelper();

    const refs = this.urls;

    // Checks if the current page operation has any other page operations in it. If so, will force concurrency limitation.
    const hasPendingOperation =
      this.operations.filter((child) => child.constructor.name === "OpenUrls")
        .length > 0;

    let forceConcurrencyLimit = false;
    if (hasPendingOperation) {
      forceConcurrencyLimit = 3;
    }

    const shouldPaginate = this.config.pagination ? true : false;
    const iterations = [];

    await mapPromisesWithLimitation(
      refs,
      async (href) => {
        const data = await this.pageHelper.processOneIteration(
          this.transformHref(href),
          shouldPaginate
        );

        if (this.config.getPageData) await this.config.getPageData(data);

        iterations.push(data);
      },
      forceConcurrencyLimit
        ? forceConcurrencyLimit
        : this.scraper.config.concurrency
    );

    this.data.push(...iterations);

    return {
      type: this.constructor.name,
      name: this.config.name,
      data: iterations,
    };
  }
}

Object.assign(OpenUrls.prototype, CompositeInjectMixin);
Object.assign(OpenUrls.prototype, CompositeScrapeMixin);

module.exports = OpenUrls;
