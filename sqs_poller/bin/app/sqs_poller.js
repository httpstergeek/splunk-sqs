/**
 * Created by berniem on 1/6/16.
 */
//
// Created by berniem on 11/18/15.
//
// Licensed under the Apache License, Version 2.0 (the "License"): you may
// not use this file except in compliance with the License. You may obtain
// a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
// License for the specific language governing permissions and limitations
// under the License.
(function () {
  var splunkjs = require("splunk-sdk");
  var aws = require('aws-sdk');
  var ModularInputs = splunkjs.ModularInputs;
  var Logger = ModularInputs.Logger;
  var Event = ModularInputs.Event;
  var Scheme = ModularInputs.Scheme;
  var Argument = ModularInputs.Argument;
  var Async = splunkjs.Async;

  exports.getScheme = function () {
    var scheme = new Scheme("SQS Poller");

    scheme.description = "Streams events containing a random number.";
    scheme.useExternalValidation = true;
    scheme.useSingleInstance = false;

    scheme.args = [
      new Argument({
        name: "queueUrl",
        dataType: Argument.dataTypeString,
        description: "Queue Url as seen in AWS sqs console",
        requiredOnCreate: false,
        requiredOnEdit: false
      }),
      new Argument({
        name: "region",
        dataType: Argument.dataTypeString,
        description: "AWS region",
        requiredOnCreate: true,
        requiredOnEdit: false
      }),
      new Argument({
        name: "MaxNumberOfMessages",
        dataType: Argument.dataTypeNumber,
        description: "Maximum Number of Message to retrieve. Default 5",
        requiredOnCreate: false,
        requiredOnEdit: false
      }),
      new Argument({
        name: "VisibilityTimeout",
        dataType: Argument.dataTypeNumber,
        description: "How long we want a lock on this job in seconds. Default 60",
        requiredOnCreate: false,
        requiredOnEdit: false
      }),
      new Argument({
        name: "WaitTimeSeconds",
        dataType: Argument.dataTypeNumber,
        description: "how long should we wait for request in seconds. Default 3",
        requiredOnCreate: false,
        requiredOnEdit: false
      }),
      new Argument({
        name: "accessKeyId",
        dataType: Argument.dataTypeString,
        requiredOnCreate: true,
        requiredOnEdit: false
      }),
      new Argument({
        name: "secretAccessKey",
        dataType: Argument.dataTypeString,
        requiredOnCreate: true,
        requiredOnEdit: false
      }),
      new Argument({
        name: "handler",
        description: "Custom event handler",
        dataType: Argument.dataTypeString,
        requiredOnCreate: false,
        requiredOnEdit: false
      }),
      new Argument({
        name: "Logging",
        description: "adds more logging.  default false",
        dataType: Argument.dataTypeString,
        requiredOnCreate: false,
        requiredOnEdit: false
      })
    ];

    return scheme;
  };

  exports.streamEvents = function (name, singleInput, eventWriter, done) {
    Logger.info(name, "Starting SQS poller");
    var customHandler = singleInput.handler || '';
    var maxNumberOfMessages = Number(singleInput.MaxNumberOfMessages) || 6;
    var visibilityTimeout = Number(singleInput.VisibilityTimeout) || 60;
    var waitTimeSeconds = Number(singleInput.WaitTimeSeconds) || 3;
    var queueUrl = singleInput.queueUrl;
    var logMore = Boolean(singleInput.Logging) || false;
    var accessKeyId = singleInput.accessKeyId;
    var secretAccessKey = singleInput.secretAccessKey;
    var region = singleInput.region;
    var working = true;

    // Async loop while no errors
    Async.whilst(
      function () {
        return working;
      },
      function (done) {
        var sqsRecieverParams = {
          QueueUrl: queueUrl,
          MaxNumberOfMessages: maxNumberOfMessages,
          VisibilityTimeout: visibilityTimeout,
          WaitTimeSeconds: waitTimeSeconds
        };
        var awsCreds = {
          accessKeyId: accessKeyId,
          secretAccessKey: secretAccessKey
        };
        var awsRegion = {region: region}
        aws.config.update(awsCreds);
        aws.config.update(awsRegion);

        var sqs = new aws.SQS();

        // Retrieves message for sqs queue
        sqs.receiveMessage(sqsRecieverParams, function(err, data) {
          if(err) {
            Logger.error(name, err);
            done();
          }
          var batchDelete = {Entries: [], QueueUrl: queueUrl};
          try {

            // Verifies there are messages
            if(data.hasOwnProperty('Messages')) {
              if (logMore) {
                Logger.info(name, 'recieved ' + data.Messages.length + ' from SQS');
              }
              for (var i = 0; i < data.Messages.length; i++) {
                var message = data.Messages[i];
                var body = message.Body;

                // run custom handler. optional
                if (customHandler) {
                  body = customHandler.hanlder(body);
                }

                // Attempt to write event to Splunk
                try {
                  var curEvent = new Event({
                    source: 'aws:sqs',
                    sourcetype: queueUrl.replace(/^[^/]+\/\/([^/]+\/){2}/g , ''),
                    data: body
                  });
                  eventWriter.writeEvent(curEvent);
                  batchDelete.Entries.push({Id: message.MessageId, ReceiptHandle: message.ReceiptHandle})
                }
                catch (e) {
                  Logger.error(name, message.MessageId + ' ' + e.message);
                }
              }

              // Delete received messages from queue
              if (batchDelete.Entries) {
                sqs.deleteMessageBatch(batchDelete, function (err, data) {
                  if (err) {
                    Logger.error(name, 'sqs.deleteMessage ' + err);
                  }
                  if (logMore) {
                    Logger.info(name, 'Removing messages from queue');
                  }
                });
              }
            }
          } catch(err) {
              Logger.error(name,  err);
          }

          done();
        });
      },
      function (err) {
        Logger.error(name, err);
        done();
      }
    );
  }

  ModularInputs.execute(exports, module);
})();