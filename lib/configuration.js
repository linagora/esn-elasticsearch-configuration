'use strict';

import * as request from 'request';
import * as fs from 'fs-promise';
import * as path from 'path';
import * as q from 'q';
import * as constants from './constants';

class ElasticsearchConfiguration {

  constructor(options=constants.ELASTIC) {
    this.url = options.url ? `http://${options.url}` : `http://${options.host}:${options.port}`;
    this.path = options.path;
  }

  getIndexUrl(name) {
    return `${this.url}/${name}`;
  }

  getIndexConfiguration(type) {
    const configurationPath = this.path || path.join(__dirname, '../data/');
    const file = path.resolve([configurationPath, type, '.json'].join(''));

    return fs.readJSON(file);
  }

  /**
   * Create index
   * @param  {string} name - The name of index which will be created
   * @param  {string} type - The type of index which will be created (users, contacts, ...)
   *
   * @return {Promise} Resolve on success
   */
  createIndex(name, type) {
    const defer = q.defer();

    this.getIndexConfiguration(type).then(content => {
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
    }, () => {
      return defer.reject('Can not read configuration file for type ' + type);
    });

    return defer.promise;
  }

  /**
   * Delete index
   * @param  {string} name - The name of index which will be deleted
   *
   * @return {Promise} Resolve on success
   */
  deleteIndex(name) {
    const defer = q.defer();

    request.delete({
      url: this.getIndexUrl(name)
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

    return defer.promise;
  }

  /**
    * Copies documents from one index to another in elasticsearch
    *
    * @param {string} source - The name of source index
    * @param {string} dest - The name of destination index
    *
    * @return {Promise} - resolve on success
    */
  reindex(source, dest) {
    const defer = q.defer();
    const reindexUrl = `${this.url}/_reindex?refresh=true`; // https://www.elastic.co/guide/en/elasticsearch/reference/2.3/docs-reindex.html#_url_parameters_2

    request.post({
      url: reindexUrl,
      json: true,
      body: {
        source: {
          index: source
        },
        dest: {
          index: dest
        }
      }
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

    return defer.promise;
  }

  /**
   * Index document
   * @param  {Object}   options   - The object includes:
   *                              + document: The document object will be indexed
   *                              + name: The name of index
   *                              + type: The type of index (users, contacts, ...)
   *                              + getId: The function to get document identification
   *                              + denormalize: The function is used to denormalize a document
   * @return {Promise} Resolve on success
   */
  index(options) {
    const defer = q.defer();
    const document = options.denormalize ? options.denormalize(options.document) : options.document;
    const id = options.getId ? options.getId(options.document) : document.id;
    const indexUrl = `${this.url}/${options.name}/${options.type}/${id}?refresh=true`; // https://www.elastic.co/guide/en/elasticsearch/reference/2.4/docs-index_.html#index-refresh

    request.put({
      url: indexUrl,
      json: true,
      body: document
    }, (err, response, body) => {
      if (err) {
        return defer.reject(err);
      }

      if (response.statusCode !== 200 && response.statusCode !== 201) {
        console.error(response && response.body && response.body.error);

        return defer.reject(new Error('Wrong response from Elasticsearch'));
      }

      console.log(`Successfully indexed document ${id.toString()}`);

      return defer.resolve(body);
    });

    return defer.promise;
  }

  /**
   * Index multiple documents
   * @param  {Object[]} documents - The list of documents will be updated
   * @param  {Object}   options   - The object includes:
   *                              + name: The name of index
   *                              + type: The type of index (users, contacts, ...)
   *                              + getId: The function to get document identification
   *                              + denormalize: The function is used to denormalize a document
   * @return {Promise} Resolve on success
   */
  indexDocs(documents, options) {
    const promises = documents.map(doc => {
      options.document = doc;

      return this.index(options);
    });

    return q.all(promises);
  }

  /**
    * Re-configure configuration for index
    *
    * @param {string} name - The name of index
    * @param {string} type - The type of index (users, contacts, ...)
    *
    * @return {Promise} - resolve on success
    */
  reconfig(name, type) {
    const tmpName = `tmp_${name}`;

    return this.createIndex(tmpName, type)
      .then(() => this.reindex(name, tmpName))
      .then(() => this.deleteIndex(name))
      .then(() => this.createIndex(name, type))
      .then(() => this.reindex(tmpName, name))
      .finally(() => this.deleteIndex(tmpName));
  }

  /**
    * Re-configure configuration and reindex data for index
    *
    * @param {Object}   options - The object includes:
    *                              + name: The name of index
    *                              + type: The type of index (users, contacts, ...)
    *                              + next: The function allow to load sequence documents instead all documents at the same time
    *                              + getId: The function to get document identification
    *                              + denormalize: The function is used to denormalize a document
    * @return {Promise} - resolve on success
    */
  reindexAll(options) {
    const self = this;
    const name = options.name;
    const tmpName = `tmp_${name}`;
    const next = options.next;

    function _loadAndIndex(indexName) {
      const indexOptions = Object.assign({}, options, { name: indexName });

      return next()
        .then(docs => {
          if (!docs) {
            return;
          }
          docs = Array.isArray(docs) ? docs : [docs];
          if (!docs.length) {
            return;
          }

          return self.indexDocs(docs, indexOptions)
            .then(() => _loadAndIndex(indexName));
        });
    }

    return this.createIndex(tmpName, options.type)
      .then(() => _loadAndIndex(tmpName)) // Avoid down time while reindex documents progressing
      .then(() => this.deleteIndex(name))
      .then(() => this.createIndex(name, options.type))
      .then(() => this.reindex(tmpName, name))
      .finally(() => this.deleteIndex(tmpName));
  }
}

export default ElasticsearchConfiguration;
