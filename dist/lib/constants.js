'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var INDEXES = {
  users: 'users.idx',
  contacts: 'contacts.idx',
  events: 'events.idx',
  groups: 'groups.idx',
  resources: 'resources.idx'
};

var ELASTIC = {
  host: 'localhost',
  port: 9200
};

exports.INDEXES = INDEXES;
exports.ELASTIC = ELASTIC;
