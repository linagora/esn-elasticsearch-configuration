'use strict';

import commander from 'commander';
import ElasticsearchConfiguration from '../lib';
import {ELASTIC} from '../lib/constants';

commander
  .option('--host [host]', 'Elasticsearch host', ELASTIC.host)
  .option('--port [port]', 'Elasticsearch port', ELASTIC.port);

commander
  .command('index <name>')
  .description('Create <name> index')
  .action((name, cmd) => {
    let host = commander.host;
    let port = commander.port;
    let config = new ElasticsearchConfiguration({host: host, port: port});

    config.createIndex(name).then(() => {
      console.log('Index created');
    }, (err) => {
      console.log('Error', err);
    });
  });

commander.parse(process.argv);
