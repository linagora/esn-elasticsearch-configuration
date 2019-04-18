'use strict';

import elasticsearch from 'elasticsearch';
import * as fs from 'fs-promise';
import * as path from 'path';
import * as q from 'q';
import * as constants from './constants';

class ElasticsearchConfiguration {

  constructor(options=constants.ELASTIC) {
    this.url = options.url ? options.url : `http://${options.host}:${options.port}`;
    this.path = options.path;
  }

  /**
   * Create alias with corresponding index
   * @param  {string} name - The name of alias which will be created
   * @param  {string} type - The type of alias which will be created (users, contacts, ...)
   *
   * @return {Promise} Resolve on success
   */
  setup(name, type) {
    const index = this._buildIndexNameByAlias(name);

    return this.createIndex(index, type)
      .then(() => this._associateAliasWithIndex(name, index));
  }

  /**
   * Instantiate an index
   * @param  {string} name the name of index which will be created
   * @param  {string} type The type of index which will be created (users, contacts, ...)
   * @return {Promise}     Resolve on success
   */
  createIndex(name, type) {
    return this._doesIndexExist(name)
      .then(indexExist => {
        if (!indexExist) {
          return this._getIndexConfiguration(type)
            .then(content => this._getClient()
              .then(esClient => q.ninvoke(esClient.indices, 'create', {
                index: name,
                type: type,
                body: content
              })));
        }
      });
  }

  /**
   * Delete index
   * @param  {string} name - The name of index which will be deleted
   *
   * @return {Promise} Resolve on success
   */
  deleteIndex(name) {
    return this._getClient()
      .then(esClient => q.ninvoke(esClient.indices, 'delete', {
        index: name
      }));
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
    const body = {
      source: { index: source },
      dest: { index: dest }
    };

    return this._getClient()
      .then(esClient => q.ninvoke(esClient, 'reindex', {
        body,
        refresh: true // https://www.elastic.co/guide/en/elasticsearch/reference/2.4/docs-reindex.html#_url_parameters_2
      }));
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
    const document = options.denormalize ? options.denormalize(options.document) : options.document;
    const id = options.getId ? options.getId(options.document) : document.id;

    return this._getClient()
      .then(esClient => q.ninvoke(esClient, 'index', {
        index: options.name,
        type: options.type,
        refresh: true, // https://www.elastic.co/guide/en/elasticsearch/reference/2.4/docs-index_.html#index-refresh
        id: id.toString(),
        body: document
      }))
      .then(() => console.log(`Successfully indexed document ${id.toString()}`));
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
   * Correct the alias. Includes:
   *  + Create alias if alias does not exist
   *  + Convert from index to alias if index already exists with the alias name
   *  + Create index if it does not exist and associate alias with index
   *
   *  This function is used as a fallback solution allows us to migrate to use alias without perform an update on each RSE instance.
   *
   * @param  {string} name The alias name
   * @param  {string} type The type of alias
   * @return {Promise}     Resolve on success
   */
  ensureIndexIsConfiguredProperly(name, type) {
    return this.createIndex(this._buildIndexNameByAlias(name), type)
      .then(() => this._doesAliasExist(name))
      .then(aliasExist => {
        if (aliasExist) {
          return this._associateAliasWithIndex(name, this._buildIndexNameByAlias(name));
        }

        // An alias cannot have the same name as an index
        return this._doesIndexExist(name)
          .then(indexExist => {
            if (indexExist) {
              return this._convertIndexToAlias(name, type);
            }
          });
      });
  }

  /**
    * Re-configure configuration for index
    *
    * @param {string} name - The name of alias
    * @param {string} type - The type of index (users, contacts, ...)
    *
    * @return {Promise} - resolve on success
    */
  reconfigure(name, type) {
    const indexName = this._buildIndexNameByAlias(name);
    const tmpIndexName = `tmp.${indexName}`;

    return this.ensureIndexIsConfiguredProperly(name, type)
      .then(() => this.createIndex(tmpIndexName, type))
      .then(() => this.reindex(indexName, tmpIndexName))
      .then(() => this._switchIndexForAlias(name, indexName, tmpIndexName))
      .then(() => this.deleteIndex(indexName))
      .then(() => this.createIndex(indexName, type))
      .then(() => this.reindex(tmpIndexName, indexName))
      .then(() => this._switchIndexForAlias(name, tmpIndexName, indexName))
      .finally(() => this.deleteIndex(tmpIndexName));
  }

  /**
    * Re-configure configuration and reindex data for index
    *
    * @param {Object}   options - The object includes:
    *                              + name: The name of alias
    *                              + type: The type of index (users, contacts, ...)
    *                              + next: The function allow to load sequence documents instead all documents at the same time
    *                              + getId: The function to get document identification
    *                              + denormalize: The function is used to denormalize a document
    * @return {Promise} - resolve on success
    */
  reindexAll(options) {
    const self = this;
    const aliasName = options.name;
    const indexName = this._buildIndexNameByAlias(aliasName);
    const tmpIndexName = `tmp.${indexName}`;
    const next = options.next;

    function _loadAndIndex(targetIndex) {
      const indexOptions = Object.assign({}, options, { name: targetIndex });

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
            .then(() => _loadAndIndex(targetIndex));
        });
    }

