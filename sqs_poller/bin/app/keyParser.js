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
//
// This is an example for using a custom event handler to parse the message body of SQS message
//
// NOTE: If you are using a module not included in make sure to update node_modules directory by using the following
//       command 'npm install <node_package> --save' from within the sqs_poller/bin/app directory. This should update
//       the package.json file and install the package to node_modules.
//
// Example: npm install underscore --save

/*
 Example message
 message = {
 'timestamp': 1448406234,
 'env': 'prod'
 'app': 'lambdaFunction',
 'line': 'I am a very happy log'
 */


(function() {
  "use strict";
  var _ = require('underscore');
  var root = exports || this;

  root.customHandler = function(message) {
    message = JSON.parse(message);
    message = _.keys(message);
    return message
  };

})();

