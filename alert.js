const rp = require('request-promise');
const cheerio = require('cheerio');
const chalk = require('chalk');
const url = 'https://www.facebook.com/groups/startupkc?sorting_setting=CHRONOLOGICAL';
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
const el = 'div[data-ad-preview="message"]';

const wait = (async (ms) => {
  return new Promise(resolve => {
    setTimeout(() => resolve(), ms)
  });
});

const setup = (async () => {
  browser = await puppeteer.launch({ headless: true });
  page =  await browser.newPage();
  context = browser.defaultBrowserContext();
  context.overridePermissions("https://www.facebook.com", []);
  await page.setDefaultNavigationTimeout(100000);
  await page.setViewport({ width: 1200, height: 800 });
});

const login = (async () => {
  await page.goto("https://www.facebook.com/login", { waitUntil: "networkidle2" });
  await page.type("#email", config.username, { delay: 30 })
  await page.type("#pass", config.password, { delay: 30 })
  await page.click("#loginbutton");
  await page.waitForNavigation({ waitUntil: "networkidle0" });
  console.log("logging in... one moment");
  await page.waitFor(15000);
  await page.waitFor('circle');
  await writeCookies();
});

const writeCookies = (async () => {
  let currentCookies = await page.cookies();
  fs.writeFileSync('./cookies.json', JSON.stringify(currentCookies));
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
      await getMessages();
    }
} catch(err){
  console.log(error(err));
}
});

const getMessages = (async () => {
  let msg = await page.$$eval(el, messages => {
    return messages.map((m) => {
      return m.textContent;
    });
  });
  console.log(msg);
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
      await page.waitForSelector(el);
      await infiniteScroll();
      await browser.close();
  }
})();
