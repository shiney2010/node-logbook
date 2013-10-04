
var printer = require("../printer");
var _ = require("lodash");
var util = require('util');
var request = require('request');
var queue = [];
var config = {};
var os = require("os");
var hostname = os.hostname();
var urlTemplate = 'https://logs-01.loggly.com/inputs/%s/tag/%s/';

exports.defaults = {
  enabled: false,
  customerToken: null,
  maxSockets: 10,
  machineName: false,
  tags: null,
  meta: null,
  log: true,
  err: true
};
_.defaults(config, exports.defaults);

exports.status = {
  enabled: false,
  log: false,
  err: false,
  sent: 0,
  confirmed: 0
};

exports.configure = function(c) {
  _.extend(config, c);

  if(!config.enabled)
    return;
  if(!config.customerToken)
    return printer.fatal("Loggly 'customerToken' not set");
  if(config.tags && !(config.tags instanceof Array))
    return printer.fatal("Loggly 'tags' must be an array");
  if(config.meta && typeof config.meta !== "object")
    return printer.fatal("Loggly 'meta' must be an object");

  printer.info('loggly enabled (token: ' + config.customerToken + ')');

  _.extend(exports.status, _.pick(config, 'enabled', 'log', 'err'));
};

//evalutate functions in json objects
var evaluator = function(k,v) {
  if(typeof v === 'function') {
    v = v();
    if(v && typeof v.toString === 'function')
      return v.toString();
    else
      return undefined;
  }
  return v;
};

exports.send = function(type, buffer) {
  var msg = {
    date: Date.now(),
    type: type,
    msg: printer.stripColors(buffer)
  };

  if(config.machineName)
    msg.machineName = hostname;

  if(config.meta)
    _.defaults(msg, config.meta);

  var tags = config.tags ? config.tags.slice() : [];
  tags.push(type);
  tags = tags.map(function(v) {
    return evaluator(null, v);
  });

  var url = util.format(urlTemplate, config.customerToken, tags.join(','));

  msg = JSON.stringify(msg, evaluator);

  exports.status.sent++;
  // var id = exports.status.sent;

  request.post({
    pool: { maxSockets: config.maxSockets },
    // url: url,
    url: 'http://localhost:4000',
    headers: { 'Content-Type': 'application/json' },
    body: msg
  }, function (err, res, body) {
    if(err)
      printer.fatal('loggly http error: ' + err + "\n");
    else if (res.statusCode !== 200)
      printer.fatal('loggly error: ' + res.statusCode + ': ' + body + "\n");
    else
      exports.status.confirmed++;

    // printer.log('confirmed:'+exports.status.confirmed+"("+id+")\n");
    // printer.log(util.inspect(res, {colors:true, depth:0})+"\n");
  });
};




