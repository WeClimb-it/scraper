const { ReplaySubject } = require("rxjs");

const { Qyu } = require("qyu");
const fs = require("fs");
const path = require("path");
const { verifyDirectoryExists } = require("./utils/files");
const { deepSpread } = require("./utils/objects");

class Scraper {
  done = new ReplaySubject();

  isFirstRun = true;

  /**
   *
   * @param {Object} globalConfig
   * @param {string} globalConfig.startUrl
   * @param {string} globalConfig.baseSiteUrl
   * @param {boolean} [globalConfig.showConsoleLogs = true ]
   * @param {boolean} [globalConfig.cloneFiles = true ]
   * @param {boolean} [globalConfig.removeStyleAndScriptTags = true ]
   * @param {number} [globalConfig.concurrency = 3]
   * @param {number} [globalConfig.maxRetries = 5]
   * @param {number} [globalConfig.delay = 200]
   * @param {number} [globalConfig.timeout = 6000]
   * @param {string} [globalConfig.filePath= null]
   * @param {Object} [globalConfig.auth = null]
   * @param {Object} [globalConfig.headers = {}]
   * @param {string} [globalConfig.proxy = null]
   */
  constructor(globalConfig) {
    //Default config
    this.config = {
      cloneFiles: true, // If an image with the same name exists, a new file with a number appended to it is created. Otherwise. it's overwritten.
      removeStyleAndScriptTags: true,
      validatePageFunc: null, // Custom func to validate the page before running the operations; receives the cheerio instance and the html string.
      concurrency: 3, //Maximum concurrent requests.
      maxRetries: 5, //Maximum number of retries of a failed request.
      errorCodesToSkip: [], // HTTP codes that do not cause a retry.
      startUrl: "",
      baseSiteUrl: "",
      delay: 200,
      timeout: 6000,
      filePath: null, //Needs to be provided only if a DownloadContent operation is created.
      auth: null,
      headers: {},
      proxy: null,
      showConsoleLogs: true,
      usePuppeteer: false, //Deprecated
    };

    this.state = {
      failedScrapingIterations: [],
      downloadedFiles: 0,
      currentlyRunning: 0,
      registeredOperations: [], //Holds a reference to each created operation.
      numRequests: 0,
      repetitionCycles: 0,
    };

    this.validateGlobalConfig(globalConfig);
    deepSpread(this.config, globalConfig);

    this.config.errorCodesToSkip = [
      404,
      403,
      400,
      ...this.config.errorCodesToSkip,
    ];

    this.qyu = new Qyu({ concurrency: this.config.concurrency }); //Creates an instance of the task-qyu for the requests.
    this.requestSpacer = Promise.resolve();

    if (this.config.usePuppeteer) {
      throw new Error(
        "usePuppeteer is deprecated since version 5. If you need it, downgrade to version 4.2.2"
      );
    }
  }

  registerOperation(Operation) {
    this.state.registeredOperations.push(Operation);
  }

  destroy() {
    this.log(
      "Scraper.destroy() is deprecated. You can now have multiple instances, without calling this method."
    );
  }

  validateGlobalConfig(conf) {
    if (!conf || typeof conf !== "object")
      throw "Scraper constructor expects a configuration object";

    if (!conf.baseSiteUrl || !conf.startUrl)
      throw "Please provide both baseSiteUrl and startUrl";
  }

  /**
   * Starts the recursive scraping process. Expects a reference to the root operation.
   * @param {Root} rootObject
   * @return {Promise<void>}
   */
  async scrape(rootObject) {
    if (!rootObject || rootObject.constructor.name !== "Root")
      throw "Scraper.scrape() expects a Root object as an argument!";

    rootObject.injectScraper(this);

    await rootObject.scrape();

    this.complete();
  }

  /**
   *
   * @param {Root} newRootObject
   */
  indefiniteScrape(rootObject, success, error) {
    if (!rootObject || rootObject.constructor.name !== "Root")
      throw "Scraper.scrape() expects a Root object as an argument!";

    rootObject.injectScraper(this);

    rootObject
      .scrape(this.isFirstRun)
      .then(() => {
        if (typeof success === "function") {
          success(rootObject.getData());
        }
      })
      .catch((reason) => {
        if (typeof error === "function") {
          error(reason);
        }
      })
      .finally(() => {
        if (this.state.currentlyRunning === 0) {
          this.complete();
        }
      });

    this.isFirstRun = false;
  }

  /**
   * @return {boolean}
   */
  areThereRepeatableErrors() {
    return this.state.failedScrapingIterations.length > 0;
  }

  /**
   *
   * @param {string} errorString
   * @return {void}
   */
  reportFailedScrapingAction(errorString) {
    this.state.failedScrapingIterations.push(errorString);
  }

  /**
   *
   */
  async complete() {
    this.done.next();

    if (this.config.logPath) {
      try {
        await this.createLogs();
      } catch (error) {
        this.log("Error creating logs", error);
      }
    }

    const logMessage = this.areThereRepeatableErrors()
      ? `Number of requests that failed, in their last attempt: ${this.state.failedScrapingIterations.length}`
      : "All done, no final errors";

    this.log(logMessage);
    this.log(`Overall files:  ${this.state.downloadedFiles}`);
  }

  /**
   *
   * @param {Object} data
   * @param {string} fileName
   * @return {Promise<void>}
   */
  saveFile(data, fileName) {
    return new Promise(async (resolve, reject) => {
      verifyDirectoryExists(this.config.logPath);

      fs.writeFile(
        path.join(this.config.logPath, `${fileName}.json`),
        JSON.stringify(data),
        (error) => {
          if (error) {
            reject(error);
          } else {
            this.log(`Log file ${fileName} saved`);
            resolve();
          }
        }
      );
    });
  }

  /**
   * @return {Promise<void>}
   */
  async createLogs() {
    for (let operation of this.state.registeredOperations) {
      const fileName =
        operation.constructor.name === "Root" ? "log" : operation.config.name;
      const data = operation.getData();
      await this.createLog({ fileName, data });
    }

    await this.createLog({
      fileName: "finalErrors",
      data: this.state.failedScrapingIterations,
    });
  }

  /**
   *
   * @param {Object} obj
   * @param {string} obj.fileName
   * @param {ScrapingAction | ScrapingAction[]} obj.data
   */
  async createLog(obj) {
    await this.saveFile(obj.data, obj.fileName);
  }

  log(message) {
    if (this.config.showConsoleLogs) {
      console.log(message);
    }
  }
}

module.exports = Scraper;
