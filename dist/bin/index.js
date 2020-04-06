'use strict';

var _commander = require('commander');

var _commander2 = _interopRequireDefault(_commander);

var _lib = require('../lib');

var _lib2 = _interopRequireDefault(_lib);

var _constants = require('../lib/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

_commander2.default.option('--host [host]', 'Elasticsearch host', _constants.ELASTIC.host).option('--port [port]', 'Elasticsearch port', _constants.ELASTIC.port);

_commander2.default.command('index <name>').description('Create <name> index').action(function (name, cmd) {
  var host = _commander2.default.host;
  var port = _commander2.default.port;
  var config = new _lib2.default({ host: host, port: port });

  config.createIndex(name).then(function () {
    console.log('Index created');
  }, function (err) {
    console.log('Error', err);
  });
});

_commander2.default.parse(process.argv);
