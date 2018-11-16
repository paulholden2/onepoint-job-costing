const fs = require('fs');
const async = require('async');
const rc = require('rc');
const moment = require('moment');
const csvjson = require('csvjson');
const SpringCM = require('springcm-node-sdk');
const OnePoint = require('onepoint-node-sdk');

const config = rc('auth');

console.log(config);

var onePoint;
var springCm;

async.waterfall([
  (callback) => {
    var client = new OnePoint(config.onePoint);

    client.connect((err) => {
      if (err) {
        return callback(err);
      }

      onePoint = client;
      callback();
    });
  },
  (callback) => {
    var client = new SpringCM(config.springCm);


    client.connect((err) => {
      if (err) {
        return callback(err);
      }

      springCm = client;
      callback();
    });
  },
  (callback) => {
    var start = moment('10/01/2018', 'MM/DD/YYYY');
    var now = moment();

    // From/To ranges
    var ranges = [];

    while (true) {
      // End of month date
      var eom = start.clone().add(1, 'months').subtract(1, 'day');

      if (eom.isAfter(now)) {
        break;
      }

      ranges.push({
        from: start.format('YYYY-MM-DD'),
        to: eom.format('YYYY-MM-DD')
      });

      start.add(1, 'month');
    }

    ranges.push({
      from: start.format('YYYY-MM-DD'),
      to: now.format('YYYY-MM-DD')
    });

    var data = [];

    async.eachSeries(ranges, (range, callback) => {
      onePoint.runReport(37393044, {
        company: {
          short_name: 'STRIA'
        },
        selectors: [
          {
            name: 'PPDate',
            parameters: {
              RangeType: '2',
              FromDate: range.from,
              ToDate: range.to
            }
          }
        ]
      }, (err, report) => {
        if (err) {
          return callback(err);
        }

        console.log(`Finished pulling report from: ${range.from}, to: ${range.to}`);

        data = data.concat(report.results);
        callback();
      });
    }, (err) => {
      if (err) {
        return callback(err);
      }

      callback(null, data);
    });
  },
  (data, callback) => {
    var fileName = `./${moment().format('MM-DD-YYYY')}.csv`;
    var ws = fs.createWriteStream(fileName);
    var data = csvjson.toCSV(data, {
      delimiter: ',',
      wrap: '"',
      headers: 'key'
    });

    ws.write(data, () => {
      console.log('Combined and converted report to CSV')
      callback(null, fileName);
    });
  },
  (fileName, callback) => {
    return callback();
  },
  (fileName, callback) => {
    springCm.getFolder('/IS/Job Costing Dashboard/Labor Report', (err, folder) => {
      if (err) {
        return callback(err);
      }

      console.log('Retrieved report destination folder');

      springCm.uploadDocument(folder, fs.createReadStream(fileName), {
        fileType: 'csv'
      }, (err) => {
        if (err) {
          return callback(err);
        }

        console.log('Uploaded report to SpringCM');

        callback();
      });
    });
  }
], (err) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  console.log('Done');

  process.exit(0);
})
