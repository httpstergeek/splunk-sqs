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
(function() {
  var splunkjs = require("splunk-sdk");
  var aws = require('aws-sdk');
  var ModularInputs = splunkjs.ModularInputs;
  var Logger = ModularInputs.Logger;
  var Event = ModularInputs.Event;
  var Scheme = ModularInputs.Scheme;
  var Argument = ModularInputs.Argument;


  exports.getScheme = function() {
    var scheme = new Scheme("sqs poller");

    scheme.description = "Pulls events for an AWS SQS queue";
    scheme.useExternalValidation = false;
    scheme.useSingleInstance = false; // Set to false so an input can have an optional interval parameter.

    scheme.args = [
      new Argument({
        name: "queue",
        dataType: Argument.dataTypeString,
        description: "SQS queue name",
        requiredOnCreate: true,
        requiredOnEdit: false
      }),
      new Argument({
        name: "queueUrl",
        dataType: Argument.dataTypeString,
        description: "Queue Url as seen in AWS sqs console",
        requiredOnCreate: true,
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
        description: "AWS accessKeyId",
        requiredOnCreate: true,
        requiredOnEdit: false
      }),
      new Argument({
        name: "secretAccessKey",
        dataType: Argument.dataTypeString,
        description: "AWS secretAccessKey",
        requiredOnCreate: true,
        requiredOnEdit: false
      })
    ];

    return scheme;
  };

  exports.streamEvents = function(name, singleInput, eventWriter, done) {
    console.log("Starting SQS poller");
    Logger.info("Starting SQS poller");
    var queue = singleInput.queue;
    var MaxNumberOfMessages = Number(singleInput.MaxNumberOfMessages) || 6;
    var VisibilityTimeout = Number(singleInput.VisibilityTimeout) || 60;
    var WaitTimeSeconds = Number(singleInput.WaitTimeSeconds) || 3;
    var queueUrl = singleInput.queueUrl ;
    var sqsRecieverParams = {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: MaxNumberOfMessages,
      VisibilityTimeout: VisibilityTimeout,
      WaitTimeSeconds: WaitTimeSeconds
    };
    var sqsPropertyParms = {
      QueueUrl: queueUrl,
      AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
    };

    aws.config.accessKeyid = singleInput.accessKeyId;
    aws.config.secretAccessKey = singleInput.secretAccessKey ;
    aws.config.region = singleInput.region;
    var sqs = new aws.SQS();

    sqs.receiveMessage(sqsRecieverParams, function(err, data) {
      if (err) {
        console.log(err);
        Logger.info(err);
      }
      // If there are any messages to get
      if (data.Messages) {
        var messageCount = data.Messages.length;
        console.log(messageCount);
        Logger.info(messageCount);
        for (var i=0; i < messageCount; i++) {
          var message = data.Messages[i];
          var body = JSON.parse(message.Body);
          var event = new Event({
            stanza: name,
            sourcetype: 'sqs',
            data: JSON.stringify(message.Body),
            time: body.timestamp
          });
          try {
            eventWriter.writeEvent(event);
          }
          catch (e) {
            console.log(name, e.message);
            Logger.error(name, e.message);
          }

          sqs.deleteMessage({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle
          }, function(err, data) {
            if (err) {
              console.log('removeFromQueue',err);
              Logger.error('removeFromQueue',err);
            } // an error occurred
            else{
              console.log('removeFromQueue',data);
              Logger.info('removeFromQueue',data);
            }
          });
        }
        Logger.info(messageCount + 'Retrieved and forwarded');
      } else {
        var x =JSON.stringify(data)
        console.log(x);
        Logger.info(x);
        // trying to make any event
        var event = new Event({
          stanza: name,
          sourcetype: 'sqs',
          data: x
        });
        eventWriter.writeEvent(event);
      }
    });
  }
  ModularInputs.execute(exports, module);
})();