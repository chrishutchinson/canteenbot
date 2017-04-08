'use strict';

require('babel-polyfill');

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const aws = require('aws-sdk');

const S3 = new aws.S3({
  signatureVersion: 'v4',
  region: 'eu-west-1',
});

const { days } = require('../lib/helpers');

// Where to find the menus
const canteenUrl = 'http://5438cpa251hgt.co.uk';

// Capitalise a string
String.prototype.capitalise = function() {
  return this.charAt(0).toUpperCase() + this.slice(1);
};

// Format a `location` string
const formatLocation = str =>
  str.trim().toLowerCase().split(' ').map(s => s.capitalise()).join(' ');

// Format a `menu` string
const formatMenu = text =>
  text.replace(/\s\s+/g, ' ').trim().toLowerCase().capitalise();

// Strip HTML tags from a string
const stripTags = html => html.replace(/<.*?>/g, ' ');

// Strip HTML entities from a string
const stripEntities = ($, text) => $('<div>').html(text).text();

// Build menu data into a JSON object
const buildJson = (day, url, menuItems) => ({
  url,
  timestamp: new Date().toUTCString(),
  day: day.capitalise(),
  locations: menuItems,
});

// Parse menu data from a scraped HTML page
const parseMenu = $ => {
  const menuItems = [];
  const menuHtml = $('#content-wrapper div.sqs-block-content');

  const locations = $(menuHtml).find('h2');
  locations.each((i, loc) => {
    const menu = $(loc).next('h3');

    const menuObj = {
      location: formatLocation($(loc).text()),
      menu: formatMenu(stripEntities($, stripTags($(menu).html()))),
    };

    menuItems.push(menuObj);
  });

  return menuItems;
};

// Write a menu JSON object to S3
const writeToS3 = (day, data) => {
  S3.putObject(
    {
      Bucket: 'canteenbot-data',
      Key: `${day}.json`,
      ContentType: 'application/json',
      Body: JSON.stringify(data),
      ACL: 'public-read',
    },
    (err, res) => {
      if (err) console.log(`Error writing ${day} to S3:`, err);
      else console.log(`Wrote ${day} to S3`);
    }
  );
};

// Serverless entry point
module.exports.handler = (event, context, callback) => {
  days.forEach((day, i) => {
    const url = `${canteenUrl}/canteen-${day}`;
    fetch(url)
      .then(res => res.text())
      .then(html => parseMenu(cheerio.load(html)))
      .then(menuItems => buildJson(day, url, menuItems))
      .then(json => {
        // Write the current day's data
        writeToS3(day, json);

        // Numbers from 0 (Mon) to 6 (Sun)
        const today = (new Date().getDay() + 6) % 7;
        const tomorrow = (today + 1) % 7;

        // Check if we also need to write 'today' or 'tomorrow'
        if (i === today) writeToS3('today', json);
        if (i === tomorrow) writeToS3('tomorrow', json);
      });
  });
};