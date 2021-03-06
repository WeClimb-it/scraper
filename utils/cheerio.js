/**
 *
 * @param {Cheerio} $
 * @param {string} baseSiteUrl
 */
function getBaseUrlFromBaseTag($, baseSiteUrl) {
  let baseMetaTag = $("base");

  // debugger;
  if (baseMetaTag.length == 0 || baseMetaTag.length > 1) {
    baseMetaTag = null;
  } else {
    baseMetaTag = baseMetaTag[0];
    var baseUrlFromBaseTag = baseMetaTag.attribs.href || null;
  }

  if (baseUrlFromBaseTag) {
    if (baseUrlFromBaseTag === "/") {
      baseUrlFromBaseTag = baseSiteUrl;
    }
  }

  return baseUrlFromBaseTag;
}

/**
 *
 * @param {Cheerio} $
 * @param {string} querySelector
 * @param {object} [config]
 * @param {Array | number} [config.slice]
 */
function createNodeList($, querySelector, config = {}) {
  //Gets a cheerio object and creates a nodelist.
  const { slice } = config;
  const nodeList = slice
    ? $(querySelector).slice(
        typeof slice === "number" ? slice : slice[0],
        slice[1]
      )
    : $(querySelector);

  return nodeList;
}

/**
 *
 * @param {Cheerio} $
 * @param {string} querySelector
 * @param {object} [config]
 * @param {Array | number} [config.slice]
 * @param {Function} [config.condition]
 */
async function createElementList($, querySelector, config = {}) {
  const { condition, slice } = config;
  const nodeList = Array.from(createNodeList($, querySelector, { slice }));
  const elementList = [];
  let index = 0;
  for (let node of nodeList) {
    const nodeFromCheerio = $(node);
    if (condition) {
      const shouldBeIncluded = await condition(
        nodeFromCheerio,
        index,
        nodeList
      );
      if (shouldBeIncluded) {
        elementList.push(nodeFromCheerio);
      }
    } else {
      elementList.push(nodeFromCheerio);
    }
    index++;
  }

  return elementList;
}

/**
 *
 * @param {CheerioElement} elem
 * @param {object} [config]
 * @param {boolean} [config.shouldTrim]
 * @param {string} [config.contentType]
 */
function getNodeContent(elem, config = {}) {
  const { contentType, shouldTrim } = config;
  const getText = () => (shouldTrim ? elem.text().trim() : elem.text());
  switch (contentType) {
    case "text":
      return getText();
    case "html":
      return elem.html();
    default:
      return getText();
  }
}

module.exports = {
  getBaseUrlFromBaseTag,
  createNodeList,
  createElementList,
  getNodeContent,
};