    return this.ensureIndexIsConfiguredProperly(aliasName, options.type)
      .then(() => this.createIndex(tmpIndexName, options.type))
      .then(() => _loadAndIndex(tmpIndexName)) // Avoid down time while reindex documents progressing
      .then(() => this._switchIndexForAlias(aliasName, indexName, tmpIndexName))
      .then(() => this.deleteIndex(indexName))
      .then(() => this.createIndex(indexName, options.type))
      .then(() => this.reindex(tmpIndexName, indexName))
      .then(() => this._switchIndexForAlias(aliasName, tmpIndexName, indexName))
      .finally(() => this.deleteIndex(tmpIndexName));
  }

  /**
   * Get the index configuration by type
   * @param  {string} type The type of index(users, events, contacts)
   * @return {Promise}     Resolve on success with the configuration of index
   */
  _getIndexConfiguration(type) {
    const configurationPath = this.path || path.join(__dirname, '../data/');
    const file = path.resolve([configurationPath, type, '.json'].join(''));

    return fs.readJSON(file);
  }

  /**
   * Get the elasticsearch client
   * @return {Promise} Resolve with a elasticsearch client
   */
  _getClient() {
    if (!this.client) {
      this.client = new elasticsearch.Client({ host: this.url });
    }

    // Check if the connection was a success
    return q.ninvoke(this.client, 'ping', { requestTimeout: 1000 })
      .then(() => this.client)
      .catch(err => {
        if (this.client) {
          this.client.close();
          this.client = null;
        }

        return q.reject(err);
      });
  }

  /**
   * Check the existence of the index
   * @param  {string}  index The index name
   * @return {Promise}       Resolve with a boolean indicating whether given index exists.
   */
  _doesIndexExist(index) {
    return this._getClient()
      .then(esClient => q.ninvoke(esClient.indices, 'exists', { index }))
      .then(([indexExist, statusCode]) => indexExist);
  }

  /**
   * Check the existence of the alias
   * @param  {string}  alias        The alias name
   * @param  {string}  [index=null] The index name to filter alias
   * @return {Promise}              Resolve with a boolean indicating whether given alias exists.
   */
  _doesAliasExist(alias, index = null) {
    return this._getClient()
      .then(esClient => q.ninvoke(esClient.indices, 'existsAlias', { name: alias, index }))
      .then(([aliasExist, statusCode]) => aliasExist);
  }

  /**
   * Associate the alias with an index
   * @param  {string} alias The alias name
   * @param  {string} index The name of index
   * @return {Promise}      Resolve on success
   */
  _associateAliasWithIndex(alias, index) {
    return this._getClient()
      .then(esClient => q.ninvoke(esClient.indices, 'putAlias', { name: alias, index }));
  }

  /**
   * Get the index which be mapped by the alias
   * @param  {string} alias The alias name
   * @return {string}       The index name which corresponding with alias
   */
  _buildIndexNameByAlias(alias) {
    return `real.${alias}`;
  }

  /**
   * Convert index to alias.
   * @param  {string} index The name of index
   * @param  {string} type  The type of index
   * @return {Promise}      Resolve on success
   */
  _convertIndexToAlias(index, type) {
    const realIndex = this._buildIndexNameByAlias(index);

    return this.createIndex(realIndex, type)
      .then(() => this.reindex(index, realIndex))
      .then(() => this.deleteIndex(index))
      .then(() => this._associateAliasWithIndex(index, realIndex));
  }

  /**
   * Switch index for alias
   * @param  {string} alias       The alias name
   * @param  {string} sourceIndex The name of source index
   * @param  {string} destIndex   The name of destination index
   * @return {Promise}            Resolve on success
   */
  _switchIndexForAlias(alias, sourceIndex, destIndex) {
    const actions = [
      { add: { index: destIndex, alias } },
      { remove: { index: sourceIndex, alias } }
    ];

    return this._getClient()
      .then(esClient => q.ninvoke(esClient.indices, 'updateAliases', { body: { actions }}));
  }
}

export default ElasticsearchConfiguration;
