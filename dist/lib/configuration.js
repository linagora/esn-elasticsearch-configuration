'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _elasticsearch = require('elasticsearch');

var _elasticsearch2 = _interopRequireDefault(_elasticsearch);

var _fsPromise = require('fs-promise');

var fs = _interopRequireWildcard(_fsPromise);

var _path = require('path');

var path = _interopRequireWildcard(_path);

var _q = require('q');

var q = _interopRequireWildcard(_q);

var _constants = require('./constants');

var constants = _interopRequireWildcard(_constants);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ElasticsearchConfiguration = function () {
  function ElasticsearchConfiguration() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : constants.ELASTIC;

    _classCallCheck(this, ElasticsearchConfiguration);

    this.url = options.url ? options.url : 'http://' + options.host + ':' + options.port;
    this.path = options.path;
  }

  /**
   * Create alias with corresponding index
   * @param  {string} name - The name of alias which will be created
   * @param  {string} type - The type of alias which will be created (users, contacts, ...)
   *
   * @return {Promise} Resolve on success
   */


  _createClass(ElasticsearchConfiguration, [{
    key: 'setup',
    value: function setup(name, type) {
      var _this = this;

      var index = this._buildIndexNameByAlias(name);

      return this.createIndex(index, type).then(function () {
        return _this._associateAliasWithIndex(name, index);
      });
    }

    /**
     * Instantiate an index
     * @param  {string} name the name of index which will be created
     * @param  {string} type The type of index which will be created (users, contacts, ...)
     * @return {Promise}     Resolve on success
     */

  }, {
    key: 'createIndex',
    value: function createIndex(name, type) {
      var _this2 = this;

      return this._doesIndexExist(name).then(function (indexExist) {
        if (!indexExist) {
          return _this2._getIndexConfiguration(type).then(function (content) {
            return _this2._getClient().then(function (esClient) {
              return q.ninvoke(esClient.indices, 'create', {
                index: name,
                body: content
              });
            });
          });
        }
      });
    }

    /**
     * Delete index
     * @param  {string} name - The name of index which will be deleted
     *
     * @return {Promise} Resolve on success
     */

  }, {
    key: 'deleteIndex',
    value: function deleteIndex(name) {
      var _this3 = this;

      return this._doesIndexExist(name).then(function (indexExist) {
        if (indexExist) {
          return _this3._getClient().then(function (esClient) {
            return q.ninvoke(esClient.indices, 'delete', {
              index: name
            });
          });
        }
      });
    }

    /**
      * Copies documents from one index to another in elasticsearch
      *
      * @param {string} source - The name of source index
      * @param {string} dest - The name of destination index
      *
      * @return {Promise} - resolve on success
      */

  }, {
    key: 'reindex',
    value: function reindex(source, dest) {
      var body = {
        source: { index: source },
        dest: { index: dest }
      };

      return this._getClient().then(function (esClient) {
        return q.ninvoke(esClient, 'reindex', {
          body: body,
          refresh: true // https://www.elastic.co/guide/en/elasticsearch/reference/2.4/docs-reindex.html#_url_parameters_2
        });
      });
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

  }, {
    key: 'index',
    value: function index(options) {
      var document = options.denormalize ? options.denormalize(options.document) : options.document;
      var id = options.getId ? options.getId(options.document) : document.id;

      return this._getClient().then(function (esClient) {
        return q.ninvoke(esClient, 'index', {
          index: options.name,
          type: options.type,
          refresh: true, // https://www.elastic.co/guide/en/elasticsearch/reference/2.4/docs-index_.html#index-refresh
          id: id.toString(),
          body: document
        });
      }).then(function () {
        return console.log('Successfully indexed document ' + id.toString());
      });
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

  }, {
    key: 'indexDocs',
    value: function indexDocs(documents, options) {
      var _this4 = this;

      var promises = documents.map(function (doc) {
        options.document = doc;

        return _this4.index(options);
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

  }, {
    key: 'ensureIndexIsConfiguredProperly',
    value: function ensureIndexIsConfiguredProperly(name, type) {
      var _this5 = this;

      return this.createIndex(this._buildIndexNameByAlias(name), type).then(function () {
        return _this5._doesAliasExist(name);
      }).then(function (aliasExist) {
        if (aliasExist) {
          return _this5._associateAliasWithIndex(name, _this5._buildIndexNameByAlias(name));
        }

        // An alias cannot have the same name as an index
        return _this5._doesIndexExist(name).then(function (indexExist) {
          if (indexExist) {
            return _this5._convertIndexToAlias(name, type);
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

  }, {
    key: 'reconfigure',
    value: function reconfigure(name, type) {
      var _this6 = this;

      var indexName = this._buildIndexNameByAlias(name);
      var tmpIndexName = 'tmp.' + indexName;

      return this.ensureIndexIsConfiguredProperly(name, type).then(function () {
        return _this6.createIndex(tmpIndexName, type);
      }).then(function () {
        return _this6.reindex(indexName, tmpIndexName);
      }).then(function () {
        return _this6._switchIndexForAlias(name, indexName, tmpIndexName);
      }).then(function () {
        return _this6.deleteIndex(indexName);
      }).then(function () {
        return _this6.createIndex(indexName, type);
      }).then(function () {
        return _this6.reindex(tmpIndexName, indexName);
      }).then(function () {
        return _this6._switchIndexForAlias(name, tmpIndexName, indexName);
      }).finally(function () {
        return _this6.deleteIndex(tmpIndexName);
      });
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

  }, {
    key: 'reindexAll',
    value: function reindexAll(options) {
      var _this7 = this;

      var self = this;
      var aliasName = options.name;
      var indexName = this._buildIndexNameByAlias(aliasName);
      var tmpIndexName = 'tmp.' + indexName;
      var next = options.next;

      function _loadAndIndex(targetIndex) {
        var indexOptions = Object.assign({}, options, { name: targetIndex });

        return next().then(function (docs) {
          if (!docs) {
            return;
          }
          docs = Array.isArray(docs) ? docs : [docs];
          if (!docs.length) {
            return;
          }

          return self.indexDocs(docs, indexOptions).then(function () {
            return _loadAndIndex(targetIndex);
          });
        });
      }

      return this.ensureIndexIsConfiguredProperly(aliasName, options.type).then(function () {
        return _this7.createIndex(tmpIndexName, options.type);
      }).then(function () {
        return _loadAndIndex(tmpIndexName);
      }) // Avoid down time while reindex documents progressing
      .then(function () {
        return _this7._switchIndexForAlias(aliasName, indexName, tmpIndexName);
      }).then(function () {
        return _this7.deleteIndex(indexName);
      }).then(function () {
        return _this7.createIndex(indexName, options.type);
      }).then(function () {
        return _this7.reindex(tmpIndexName, indexName);
      }).then(function () {
        return _this7._switchIndexForAlias(aliasName, tmpIndexName, indexName);
      }).finally(function () {
        return _this7.deleteIndex(tmpIndexName);
      });
    }

    /**
     * Get the index configuration by type
     * @param  {string} type The type of index(users, events, contacts)
     * @return {Promise}     Resolve on success with the configuration of index
     */

  }, {
    key: '_getIndexConfiguration',
    value: function _getIndexConfiguration(type) {
      var _this8 = this;

      return this._getElasticsearchVersion().then(function (version) {
        var configurationPath = _this8.path || path.join(__dirname, '../data/' + version + '.x/');
        var file = path.resolve([configurationPath, type, '.json'].join(''));

        return fs.readJSON(file).catch(function (err) {
          if (err.code === 'ENOENT') {
            throw new Error('No "' + type + '" mapping configuration found for Elasticsearch version ' + version);
          }

          throw err;
        });
      });
    }

    /**
     * Get version of elasticsearch which client is connecting to
     * @return {Promise}     Resolve on success with the version of elasticsearch which client is connecting to
     */

  }, {
    key: '_getElasticsearchVersion',
    value: function _getElasticsearchVersion() {
      return this._getClient().then(function (esClient) {
        return q.ninvoke(esClient, 'info');
      }).then(function (_ref) {
        var _ref2 = _slicedToArray(_ref, 2),
            version = _ref2[0].version,
            statusCode = _ref2[1];

        return version.number.split('.', 1)[0];
      });
    }

    /**
     * Get the elasticsearch client
     * @return {Promise} Resolve with a elasticsearch client
     */

  }, {
    key: '_getClient',
    value: function _getClient() {
      var _this9 = this;

      if (!this.client) {
        this.client = new _elasticsearch2.default.Client({ host: this.url });
      }

      // Check if the connection was a success
      return q.ninvoke(this.client, 'ping', { requestTimeout: 1000 }).then(function () {
        return _this9.client;
      }).catch(function (err) {
        if (_this9.client) {
          _this9.client.close();
          _this9.client = null;
        }

        return q.reject(err);
      });
    }

    /**
     * Check the existence of the index
     * @param  {string}  index The index name
     * @return {Promise}       Resolve with a boolean indicating whether given index exists.
     */

  }, {
    key: '_doesIndexExist',
    value: function _doesIndexExist(index) {
      return this._getClient().then(function (esClient) {
        return q.ninvoke(esClient.indices, 'exists', { index: index });
      }).then(function (_ref3) {
        var _ref4 = _slicedToArray(_ref3, 2),
            indexExist = _ref4[0],
            statusCode = _ref4[1];

        return indexExist;
      });
    }

    /**
     * Check the existence of the alias
     * @param  {string}  alias        The alias name
     * @param  {string}  [index=null] The index name to filter alias
     * @return {Promise}              Resolve with a boolean indicating whether given alias exists.
     */

  }, {
    key: '_doesAliasExist',
    value: function _doesAliasExist(alias) {
      var index = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

      return this._getClient().then(function (esClient) {
        return q.ninvoke(esClient.indices, 'existsAlias', { name: alias, index: index });
      }).then(function (_ref5) {
        var _ref6 = _slicedToArray(_ref5, 2),
            aliasExist = _ref6[0],
            statusCode = _ref6[1];

        return aliasExist;
      });
    }

    /**
     * Associate the alias with an index
     * @param  {string} alias The alias name
     * @param  {string} index The name of index
     * @return {Promise}      Resolve on success
     */

  }, {
    key: '_associateAliasWithIndex',
    value: function _associateAliasWithIndex(alias, index) {
      return this._getClient().then(function (esClient) {
        return q.ninvoke(esClient.indices, 'putAlias', { name: alias, index: index });
      });
    }

    /**
     * Get the index which be mapped by the alias
     * @param  {string} alias The alias name
     * @return {string}       The index name which corresponding with alias
     */

  }, {
    key: '_buildIndexNameByAlias',
    value: function _buildIndexNameByAlias(alias) {
      return 'real.' + alias;
    }

    /**
     * Convert index to alias.
     * @param  {string} index The name of index
     * @param  {string} type  The type of index
     * @return {Promise}      Resolve on success
     */

  }, {
    key: '_convertIndexToAlias',
    value: function _convertIndexToAlias(index, type) {
      var _this10 = this;

      var realIndex = this._buildIndexNameByAlias(index);

      return this.createIndex(realIndex, type).then(function () {
        return _this10.reindex(index, realIndex);
      }).then(function () {
        return _this10.deleteIndex(index);
      }).then(function () {
        return _this10._associateAliasWithIndex(index, realIndex);
      });
    }

    /**
     * Switch index for alias
     * @param  {string} alias       The alias name
     * @param  {string} sourceIndex The name of source index
     * @param  {string} destIndex   The name of destination index
     * @return {Promise}            Resolve on success
     */

  }, {
    key: '_switchIndexForAlias',
    value: function _switchIndexForAlias(alias, sourceIndex, destIndex) {
      var actions = [{ add: { index: destIndex, alias: alias } }, { remove: { index: sourceIndex, alias: alias } }];

      return this._getClient().then(function (esClient) {
        return q.ninvoke(esClient.indices, 'updateAliases', { body: { actions: actions } });
      });
    }
  }]);

  return ElasticsearchConfiguration;
}();

exports.default = ElasticsearchConfiguration;
module.exports = exports['default'];
