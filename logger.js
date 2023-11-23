// logger.js
const { createLogger, transports } = require("winston");
const winston = require("winston");
const { format } = require("date-fns");

const logger = createLogger();
logger.add(
  new winston.transports.Console({
    format: winston.format.simple(),
  })
);
const logs = [];

function writeToLogs(message, data) {
  let logEntry = {
    timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
    message,
    data,
  };
  logs.push(logEntry);
  console.log('Message: ' + message); // + ', Data:' + JSON.stringify(data));

  const fs = require('fs');
  // Write data to a file
  //let fileName =  process.cwd() + '/tmp/log.json';
  let fileName = '/tmp/log.json';
  let logContent = JSON.stringify(logEntry) || '{"timestamp":"2023-11-15 19:17:52", "message":"Empty logEntry, defaulted with common msg."}'
  fs.appendFile(fileName, logContent, (err) => {
    if (err) {
      logEntry = {
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        message:"Error while saving the log into " + fileName + "-" + err,
        err,
      };
      logs.push(logEntry);
      console.error("Error while saving the log into " + fileName + "-" + err);
    } else {
      // logEntry = {
      //   timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
      //   message:"Log entry is made into file " + fileName + ", Content" + logContent,
      // };
      // logs.push(logEntry);
    }
  });
}

module.exports = { writeToLogs, logs, logger };
