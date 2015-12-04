# splunk-sqs
AWS sqs collector for Splunk

# Setup

1. [Clone the SDK from Github](https://github.com/httpstergeek/splunk-sqs).
* Copy the full `splunk-sqs/sqs_poller` folder to `$SPLUNK_HOME/etc/apps`.
* Navigate to `$SPLUNK_HOME/etc/apps/sqs_poller/bin/apps` Run `npm install`.
* Restart Splunk

OR 

Download from apps.splunk.com


# Adding an input
1. From Splunk Home, click the Settings menu. Under **Data**, click **Data inputs**, and find `SQS`, the input you just added. **Click Add new on that row**.
* Click **Add new** and fill in:
    * `queueUrl` (SQS queue URL. example https://sqs.us-west-1.amazonaws.com/84354864321/mySQS)
    * `region` (AWS region)
    * `accessKeyId` (accessKeyId for account. example AIIMOFM3VBOHOPU2A)
    * `secretAccessKey` (secretAccessKey for account. example eP6CfTUCP6apPajPpJ452Id9Ffc7zlUZz8zr)
    * `MaxNumberOfMessages` (MaxNumberOfMessages to retrieve from queue defaults to 3 max is 10)
    * `VisibilityTimeout` (VisibilityTimeout the duration in seconds that the received messages are hidden from subsequent retrieve requests after being retrieved by a ReceiveMessage request)
    * `sleepTime` (sleepTime is the duration to sleep while queue is empty. defauts to 1 second)
    * `WaitTimeSeconds` (WaitTimeSeconds the duration (in seconds) for which the call will wait for a message to arrive in the queue before returning. If a message is available, the call will return sooner than WaitTimeSeconds)
    * (optional) `interval` (How many second between scheduling)
* Save your input, and navigate back to Splunk Home.
