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
    var year = 2017;

    var ranges = [];

    while (year < moment().year()) {
      ranges.push({
        from: `${year}-01-01`,
        to: `${year}-12-31`
      });

      year += 1;
    }

    ranges.push({
      from: `${year}-01-01`,
      to: moment().format('YYYY-MM-DD')
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
      headers: 'key'
    });

    ws.write(data, () => {
      callback(null, fileName);
    });
  },
  (fileName, callback) => {
    springCm.getFolder('/IS/Job Costing Dashboard/Labor Report', (err, folder) => {
      if (err) {
        return callback(err);
      }

      springCm.uploadDocument(folder, fs.createReadStream(fileName), {
        fileType: 'csv'
      }, (err) => {
        if (err) {
          return callback(err);
        }

        callback();
      });
    });
  }
], (err) => {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  process.exit(0);
})
