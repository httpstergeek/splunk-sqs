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
  var utils = ModularInputs.utils;
  var events = require('events');

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
        description: "how long should we wait for a ç in seconds. Default 3",
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
      })
    ];

    return scheme;
  };

  exports.streamEvents = function (name, singleInput, eventWriter, done) {
    Logger.info(name, "Starting SQS poller");
    var eventEmitter = new events.EventEmitter();
    var MaxNumberOfMessages = Number(singleInput.MaxNumberOfMessages) || 6;
    var VisibilityTimeout = Number(singleInput.VisibilityTimeout) || 60;
    var WaitTimeSeconds = Number(singleInput.WaitTimeSeconds) || 3;
    var queueUrl = singleInput.queueUrl;
    var sqsRecieverParams = {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: MaxNumberOfMessages,
      VisibilityTimeout: VisibilityTimeout,
      WaitTimeSeconds: WaitTimeSeconds
    };
    var batchDelete = {Entries: [], QueueUrl: queueUrl};
    var awsCreds = {
      accessKeyId: singleInput.accessKeyId,
      secretAccessKey: singleInput.secretAccessKey,
    };
    var awsRegion = {region: singleInput.region}
    aws.config.update(awsCreds);
    aws.config.update(awsRegion)
    var sqs = new aws.SQS();

    sqs.receiveMessage(sqsRecieverParams, function(err, data) {
      if(err) {
        Logger.error(name, err);
        eventEmitter.emit('done');
        //return;
      }

      if (data.Messages) {
        Logger.info(name, 'recieved ' + data.Messages.length + ' from SQS')
        for (var i = 0; i < data.Messages.length; i++) {
          var message = data.Messages[i];

          try {
            var curEvent = new Event({
              stanza: name,
              source: 'aws:sqs',
              sourcetype: queueUrl.replace(/^[^/]+\/\/([^/]+\/){2}/g , ''),
              data: message.Body,
              time: JSON.parse(message.Body).timestamp
            });
            eventWriter.writeEvent(curEvent);
            batchDelete.Entries.push({Id: message.MessageId, ReceiptHandle: message.ReceiptHandle})
          }
          catch (e) {
            Logger.error(name, message.MessageId + ' ' + e.message);
          }
        }

        if (batchDelete.Entries) {
          sqs.deleteMessageBatch(batchDelete, function (err, data) {
            if (err) {
              Logger.error(name, 'sqs.deleteMessage ' + err);
            }
            else {
              Logger.info(name, 'Removing messages from queue');
            }
            eventEmitter.emit('done');
          });
        } else {
          eventEmitter.emit('done');
        }
      } else {
        Logger.info(name, 'No messages in the queue');
        eventEmitter.emit('done');
      }
    });

    eventEmitter.on('done', function() {
      Logger.info(name, 'Exiting')
      done();
    });
  };

  ModularInputs.execute(exports, module);
})();