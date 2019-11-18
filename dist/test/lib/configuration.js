'use strict';

var mockery = require('mockery');
var chai = require('chai');
var q = require('q');
var expect = chai.expect;
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

describe('The configuration class', function () {
  var elasticsearchMock = void 0,
      esClientMock = void 0;
  var version = '2.3.2';

  beforeEach(function () {
    chai.use(sinonChai);
    mockery.enable({
      useCleanCache: true,
      warnOnReplace: false,
      warnOnUnregistered: false
    });

    esClientMock = {
      ping: function ping(options, callback) {
        return callback();
      },
      indices: {},
      close: function close() {},
      info: function info(callback) {
        return callback(null, [{ version: { number: version } }, 200]);
      }
    };
    elasticsearchMock = {
      Client: function Client() {
        return esClientMock;
      }
    };
  });

  afterEach(function () {
    mockery.disable();
  });

  var getConfigurationInstance = function getConfigurationInstance() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    var Configuration = require('../../lib/configuration');

    return new Configuration(options);
  };

  it('should use url option for elasticsearch url if url option is provided', function () {
    var config = getConfigurationInstance({
      url: 'http://elasticsearch:9200',
      host: 'localhost',
      port: 5455
    });

    expect(config.hosts).to.deep.equal(['http://elasticsearch:9200']);
  });

  it('should use hosts option for elasticsearch hosts if hosts option is provided', function () {
    var config = getConfigurationInstance({
      hosts: ['http://es1:9200', 'http://es2:9200'],
      host: 'localhost',
      port: 5455
    });

    expect(config.hosts).to.deep.equal(['http://es1:9200', 'http://es2:9200']);
  });

  it('should use host/port option for elasticsearch hosts if host/port option is provided', function () {
    var config = getConfigurationInstance({
      host: 'es1',
      port: 5455
    });

    expect(config.hosts).to.deep.equal(['http://es1:5455']);
  });

  describe('The _getIndexConfiguration function', function () {
    it('should load configuration from local file', function (done) {
      var name = 'contacts';

      mockery.registerMock('elasticsearch', elasticsearchMock);
      mockery.registerMock('fs-promise', {
        readJSON: function readJSON(file) {
          expect(file.indexOf(name + '.json') > 0).to.be.true;

          return q.when().then(done);
        }
      });

      var configuration = getConfigurationInstance();

      configuration._getIndexConfiguration(name).catch(done);
    });

    it('should load configuration from local file from options path', function (done) {
      var name = 'contacts';
      var options = { path: '/foo/bar/' };

      mockery.registerMock('elasticsearch', elasticsearchMock);
      mockery.registerMock('fs-promise', {
        readJSON: function readJSON(file) {
          expect(file.indexOf(options.path + name + '.json') === 0).to.be.true;

          return q.when().then(done);
        }
      });

      var configuration = getConfigurationInstance(options);

      configuration._getIndexConfiguration(name).catch(done);
    });
  });

  describe('The _getClient function', function () {
    it('should reject if failed to connect to elasticsearch', function (done) {
      var error = new Error('something wrong');

      esClientMock.ping = sinon.spy(function (options, callback) {
        return callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration._getClient().catch(function (err) {
        expect(err).to.deep.equal(error);
        expect(esClientMock.ping).to.have.been.called;
        done();
      });
    });

    it('should resolve if connect to elasticsearch is successfully', function (done) {
      esClientMock.ping = sinon.spy(function (options, callback) {
        return callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration._getClient().then(function (esClient) {
        expect(esClientMock.ping).to.have.been.called;
        expect(esClient).to.deep.equal(new elasticsearchMock.Client());
        done();
      }).catch(function (err) {
        return done(err || 'should resolve');
      });
    });
  });

  describe('The _doesIndexExist function', function () {
    it('should reject if failed to check the existence of index', function (done) {
      var error = new Error('something wrong');

      esClientMock.indices.exists = sinon.spy(function (options, callback) {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration._doesIndexExist().catch(function (err) {
        expect(err).to.deep.equal(error);
        done();
      });
    });

    it('should resolve if check the existence of index is successfully', function (done) {
      var isExist = false;

      esClientMock.indices.exists = sinon.spy(function (options, callback) {
        callback(null, [isExist, 200]);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration._doesIndexExist().then(function (result) {
        expect(result).to.equal(isExist);
        done();
      });
    });
  });

  describe('The _doesAliasExist function', function () {
    it('should reject if failed to check the existence of alias', function (done) {
      var error = new Error('something wrong');

      esClientMock.indices.existsAlias = sinon.spy(function (options, callback) {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration._doesAliasExist().catch(function (err) {
        expect(err).to.deep.equal(error);
        done();
      });
    });

    it('should resolve if check the existence of alias is successfully', function (done) {
      var isExist = false;

      esClientMock.indices.existsAlias = sinon.spy(function (options, callback) {
        callback(null, [isExist, 200]);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration._doesAliasExist().then(function (result) {
        expect(result).to.equal(isExist);
        done();
      });
    });
  });

  describe('The setup function', function () {
    var data = void 0;

    beforeEach(function () {
      data = { foo: 'bar' };

      mockery.registerMock('fs-promise', {
        readJSON: function readJSON(file) {
          return q.when(data);
        }
      });

      esClientMock.indices.exists = sinon.spy(function (options, callback) {
        callback(null, [false, 200]);
      });
    });

    it('should reject if failed to create index in elasticsearch', function (done) {
      var error = new Error('something wrong');
      var name = 'abc';
      var type = 'type';

      esClientMock.indices.create = sinon.spy(function (options, callback) {
        callback(error);
      });
      esClientMock.indices.putAlias = sinon.spy(function (options, callback) {
        callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.setup(name, type).then(function () {
        return done(new Error('should not resolve'));
      }, function (err) {
        expect(esClientMock.indices.create).to.have.been.calledWith({
          index: configuration._buildIndexNameByAlias(name),
          body: data
        });
        expect(err).to.deep.equal(error);

        done();
      }).catch(done);
    });

    it('should reject if failed to associate alias with index', function (done) {
      var error = new Error('something wrong');
      var name = 'abc';
      var type = 'type';

      esClientMock.indices.create = sinon.spy(function (options, callback) {
        callback();
      });
      esClientMock.indices.putAlias = sinon.spy(function (options, callback) {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.setup(name, type).then(function () {
        return done(new Error('should not resolve'));
      }, function (err) {
        expect(esClientMock.indices.create).to.have.been.calledWith({
          index: configuration._buildIndexNameByAlias(name),
          body: data
        });
        expect(esClientMock.indices.putAlias).to.have.been.calledWith({
          name: name,
          index: configuration._buildIndexNameByAlias(name)
        });
        expect(err).to.deep.equal(error);

        done();
      }).catch(done);
    });

    it('should resolve if create alias and corresponding index in elasticsearch is successfully', function (done) {
      var name = 'abc';
      var type = 'type';

      esClientMock.indices.create = sinon.spy(function (options, callback) {
        callback();
      });
      esClientMock.indices.putAlias = sinon.spy(function (options, callback) {
        callback();
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);

      var configuration = getConfigurationInstance();

      configuration.setup(name, type).then(function () {
        expect(esClientMock.indices.create).to.have.been.calledWith({
          index: configuration._buildIndexNameByAlias(name),
          body: data
        });
        expect(esClientMock.indices.putAlias).to.have.been.calledWith({
          name: name,
          index: configuration._buildIndexNameByAlias(name)
        });

        done();
      }).catch(done);
    });
  });

  describe('The createIndex function', function () {
    var data = void 0;

    beforeEach(function () {
      data = { foo: 'bar' };

      mockery.registerMock('fs-promise', {
        readJSON: function readJSON(file) {
          return q.when(data);
        }
      });
    });

    it('should resolve if create index in elasticsearch is successfully', function (done) {
      var type = 'type';
      var name = 'abc';

      esClientMock.indices.create = sinon.spy(function (options, callback) {
        callback();
      });
      esClientMock.indices.exists = sinon.spy(function (options, callback) {
        callback(null, [false, 200]);
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);

      var configuration = getConfigurationInstance();

      configuration.createIndex(name, type).then(function () {
        expect(esClientMock.indices.create).to.have.been.calledWith({
          index: name,
          body: data
        });

        done();
      }).catch(done);
    });

    it('should resolve if create index already exists', function (done) {
      var type = 'type';
      var name = 'abc';

      esClientMock.indices.create = sinon.spy(function (options, callback) {
        callback();
      });
      esClientMock.indices.exists = sinon.spy(function (options, callback) {
        callback(null, [true, 200]);
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);

      var configuration = getConfigurationInstance();

      configuration.createIndex(name, type).then(function () {
        expect(esClientMock.indices.create).to.not.have.been.called;

        done();
      }, function (err) {
        return done(err || 'should resolve');
      });
    });

    it('should reject if failed to create index in elasticsearch', function (done) {
      var type = 'type';
      var name = 'abc';
      var error = new Error('something wrong');

      esClientMock.indices.create = sinon.spy(function (options, callback) {
        callback(error);
      });
      esClientMock.indices.exists = sinon.spy(function (options, callback) {
        callback(null, [false, 200]);
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.createIndex(name, type).catch(function (err) {
        expect(esClientMock.indices.create).to.have.been.calledWith({
          index: name,
          body: data
        });
        expect(err).to.deep.equal(error);

        done();
      });
    });

    it('should reject if failed to get index configuration', function (done) {
      var type = 'type';
      var name = 'abc';

      mockery.registerMock('fs-promise', {
        readJSON: function readJSON() {
          return q.reject({
            code: 'ENOENT'
          });
        }
      });

      esClientMock.indices.create = sinon.spy(function (options, callback) {
        callback();
      });

      esClientMock.indices.exists = sinon.spy(function (options, callback) {
        callback(null, [false, 200]);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.createIndex(name, type).catch(function (err) {
        expect(esClientMock.indices.create).to.not.have.been.called;
        expect(err.message).to.equal('No "' + type + '" mapping configuration found for Elasticsearch version ' + version.split('')[0]);

        done();
      });
    });
  });

  describe('The _associateAliasWithIndex function', function () {
    var data = void 0;

    beforeEach(function () {
      data = { foo: 'bar' };

      mockery.registerMock('fs-promise', {
        readJSON: function readJSON(file) {
          return q.when(data);
        }
      });
    });

    it('should reject if failed to associate alias with index', function (done) {
      var error = new Error('something wrong');
      var alias = 'alias';
      var index = 'index';

      esClientMock.indices.putAlias = sinon.spy(function (options, callback) {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration._associateAliasWithIndex(alias, index).then(function () {
        return done(new Error('should not resolved'));
      }, function (err) {
        expect(esClientMock.indices.putAlias).to.have.been.calledWith({ name: alias, index: index });
        expect(err).to.deep.equal(error);

        done();
      }).catch(done);
    });

    it('should resolve if associate alias with index is successfully', function (done) {
      var alias = 'alias';
      var index = 'index';

      esClientMock.indices.putAlias = sinon.spy(function (options, callback) {
        callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration._associateAliasWithIndex(alias, index).then(function () {
        expect(esClientMock.indices.putAlias).to.have.been.calledWith({ name: alias, index: index });

        done();
      }, function (err) {
        return done(err || 'should resolve');
      });
    });
  });

  describe('The deleteIndex function', function () {
    it('should not delete if index does not exist', function (done) {
      var name = 'abc';

      esClientMock.indices.exists = sinon.spy(function (options, callback) {
        return callback(null, [false, 200]);
      });
      esClientMock.indices.delete = sinon.spy();

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.deleteIndex(name).then(function (err) {
        expect(esClientMock.indices.exists).to.have.been.calledWith({ index: name });
        expect(esClientMock.indices.delete).to.not.have.been.called;
        expect(err).to.not.exists;

        done();
      }).catch(done);
    });

    it('should reject if failed to delete index', function (done) {
      var error = new Error('something wrong');
      var name = 'abc';

      esClientMock.indices.exists = sinon.spy(function (options, callback) {
        return callback(null, [true, 200]);
      });
      esClientMock.indices.delete = sinon.spy(function (options, callback) {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.deleteIndex(name).catch(function (err) {
        expect(esClientMock.indices.delete).to.have.been.calledWith({ index: name });
        expect(err).to.deep.equal(error);

        done();
      });
    });

    it('should resolve if delete index is successfully', function (done) {
      var name = 'abc';

      esClientMock.indices.exists = sinon.spy(function (options, callback) {
        return callback(null, [true, 200]);
      });
      esClientMock.indices.delete = sinon.spy(function (options, callback) {
        callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.deleteIndex(name).then(function () {
        expect(esClientMock.indices.delete).to.have.been.calledWith({ index: name });

        done();
      }, function (err) {
        return done(err, 'should resolve');
      });
    });
  });

  describe('The reindex function', function () {
    it('should reject if failed to reindex', function (done) {
      var error = new Error('something wrong');
      var source = 'source';
      var dest = 'dest';

      esClientMock.reindex = sinon.spy(function (options, callback) {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.reindex(source, dest).catch(function (err) {
        expect(esClientMock.reindex).to.have.been.calledWith({
          body: {
            source: { index: source },
            dest: { index: dest }
          },
          refresh: true
        });
        expect(err).to.deep.equal(error);

        done();
      });
    });

    it('should resolve if reindex is successfully', function (done) {
      var source = 'source';
      var dest = 'dest';

      esClientMock.reindex = sinon.spy(function (options, callback) {
        callback();
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.reindex(source, dest).then(function () {
        expect(esClientMock.reindex).to.have.been.calledWith({
          body: {
            source: { index: source },
            dest: { index: dest }
          },
          refresh: true
        });

        done();
      }, function (err) {
        return done(err || 'should resolve');
      });
    });
  });

  describe('The _convertIndexToAlias function', function () {
    it('should resolve if convert index to alias is successfully', function (done) {
      var index = 'abc';
      var type = 'type';
      var configuration = getConfigurationInstance();

      configuration.createIndex = sinon.stub().returns(q.when());
      configuration.reindex = sinon.stub().returns(q.when());
      configuration.deleteIndex = sinon.stub().returns(q.when());
      configuration._associateAliasWithIndex = sinon.stub().returns(q.when());

      configuration._convertIndexToAlias(index, type).then(function () {
        expect(configuration.createIndex).to.have.been.calledWith(configuration._buildIndexNameByAlias(index), type);
        expect(configuration.reindex).to.have.been.calledWith(index, configuration._buildIndexNameByAlias(index));
        expect(configuration.deleteIndex).to.have.been.calledWith(index);
        expect(configuration._associateAliasWithIndex).to.have.been.calledWith(index, configuration._buildIndexNameByAlias(index));

        done();
      }, function (err) {
        return done(err || 'should resolve');
      });
    });
  });

  describe('The ensureIndexIsConfiguredProperly function', function () {
    var configuration = void 0;

    beforeEach(function () {
      configuration = getConfigurationInstance();

      configuration._doesIndexExist = sinon.stub().returns(q.when());
      configuration._convertIndexToAlias = sinon.stub().returns(q.when());
      esClientMock.indices.create = sinon.spy(function (options, callback) {
        callback();
      });
      configuration._associateAliasWithIndex = sinon.stub().returns(q.when());
    });

    describe('In case alias already exist', function () {
      it('should associate alias with index if index already exist', function (done) {
        var name = 'abc';
        var type = 'type';

        configuration._doesAliasExist = sinon.stub().returns(q.when(true));
        configuration._doesIndexExist = sinon.stub().returns(q.when(true));

        configuration.ensureIndexIsConfiguredProperly(name, type).then(function () {
          expect(configuration._doesAliasExist).to.have.been.calledWith(name);
          expect(configuration._doesIndexExist).to.have.been.calledWith(configuration._buildIndexNameByAlias(name));
          expect(configuration._convertIndexToAlias).to.not.have.called;
          expect(esClientMock.indices.create).to.not.have.called;
          expect(configuration._associateAliasWithIndex).to.have.been.calledWith(name, configuration._buildIndexNameByAlias(name));

          done();
        }, function (err) {
          return done(err || 'should resolve');
        });
      });

      it('should create index and associate alias and index if index does not exist', function (done) {
        var name = 'abc';
        var type = 'type';
        var data = { foo: 'bar' };

        mockery.registerMock('fs-promise', {
          readJSON: function readJSON(file) {
            return q.when(data);
          }
        });

        configuration._doesAliasExist = sinon.stub().returns(q.when(true));
        configuration._doesIndexExist = sinon.stub().returns(q.when(false));

        configuration.ensureIndexIsConfiguredProperly(name, type).then(function () {
          expect(configuration._doesAliasExist).to.have.been.calledWith(name);
          expect(configuration._doesIndexExist).to.have.been.calledWith(configuration._buildIndexNameByAlias(name));
          expect(configuration._convertIndexToAlias).to.not.have.called;
          expect(esClientMock.indices.create).to.have.been.calledWith({
            index: configuration._buildIndexNameByAlias(name),
            body: data
          });
          expect(configuration._associateAliasWithIndex).to.have.been.calledWith(name, configuration._buildIndexNameByAlias(name));

          done();
        }).catch(done);
      });
    });

    describe('In case alias does not exist', function () {
      it('should convert index to alias if the alias name have been taken by index', function (done) {
        var name = 'abc';
        var type = 'type';

        configuration._doesAliasExist = sinon.stub().returns(q.when(false));
        configuration._doesIndexExist = sinon.stub().returns(q.when(true));

        configuration.ensureIndexIsConfiguredProperly(name, type).then(function () {
          expect(configuration._doesAliasExist).to.have.been.calledWith(name);
          expect(configuration._doesIndexExist).to.have.been.calledWith(name);
          expect(configuration._convertIndexToAlias).to.have.been.calledWith(name, type);

          done();
        }, function (err) {
          return done(err || 'should resolve');
        });
      });
    });
  });

  describe('The _switchIndexForAlias function', function () {
    var alias = void 0,
        sourceIndex = void 0,
        destIndex = void 0,
        actions = void 0;

    beforeEach(function () {
      alias = 'abc';
      sourceIndex = 'source';
      destIndex = 'dest';
      actions = [{ add: { index: destIndex, alias: alias } }, { remove: { index: sourceIndex, alias: alias } }];
    });

    it('should resolve if create switch index for alias is successfully', function (done) {
      esClientMock.indices.updateAliases = sinon.spy(function (options, callback) {
        callback();
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);

      var configuration = getConfigurationInstance();

      configuration._switchIndexForAlias(alias, sourceIndex, destIndex).then(function () {
        expect(esClientMock.indices.updateAliases).to.have.been.calledWith({ body: { actions: actions } });

        done();
      }, function (err) {
        return done(err || 'should resolve');
      });
    });

    it('should reject if failed to switch index for alias', function (done) {
      var error = new Error('something wrong');

      esClientMock.indices.updateAliases = sinon.spy(function (options, callback) {
        callback(error);
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration._switchIndexForAlias(alias, sourceIndex, destIndex).catch(function (err) {
        expect(esClientMock.indices.updateAliases).to.have.been.calledWith({ body: { actions: actions } });
        expect(err).to.deep.equal(error);

        done();
      });
    });
  });

  describe('The index function', function () {
    var indexOptions = void 0;

    beforeEach(function () {
      indexOptions = {
        document: { id: 'document' },
        name: 'abc',
        type: 'type'
      };
    });

    it('should reject if failed to index document', function (done) {
      var error = new Error('something wrong');

      esClientMock.index = sinon.spy(function (options, callback) {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.index(indexOptions).catch(function (err) {
        expect(esClientMock.index).to.have.been.calledWith({
          index: indexOptions.name,
          type: indexOptions.type,
          refresh: true,
          id: indexOptions.document.id,
          body: indexOptions.document
        });
        expect(err).to.deep.equal(error);

        done();
      });
    });

    it('should resolve if index document successfully', function (done) {
      esClientMock.index = sinon.spy(function (options, callback) {
        callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.index(indexOptions).then(function () {
        expect(esClientMock.index).to.have.been.calledWith({
          index: indexOptions.name,
          type: indexOptions.type,
          refresh: true,
          id: indexOptions.document.id,
          body: indexOptions.document
        });

        done();
      }, function (err) {
        return done(err || 'should resolve');
      });
    });

    it('should denormalize document if denormalize function is provided', function (done) {
      indexOptions.denormalize = sinon.spy(function (data) {
        return data;
      });

      esClientMock.index = sinon.spy(function (options, callback) {
        callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.index(indexOptions).then(function () {
        expect(indexOptions.denormalize).to.have.been.calledWith(indexOptions.document);
        expect(esClientMock.index).to.have.been.calledWith({
          index: indexOptions.name,
          type: indexOptions.type,
          refresh: true,
          id: indexOptions.document.id,
          body: indexOptions.document
        });

        done();
      }, function (err) {
        return done(err || 'should resolve');
      });
    });

    it('should use getId funtion if it is provided', function (done) {
      indexOptions.getId = sinon.spy(function (data) {
        return data.id;
      });

      esClientMock.index = sinon.spy(function (options, callback) {
        callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      var configuration = getConfigurationInstance();

      configuration.index(indexOptions).then(function () {
        expect(indexOptions.getId).to.have.been.calledWith(indexOptions.document);
        expect(esClientMock.index).to.have.been.calledWith({
          index: indexOptions.name,
          type: indexOptions.type,
          refresh: true,
          id: indexOptions.document.id,
          body: indexOptions.document
        });

        done();
      }, function (err) {
        return done(err || 'should resolve');
      });
    });
  });

  describe('The indexDocs function', function () {
    it('should call index function multiple times to index multiple documents', function (done) {
      var documents = [{ doc1: 'doc1' }, { doc2: 'doc2 ' }];
      var options = {};
      var configuration = getConfigurationInstance();

      configuration.index = sinon.stub().returns(q.when());

      configuration.indexDocs(documents, options).then(function () {
        expect(configuration.index).to.have.been.calledTwice;
        done();
      }, done);
    });
  });

  describe('The reconfigure function', function () {
    it('should resolve if success to reindex configuration', function (done) {
      var name = 'abc';
      var type = 'type';
      var configuration = getConfigurationInstance();

      configuration.ensureIndexIsConfiguredProperly = sinon.stub().returns(q.when());
      configuration.createIndex = sinon.stub().returns(q.when());
      configuration.reindex = sinon.stub().returns(q.when());
      configuration.deleteIndex = sinon.stub().returns(q.when());
      configuration._switchIndexForAlias = sinon.stub().returns(q.when());

      configuration.reconfigure(name, type).then(function () {
        expect(configuration.ensureIndexIsConfiguredProperly).to.have.been.calledWith(name, type);
        expect(configuration.createIndex).to.have.been.calledTwice;
        expect(configuration.reindex).to.have.been.calledTwice;
        expect(configuration.deleteIndex).to.have.been.calledTwice;
        expect(configuration._switchIndexForAlias).to.have.been.calledTwice;

        done();
      }, function (err) {
        return done(err || 'should resolve');
      });
    });
  });

  describe('The reindexAll function', function () {
    it('should resolve if success to reindex configuration and data', function (done) {
      var doc1 = { id: 'doc1' };
      var doc2 = { id: 'doc2' };
      var next = sinon.stub();

      next.onCall(0).returns(q.when(doc1));
      next.onCall(1).returns(q.when(doc2));
      next.onCall(2).returns(q.when());
      var options = {
        next: next,
        name: 'abc',
        type: 'abc'
      };
      var configuration = getConfigurationInstance();
      var indexName = configuration._buildIndexNameByAlias(options.name);

      configuration.ensureIndexIsConfiguredProperly = sinon.stub().returns(q.when());
      configuration.createIndex = sinon.stub().returns(q.when());
      configuration.reindex = sinon.stub().returns(q.when());
      configuration.deleteIndex = sinon.stub().returns(q.when());
      configuration.index = sinon.stub().returns(q.when());
      configuration._switchIndexForAlias = sinon.stub().returns(q.when());

      configuration.reindexAll(options).then(function () {
        expect(configuration.ensureIndexIsConfiguredProperly).to.have.been.calledWith(options.name, options.type);
        expect(configuration.createIndex).to.have.been.calledTwice;
        expect(configuration._switchIndexForAlias).to.have.been.calledTwice;
        expect(configuration.deleteIndex).to.have.been.calledTwice;
        expect(configuration.reindex).to.have.been.calledWith('tmp.' + indexName, indexName);

        done();
      }, function (err) {
        return done(err || 'should resolve');
      });
    });
  });
});
