'use strict';

import * as request from 'request';
import * as fs from 'fs-promise';
import * as path from 'path';
import * as q from 'q';
import * as constants from './constants';

class ElasticsearchConfiguration {

  constructor(options=constants.ELASTIC) {
    this.options = options;
  }

  getIndexUrl(name) {
    return `http://${this.options.host}:${this.options.port}/${name}.idx`;
  }

  getIndexConfiguration(name) {
    let p = this.options.path || path.join(__dirname, '../data/');
    let file = path.resolve([p, name, '.json'].join(''));

    return fs.readJSON(file);
  }

  createIndex(name) {
    var defer = q.defer();

    this.getIndexConfiguration(name).then((content) => {
      request.post({
        url: this.getIndexUrl(name),
        json: true,
        body: content
      }, (err, response, body) => {
        if (err) {
          return defer.reject(err);
        }

        if (response.statusCode !== 200) {
          console.error(response && response.body && response.body.error);

          return defer.reject(new Error('Wrong response from Elasticsearch'));
        }

        return defer.resolve(body);
      });
    }, (err) => {
      return defer.reject('Can not read configuration file for index ' + name);
    });

    return defer.promise;
  }
}

export default ElasticsearchConfiguration;
