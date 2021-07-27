const { request } = require("../../request/request.js");
const { stripTags } = require("../../utils/html");
const { mapPromisesWithLimitation } = require("../../utils/concurrency");
const { getDictionaryKey } = require("../../utils/objects");
const { getPaginationUrls } = require("../../utils/pagination");
const cheerio = require("cheerio");

class PageHelper {
  static lastResponse = "";
  static lasResponseUrl = "";

  /**
   *
   * @param {Operation} operation
   */
  constructor(operation) {
    this.operation = operation;
  }

  /**
   *
   * @param {string} href
   * @param {boolean} shouldPaginate
   * @return {Promise<{data:[],address:string}>}
   */
  async processOneIteration(href, shouldPaginate, isFirstRun = true) {
    //Will process one scraping object, including a pagination object. Used by Root and OpenLinks.
    if (shouldPaginate) {
      //If the scraping object is actually a pagination one, a different function is called.
      return this.paginate(href);
    }

    const iteration = {
      address: href,
      data: [],
    };

    try {
      if (isFirstRun) {
        PageHelper.lastResponseUrl = href;
        PageHelper.lastResponse = await this.getPage(href);

        if (
          typeof this.operation.scraper.config.validatePageFunc ===
            "function" &&
          !this.operation.scraper.config.validatePageFunc(
            cheerio.load(PageHelper.lastResponse.data),
            PageHelper.lastResponse.data
          )
        ) {
          return iteration;
        }
      }

      await this.runAfterResponseHooks(PageHelper.lastResponse);

      const dataFromChildren = await this.operation.scrapeChildren(
        this.operation.operations,
        { html: PageHelper.lastResponse.data, url: href }
      );

      await this.runGetPageObjectHook(href, dataFromChildren);
      iteration.data = dataFromChildren;
    } catch (error) {
      const errorString = `There was an error opening page ${href}, ${error.stack}`;
      iteration.error = errorString;
      iteration.successful = false;
      this.operation.errors.push(errorString);
      this.operation.handleFailedScrapingIteration(errorString);
    } finally {
      return iteration;
    }
  }

  /**
   * Divides a given page to multiple pages.
   * @param {string} address
   * @return {Promise<string[]>} paginationUrls
   */
  async paginate(address) {
    const paginationConfig = this.operation.config.pagination;
    const paginationUrls = getPaginationUrls(address, paginationConfig);

    const dataFromChildren = [];

    await mapPromisesWithLimitation(
      paginationUrls,
      async (url) => {
        const data = await this.processOneIteration(url, false);

        dataFromChildren.push(data);
      },
      3
    ); //The argument 3 forces lower promise limitation on pagination.

    return {
      address: address,
      data: dataFromChildren,
    };
  }

  /**
   * Fetches the html of a given page.
   * @param {string} href
   * @return {Promise<string>}
   */
  async getPage(href) {
    const promiseFactory = async () => {
      await this.operation.beforePromiseFactory(`Opening page: ${href}`);

      let resp;
      try {
        if (!this.lastResponse) {
          resp = await request({
            method: "get",
            url: href,
            timeout: this.operation.scraper.config.timeout,
            auth: this.operation.scraper.config.auth,
            headers: this.operation.scraper.config.headers,
            proxy: this.operation.scraper.config.proxy,
          });

          if (this.operation.scraper.config.removeStyleAndScriptTags) {
            resp.data = stripTags(resp.data);
          }
        } else {
          resp = this.lastResponse;
        }

        if (this.operation.config.getPageHtml) {
          await this.operation.config.getPageHtml(resp.data, resp.url);
        }
      } catch (error) {
        throw error;
      } finally {
        this.operation.afterPromiseFactory();
      }

      return resp;
    };

    return await this.operation.qyuFactory(() =>
      this.operation.repeatPromiseUntilResolved(promiseFactory, href)
    );
  }

  /**
   *
   * @param {string} address
   * @param {Array} dataFromChildren
   */
  async runGetPageObjectHook(address, dataFromChildren) {
    if (this.operation.config.getPageObject) {
      const tree = {};

      for (let child of dataFromChildren) {
        const func = getDictionaryKey(child.name);
        tree[func(child.name, tree)] = child.data;
      }

      await this.operation.config.getPageObject(tree, address);
    }
  }

  /**
   *
   * @param {CustomResponse} response
   * @return {Promise<void>}
   */
  async runAfterResponseHooks(response) {
    if (this.operation.config.getPageResponse) {
      // If a "getResponse" callback was provided, it will be called
      if (typeof this.operation.config.getPageResponse !== "function")
        throw "'getPageResponse' callback must be a function";

      await this.operation.config.getPageResponse(response);
    }
  }
}

module.exports = PageHelper;
