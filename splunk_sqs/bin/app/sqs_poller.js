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
  var fs  = require('fs');
  var path = require('path');
  var splunkjs = require("splunk-sdk");
  var aws = require('aws-sdk');
  var Async = splunkjs.Async;
  var ModularInputs = splunkjs.ModularInputs;
  var Logger = ModularInputs.Logger;
  var Event = ModularInputs.Event;
  var Scheme = ModularInputs.Scheme;
  var Argument = ModularInputs.Argument;
  var utils = ModularInputs.utils;

  var SDK_UA_STRING = "splunk-sdk-javascript/1.8.0";

  // Create easy to read date format.
  function getDisplayDate(date) {
    var monthStrings = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    date = new Date(date);

    var hours = date.getHours();
    if (hours < 10) {
      hours = "0" + hours.toString();
    }
    var mins = date.getMinutes();
    if (mins < 10) {
      mins = "0" + mins.toString();
    }

    return monthStrings[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear() +
      " - " + hours + ":" + mins + " " + (date.getUTCHours() < 12 ? "AM" : "PM");
  }

  exports.getScheme = function() {
    var scheme = new Scheme("AWS SQS");

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
        description: "how long should we wait for a message in seconds. Default 3",
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
    var checkpointDir = this._inputDefinition.metadata["checkpoint_dir"];
    var queue = singleInput.queue;
    var MaxNumberOfMessages = singleInput.MaxNumberOfMessages || 5;
    var VisibilityTimeout = singleInput.VisibilityTimeout || 60;
    var WaitTimeSeconds = singleInput.WaitTimeSeconds || 3;
    var sqsRecieverParams = {
      QueueUrl: singleInput.queueUrl,
      MaxNumberOfMessages: MaxNumberOfMessages,
      VisibilityTimeout: VisibilityTimeout,
      WaitTimeSeconds: WaitTimeSeconds
    };
    var sqsPropertyParms = {
      QueueUrl: 'https://sqs.us-west-2.amazonaws.com/865776687899/mPulseSQS',
      AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible']
    };
    var queueLength;

    aws.config.accessKeyid = singleInput.accessKeyId;
    aws.config.secretAccessKey = singleInput.secretAccessKey;
    aws.config.region = singleInput.region;
    var sqs = new aws.SQS();

    var removeFromQueue = function(message) {
      sqs.deleteMessage({
        QueueUrl: sqsQueueUrl,
        ReceiptHandle: message.ReceiptHandle
      }, function(err, data) {
        // If we errored, tell us that we did
        err && console.log(err);
        Logger.error(err);
      });
    };

    function writeStream (elem, index, array) {
      var body = JSON.parse(elem.body)
      var event = new Event({
        stanza: queue,
        sourcetype: 'sqs',
        data: elem.Body,
        time: body.timestamp,
      })
      try {
        eventWriter.writeEvent(event);
        removeFromQueue(elem);
      }

    }

    sqs.getQueueAttributes(params, function(err, data) {
      if (err){
        console.log(err);
        Logger.error(err);
        done();
        return;
      }
      queueLength = data.Attributes.ApproximateNumberOfMessages;
      while (queueLength != 0) {
        sqs.receiveMessage(sqsRecieverParams, function(err, data) {
          // If there are any messages to get
          if (data.Messages) {
            var MessageCount = data.Messages.length;
            data.Messages.forEach(sendmessage);
            Logger.info(MessageCount + 'Retrieved and forwarded');
            }
          sqs.getQueueAttributes(params, function(err, data) {
            queueLength = data.Attributes.ApproximateNumberOfMessages;
          });
        });
      }
    });

  }
})();