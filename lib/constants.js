'use strict';

const INDEXES = {
  users: 'users.idx',
  contacts: 'contacts.idx',
  events: 'events.idx'
};

const ELASTIC = {
  host: 'localhost',
  port: 9200
};

export {INDEXES, ELASTIC};
