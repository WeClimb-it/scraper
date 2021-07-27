// FIXME: The commented items require Puppeteer but puppeteer seems to be deprecated.
// Check the whole "limitedSpa" concept.

const CollectContent = require("./operations/CollectContent"),
  OpenLinks = require("./operations/OpenLinks"),
  OpenUrls = require("./operations/OpenUrls"),
  DownloadContent = require("./operations/DownloadContent"),
  Root = require("./operations/Root"),
  // ScrollToBottom = require("./limitedSpa/ScrollToBottom"),
  // ClickButton = require("./limitedSpa/ClickButton"),
  Scraper = require("./Scraper.js");

module.exports = {
  Scraper,
  Root,
  DownloadContent,
  OpenLinks,
  OpenUrls,
  CollectContent,
  // ScrollToBottom,
  // ClickButton,
};
