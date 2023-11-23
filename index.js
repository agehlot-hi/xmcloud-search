require("dotenv").config();
const cors = require("cors");
const express = require("express");
const webhookData = require("./webhookAPI/helper");
const axios = require("axios");
const { logger, logs, writeToLogs } = require("./logger");
const { format } = require("date-fns");

const schedule = require('node-schedule');

const PORT = process.env.PORT;
const WEBHOOK_BEARER_TOKEN = process.env.WEBHOOK_BEARER_TOKEN;
const WEBHOOK_PUSH_API_ENDPOINT = process.env.WEBHOOK_PUSH_API_ENDPOINT;
const payload = [];
const firstPayload = [];
const app = express();
app.use(cors());
app.use(express.json());

// Middleware to authenticate the token
function authenticateToken(req, res, next) {
  try {
    const authHeader = req?.headers["authorization"];
    const token = req?.query?.token || authHeader?.split(" ")?.[1];
    if (token == null) {
      return res
        .status(401)
        .json({ message: "Missing Authentication Credentials" });
    }
    if (token === WEBHOOK_BEARER_TOKEN) {
      next();
    } else {
      logger.error("Invalid Authentication Credentials");
      return res
        .status(401)
        .json({ message: "Invalid Authentication Credentials" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

//Add a scheduler to process the files, It runs every 2 mins.
//const scheduledTask = schedule.scheduleJob('0 */2 * ? * *', async (req) => {
const scheduledTask = schedule.scheduleJob('*/2 * * * *', async (req) => {
  let response = await callSeachPushAPI(req);
});

app.post("/webhook", authenticateToken, async (req, res) => {
  const fs = require('fs');
  // Write data to a file
  //let fileName = process.cwd() + '/data/payload_'+Date.now()+'.json';
  let fileName = '/tmp/payload_' + Date.now() + '.json';
  fs.writeFile(fileName, JSON.stringify(req?.body), (err) => {
    if (err) {
      console.error(err);
      writeToLogs("Incoming payload error:", err);
      res.status(500).json({ message: err });
    } else {
      writeToLogs('The file was saved: ' + fileName);
      res.status(200).json({ message: 'Request Received' });
    }
  });
});

app.post("/push", authenticateToken, async (req, res) => {
  //const path = require('path');
  const fs = require('fs');
  //const directoryPath = "/tmp";

  let filteredFiles = [];

  try {
    let files = [];
    files = fs.readdirSync("/tmp", { withFileTypes: true }).filter(file => !file.isDirectory()).map(item => item.name);
    filteredFiles = files?.filter(x => x.startsWith('payload'));
    //handling error
    if (files?.length <= 0 || filteredFiles?.length <= 0) {
      writeToLogs('No files to process:');
      return res.status(200).json({ Result: "No files to process:" });
    }
  } catch (err) {
    writeToLogs('Error while reading paylaod file: Error:' + err + ', Error Obj' + JSON.stringify(err))
  }

  //Process first file, next will be processed in next execution
  //filteredFiles.length = 1;
  allItemCount = 0;
  let itemToBeProcessed = [];
  filteredFiles?.forEach(async function (file) {
    let filePath = '/tmp/' + file;
    //writeToLogs('Reading the payload file: ' + filePath);
    try {
      let dataJsonObject = JSON.parse(fs.readFileSync(filePath).toString());
      allItemCount = allItemCount + dataJsonObject?.updates?.length || 0;
      itemToBeProcessed.push(dataJsonObject?.updates?.filter((item) => item?.entity_definition == 'Item')?.filter((item) => item?.entity_culture == 'en-US'));
    }
    catch (err) {
      writeToLogs("Error while reading the log file:" + filePath);
    }
  })

  itemToBeProcessed = itemToBeProcessed.flat();
  let finalLog = 'Files:' + filteredFiles.toString() + ', Original Count:' + allItemCount + ' Filtered Count:' + itemToBeProcessed?.length;

  //Call GraphQL to get full item detail and process
  //const outgoingPayload = await webhookData.pullAndFormatItemDetails(itemToBeProcessed);
  const outgoingPayload = await webhookData.pullAndFormatItemDetailsInBatch(itemToBeProcessed);

  if (outgoingPayload == null || typeof outgoingPayload == 'undefined' || outgoingPayload?.error != null) {
    writeToLogs('Error while preaparing payload: ' + finalLog + ', Error:' + JSON.stringify(outgoingPayload));
    return res.status(500).json({ Result: 'GraphQL Service failed, try again later.' });
  }
  //writeToLogs('Prepared payload : ' + file + ', Templated Count:' + outgoingPayload?.length);

  //Push to Sitecore Search
  //let response = await webhookData.postDataToSearchServer(outgoingPayload);
  let templatedCount = outgoingPayload?.length;
  let response = await webhookData.postDataToSearchServerInBatch(outgoingPayload);
  if (response == null || typeof response == 'undefined' || response?.error != null || response.length <= 0) {
    writeToLogs('Error while posting to Search: ' + finalLog + ', Templated Count:' + templatedCount + ', Response:' + response + ', ResponseString:' + JSON.stringify(response) + ', Error:' + response?.error);
    return res.status(500).json({ Result: 'Search Service failed, try again later.' });
  }

  let enqueuedCount = 0;
  try {
    enqueuedCount = response?.filter(x => x != null && x.enqueued === true)?.length
    // Delete File after processing
    if (enqueuedCount > 0) {
      filteredFiles?.forEach(async function (file) {
        let filePath = '/tmp/' + file;
        fs.unlink(filePath, async (err) => {
          if (err) {
            finalLog = finalLog + ', Unable to delete file: ' + filePath + ', Error:' + JSON.stringify(err)
            //writeToLogs('Unable to delete file: ' + filePath + ', Error:' + JSON.stringify(err));
          } else {
            //deleteLog = "File deleted successfully";
            //writeToLogs('Deleting file: ' + filePath);
          }
        });
      })
      finalLog = 'Items enqueued successfully: ' + finalLog + ', Templated Count:' + templatedCount + ', Records Enqueued: ' + enqueuedCount + ', Deleting file: ' + filteredFiles.toString();
      //writeToLogs('Items enqueued successfully: ' + finalLog + ', Templated Count:' + templatedCount + ', Records Enqueued: ' + enqueuedCount + ', Deleting file: ' + filteredFiles.toString());
    }
  } catch (error) {
    finalLog = 'Error on getting enqueued, ' + finalLog + ', Response:' + response + ', ResponseString:' + JSON.stringify(response) + ', Response Error:' + response?.error + ', Error:' + error
    //writeToLogs('Error on getting enqueued, ' + finalLog + ', Response:' + response + ', ResponseString:' + JSON.stringify(response) + ', Response Error:' + response?.error + ', Error:' + error);
  }
  writeToLogs(finalLog);
  return res.status(200).json({ Result: finalLog });
});

//scheduler will call this api on every 5 mins.
async function callSeachPushAPI(req) {
  //writeToLogs("Scheduler started at: " + new Date().toLocaleTimeString());

  let pushAPIEndpoint = WEBHOOK_PUSH_API_ENDPOINT;
  let authToken = WEBHOOK_BEARER_TOKEN;

  try {
    const response = await axios.post(pushAPIEndpoint, req?.body, {
      headers: {
        authorization: `Bearer ${authToken}`,
      },
    });
    return response;
  } catch (error) {
    writeToLogs('Scheduler: Error while calling Search Push API:' + pushAPIEndpoint + ', authToken:' + authToken + ', Error:' + JSON.stringify(error));
    return error;
  }
}

app.use(express.static("logs"));

app.get("/logs", (req, res) => {
  res.json(logs);
});

app.get("/log", (req, res) => {
  const fs = require('fs');
  let fileName = '/tmp/log.json';
  let logFileContent = "";
  try {
    logFileContent = fs.readFileSync(fileName).toString();
  }
  catch (err) {
    writeToLogs("Error while reading the log file:" + fileName);
  }
  res.json(logFileContent);
});

app.get("/dir", (req, res) => {
  const fs = require('fs');
  let files = fs.readdirSync("/tmp", { withFileTypes: true }).filter(file => !file.isDirectory()).map(item => item.name);
  res.json(JSON.stringify(files));
});

app.listen(PORT, () => {
  console.log(`Server Started at ${PORT}`);
});
