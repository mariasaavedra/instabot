/* 
  author: Maria Saavedra
  website: www.msaavedra.com
  date: 09/04/2020
*/
const rp = require('request-promise');
const cheerio = require('cheerio');
const chalk = require('chalk');
const tag = "beer";
const hostname = "https://www.instagram.com"
const url = hostname + '/explore/tags/' + tag;
const puppeteer = require('puppeteer');
const fs = require('fs');
const error = chalk.bold.red;
const success = chalk.keyword("green");
const config = require('./config.json');
const cookies = require('./cookies.json');
let page;
let browser;
let context;
const duration = 1000; 
const el = 'svg[aria-label="Like"]';

/* 
@TODO:
- Add start and end time for liking i.e 6AM - 6PM. 
- Make bot take a break every X hours. 
- Store instagram profiles, and already liked posts in a db.
- Create simple UI to control these variables. 
- Add multiple tags.
- Add interactions per day limit.
*/
let dailyLimit = 100;
let tags = [];
let breakDuration = 0;
let startTime = "";
let endTime = "";

const wait = (async (ms) => {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms)
  });
});

const setup = (async () => {
  browser = await puppeteer.launch({ headless: true });
  page =  await browser.newPage();
  context = browser.defaultBrowserContext();
  context.overridePermissions(hostname, []);
  await page.setDefaultNavigationTimeout(100000);
  await page.setViewport({ width: 1200, height: 800 });
});

const login = (async () => {
  await page.goto(hostname, { waitUntil: "networkidle2" });
  await page.type("input[name='username']", config.username, { delay: 30 })
  await page.type("input[name='password']", config.password, { delay: 30 })
  await page.click("button[type='submit']");
  await page.waitForNavigation({ waitUntil: "networkidle0" });
  console.log("logging in... one moment");
  await page.waitFor(15000);
  await writeCookies();
});

const writeCookies = (async () => {
  let currentCookies = await page.cookies();
  fs.writeFileSync('./cookies.json', JSON.stringify(currentCookies));
});

const likePost = (async () => {
  await page.waitFor(el);
  await page.click(el);
});

const getViewportHeight = (async () => {
  let bodyHandle = await page.$('body');
  let { height } = await bodyHandle.boundingBox();
  await bodyHandle.dispose();
  return height;
});

const infiniteScroll = (async () => {
  let viewportHeight = page.viewport().height;
  let increment = 0;
  try {
    while (increment + viewportHeight < await getViewportHeight()) {
      await page.evaluate(_viewportHeight => {
        window.scrollBy(0, (_viewportHeight) );
      }, viewportHeight);
      increment = increment + (viewportHeight);
      await wait(duration);
    }
} catch(err){
  console.log(error(err));
}
});

(async () => {
  // wait for browser setup to finish.
  await setup(); 
  // check to see if user is logged in.
  if (!Object.keys(cookies).length) {
    try {
      login();
    } catch (err) {
      console.log("failed to login");
      process.exit(0);
    }
  } else {
      // we're already logged in
      await page.setCookie(...cookies);
      await page.goto(url, { waitUntil: "networkidle2" });
      await wait(duration);

      // get all the links in the page.
      const hrefs = await page.evaluate(
        () => Array.from(
          document.querySelectorAll('a[href]'),
          a => a.getAttribute('href')
        )
      );
    
      for (let i = 0; 0 < hrefs.length; i++) {
        if (hrefs[i].includes("/p/")) {
          await page.goto(hostname + hrefs[i], { waitUntil: "networkidle2" });
          await page.waitFor(el);
          await page.click(el);
          console.log("liked post: " + hrefs[i]);
          // wait between one to sixty seconds between liking different posts.
          await wait (Math.floor(Math.random() * (60000 - 1000 + 1) + 1000)); 
        }
        // if at end of list, handle infinite scroll. 
      }
      
      console.log("task complete, browser closing.")
      await browser.close();
  }
})();
