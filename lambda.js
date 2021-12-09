const awsServerlessExpres = require("aws-serverless-express");
const app = require("./app.js");

const server = awsServerlessExpres.createServer(app);

module.exports.universal = (event, context) =>
  awsServerlessExpres.proxy(server, event, context);
