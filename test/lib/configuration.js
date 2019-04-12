'use strict';

const mockery = require('mockery');
const chai = require('chai');
const q = require('q');
const expect = chai.expect;
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

describe('The configuration class', () => {
  let elasticsearchMock, esClientMock;
  let version = '2.3.2';

  beforeEach(() => {
    chai.use(sinonChai);
    mockery.enable({
      useCleanCache: true,
      warnOnReplace: false,
      warnOnUnregistered: false
    });

    esClientMock = {
      ping: (options, callback) => callback(),
      indices: {},
      close: () => {},
      info: callback => callback(null, [{ version: { number: version } }, 200])
    };
    elasticsearchMock = {
      Client: () => esClientMock
    };
  });

  afterEach(() => {
    mockery.disable();
  });

  const getConfigurationInstance = (options = {}) => {
    const Configuration = require('../../lib/configuration');

    return new Configuration(options);
  };

  describe('The _getIndexConfiguration function', () => {
    it('should load configuration from local file', (done) => {
      const name = 'contacts';

      mockery.registerMock('elasticsearch', elasticsearchMock);
      mockery.registerMock('fs-promise', {
        readJSON: (file) => {
          expect(file.indexOf(name + '.json') > 0).to.be.true;

          return q.when().then(done);
        }
      });

      const configuration = getConfigurationInstance();

      configuration._getIndexConfiguration(name).catch(done);
    });

    it('should load configuration from local file from options path', (done) => {
      const name = 'contacts';
      const options = { path: '/foo/bar/' };

      mockery.registerMock('elasticsearch', elasticsearchMock);
      mockery.registerMock('fs-promise', {
        readJSON: (file) => {
          expect(file.indexOf(options.path + name + '.json') === 0).to.be.true;

          return q.when().then(done);
        }
      });

      const configuration = getConfigurationInstance(options);

      configuration._getIndexConfiguration(name).catch(done);
    });
  });

  describe('The _getClient function', () => {
    it('should reject if failed to connect to elasticsearch', done => {
      const error = new Error('something wrong');

      esClientMock.ping = sinon.spy((options, callback) => {
        return callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration._getClient()
        .catch(err => {
          expect(err).to.deep.equal(error);
          expect(esClientMock.ping).to.have.been.called;
          done();
        });
    });

    it('should resolve if connect to elasticsearch is successfully', done => {
      esClientMock.ping = sinon.spy((options, callback) => {
        return callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration._getClient()
        .then(esClient => {
          expect(esClientMock.ping).to.have.been.called;
          expect(esClient).to.deep.equal(new elasticsearchMock.Client());
          done();
        })
        .catch(err => done(err || 'should resolve'));
    });
  });

  describe('The _doesIndexExist function', () => {
    it('should reject if failed to check the existence of index', done => {
      const error = new Error('something wrong');

      esClientMock.indices.exists = sinon.spy((options, callback) => {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration._doesIndexExist()
        .catch(err => {
          expect(err).to.deep.equal(error);
          done();
        });
    });

    it('should resolve if check the existence of index is successfully', done => {
      const isExist = false;

      esClientMock.indices.exists = sinon.spy((options, callback) => {
        callback(null, [isExist, 200]);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration._doesIndexExist()
        .then(result => {
          expect(result).to.equal(isExist);
          done();
        });
    });
  });

  describe('The _doesAliasExist function', () => {
    it('should reject if failed to check the existence of alias', done => {
      const error = new Error('something wrong');

      esClientMock.indices.existsAlias = sinon.spy((options, callback) => {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration._doesAliasExist()
        .catch(err => {
          expect(err).to.deep.equal(error);
          done();
        });
    });

    it('should resolve if check the existence of alias is successfully', done => {
      const isExist = false;

      esClientMock.indices.existsAlias = sinon.spy((options, callback) => {
        callback(null, [isExist, 200]);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration._doesAliasExist()
        .then(result => {
          expect(result).to.equal(isExist);
          done();
        });
    });
  });

  describe('The setup function', () => {
    let data;

    beforeEach(() => {
      data = { foo: 'bar' };

      mockery.registerMock('fs-promise', {
        readJSON: (file) => {
          return q.when(data);
        }
      });

      esClientMock.indices.exists = sinon.spy((options, callback) => {
        callback(null, [false, 200]);
      });
    });

    it('should reject if failed to create index in elasticsearch', done => {
      const error = new Error('something wrong');
      const name = 'abc';
      const type = 'type';

      esClientMock.indices.create = sinon.spy((options, callback) => {
        callback(error);
      });
      esClientMock.indices.putAlias = sinon.spy((options, callback) => {
        callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.setup(name, type)
        .then(() => done(new Error('should not resolve')), err => {
          expect(esClientMock.indices.create).to.have.been.calledWith({
            index: configuration._buildIndexNameByAlias(name),
            body: data
          });
          expect(err).to.deep.equal(error);

          done();
        })
        .catch(done);
    });

    it('should reject if failed to associate alias with index', done => {
      const error = new Error('something wrong');
      const name = 'abc';
      const type = 'type';

      esClientMock.indices.create = sinon.spy((options, callback) => {
        callback();
      });
      esClientMock.indices.putAlias = sinon.spy((options, callback) => {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.setup(name, type)
        .then(() => done(new Error('should not resolve')), err => {
          expect(esClientMock.indices.create).to.have.been.calledWith({
            index: configuration._buildIndexNameByAlias(name),
            body: data
          });
          expect(esClientMock.indices.putAlias).to.have.been.calledWith({
            name,
            index: configuration._buildIndexNameByAlias(name)
          });
          expect(err).to.deep.equal(error);

          done();
        })
        .catch(done);
    });

    it('should resolve if create alias and corresponding index in elasticsearch is successfully', done => {
      const name = 'abc';
      const type = 'type';

      esClientMock.indices.create = sinon.spy((options, callback) => {
        callback();
      });
      esClientMock.indices.putAlias = sinon.spy((options, callback) => {
        callback();
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);

      const configuration = getConfigurationInstance();

      configuration.setup(name, type)
        .then(() => {
          expect(esClientMock.indices.create).to.have.been.calledWith({
            index: configuration._buildIndexNameByAlias(name),
            body: data
          });
          expect(esClientMock.indices.putAlias).to.have.been.calledWith({
            name,
            index: configuration._buildIndexNameByAlias(name)
          });

          done();
        }).catch(done);
    });
  });

  describe('The createIndex function', () => {
    let data;

    beforeEach(() => {
      data = { foo: 'bar' };

      mockery.registerMock('fs-promise', {
        readJSON: (file) => {
          return q.when(data);
        }
      });
    });

    it('should resolve if create index in elasticsearch is successfully', done => {
      const type = 'type';
      const name = 'abc';

      esClientMock.indices.create = sinon.spy((options, callback) => {
        callback();
      });
      esClientMock.indices.exists = sinon.spy((options, callback) => {
        callback(null, [false, 200]);
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);

      const configuration = getConfigurationInstance();

      configuration.createIndex(name, type)
        .then(() => {
          expect(esClientMock.indices.create).to.have.been.calledWith({
            index: name,
            body: data
          });

          done();
        }).catch(done);
    });

    it('should resolve if create index already exists', done => {
      const type = 'type';
      const name = 'abc';

      esClientMock.indices.create = sinon.spy((options, callback) => {
        callback();
      });
      esClientMock.indices.exists = sinon.spy((options, callback) => {
        callback(null, [true, 200]);
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);

      const configuration = getConfigurationInstance();

      configuration.createIndex(name, type)
        .then(() => {
          expect(esClientMock.indices.create).to.not.have.been.called;

          done();
        }, err => done(err || 'should resolve'));
    });

    it('should reject if failed to create index in elasticsearch', done => {
      const type = 'type';
      const name = 'abc';
      const error = new Error('something wrong');

      esClientMock.indices.create = sinon.spy((options, callback) => {
        callback(error);
      });
      esClientMock.indices.exists = sinon.spy((options, callback) => {
        callback(null, [false, 200]);
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.createIndex(name, type)
        .catch(err => {
          expect(esClientMock.indices.create).to.have.been.calledWith({
            index: name,
            body: data
          });
          expect(err).to.deep.equal(error);

          done();
        });
    });

    it('should reject if failed to get index configuration', done => {
      const type = 'type';
      const name = 'abc';

      mockery.registerMock('fs-promise', {
        readJSON: () => {
          return q.reject({
            code: 'ENOENT'
          });
        }
      });

      esClientMock.indices.create = sinon.spy((options, callback) => {
        callback();
      });

      esClientMock.indices.exists = sinon.spy((options, callback) => {
        callback(null, [false, 200]);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.createIndex(name, type)
        .catch(err => {
          expect(esClientMock.indices.create).to.not.have.been.called;
          expect(err.message).to.equal(`No "${type}" mapping configuration found for Elasticsearch version ${version.split('')[0]}`);

          done();
        });
    });
  });

  describe('The _associateAliasWithIndex function', () => {
    let data;

    beforeEach(() => {
      data = { foo: 'bar' };

      mockery.registerMock('fs-promise', {
        readJSON: (file) => {
          return q.when(data);
        }
      });
    });

    it('should reject if failed to associate alias with index', done => {
      const error = new Error('something wrong');
      const alias = 'alias';
      const index = 'index';

      esClientMock.indices.putAlias = sinon.spy((options, callback) => {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration._associateAliasWithIndex(alias, index)
        .then(() => done(new Error('should not resolved')), err => {
          expect(esClientMock.indices.putAlias).to.have.been.calledWith({ name: alias, index });
          expect(err).to.deep.equal(error);

          done();
        })
        .catch(done);
    });

    it('should resolve if associate alias with index is successfully', done => {
      const alias = 'alias';
      const index = 'index';

      esClientMock.indices.putAlias = sinon.spy((options, callback) => {
        callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration._associateAliasWithIndex(alias, index)
        .then(() => {
          expect(esClientMock.indices.putAlias).to.have.been.calledWith({ name: alias, index });

          done();
        }, err => done(err || 'should resolve'));
    });
  });

  describe('The deleteIndex function', () => {
    it('should not delete if index does not exist', done => {
      const name = 'abc';

      esClientMock.indices.exists = sinon.spy((options, callback) => callback(null, [false, 200]));
      esClientMock.indices.delete = sinon.spy();

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.deleteIndex(name)
        .then(err => {
          expect(esClientMock.indices.exists).to.have.been.calledWith({ index: name });
          expect(esClientMock.indices.delete).to.not.have.been.called;
          expect(err).to.not.exists;

          done();
        })
        .catch(done);
    });

    it('should reject if failed to delete index', done => {
      const error = new Error('something wrong');
      const name = 'abc';

      esClientMock.indices.exists = sinon.spy((options, callback) => callback(null, [true, 200]));
      esClientMock.indices.delete = sinon.spy((options, callback) => {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.deleteIndex(name)
        .catch(err => {
          expect(esClientMock.indices.delete).to.have.been.calledWith({ index: name });
          expect(err).to.deep.equal(error);

          done();
        });
    });

    it('should resolve if delete index is successfully', done => {
      const name = 'abc';

      esClientMock.indices.exists = sinon.spy((options, callback) => callback(null, [true, 200]));
      esClientMock.indices.delete = sinon.spy((options, callback) => {
        callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.deleteIndex(name)
        .then(() => {
          expect(esClientMock.indices.delete).to.have.been.calledWith({ index: name });

          done();
        }, err => done(err, 'should resolve'));
    });
  });

  describe('The reindex function', () => {
    it('should reject if failed to reindex', done => {
      const error = new Error('something wrong');
      const source = 'source';
      const dest = 'dest';

      esClientMock.reindex = sinon.spy((options, callback) => {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.reindex(source, dest)
        .catch(err => {
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

    it('should resolve if reindex is successfully', (done) => {
      const source = 'source';
      const dest = 'dest';

      esClientMock.reindex = sinon.spy((options, callback) => {
        callback();
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.reindex(source, dest)
        .then(() => {
          expect(esClientMock.reindex).to.have.been.calledWith({
            body: {
              source: { index: source },
              dest: { index: dest }
            },
            refresh: true
          });

          done();
        }, err => done(err || 'should resolve'));
    });
  });

  describe('The _convertIndexToAlias function', () => {
    it('should resolve if convert index to alias is successfully', done => {
      const index = 'abc';
      const type = 'type';
      const configuration = getConfigurationInstance();

      configuration.createIndex = sinon.stub().returns(q.when());
      configuration.reindex = sinon.stub().returns(q.when());
      configuration.deleteIndex = sinon.stub().returns(q.when());
      configuration._associateAliasWithIndex = sinon.stub().returns(q.when());

      configuration._convertIndexToAlias(index, type)
        .then(() => {
          expect(configuration.createIndex).to.have.been.calledWith(configuration._buildIndexNameByAlias(index), type);
          expect(configuration.reindex).to.have.been.calledWith(index, configuration._buildIndexNameByAlias(index));
          expect(configuration.deleteIndex).to.have.been.calledWith(index);
          expect(configuration._associateAliasWithIndex).to.have.been.calledWith(index, configuration._buildIndexNameByAlias(index));

          done();
        }, err => done(err || 'should resolve'));
    });
  });

  describe('The ensureIndexIsConfiguredProperly function', () => {
    let configuration;

    beforeEach(() => {
      configuration = getConfigurationInstance();

      configuration._doesIndexExist = sinon.stub().returns(q.when());
      configuration._convertIndexToAlias = sinon.stub().returns(q.when());
      esClientMock.indices.create = sinon.spy((options, callback) => {
        callback();
      });
      configuration._associateAliasWithIndex = sinon.stub().returns(q.when());
    });

    describe('In case alias already exist', () => {
      it('should associate alias with index if index already exist', done => {
        const name = 'abc';
        const type = 'type';

        configuration._doesAliasExist = sinon.stub().returns(q.when(true));
        configuration._doesIndexExist = sinon.stub().returns(q.when(true));

        configuration.ensureIndexIsConfiguredProperly(name, type)
          .then(() => {
            expect(configuration._doesAliasExist).to.have.been.calledWith(name);
            expect(configuration._doesIndexExist).to.have.been.calledWith(configuration._buildIndexNameByAlias(name));
            expect(configuration._convertIndexToAlias).to.not.have.called;
            expect(esClientMock.indices.create).to.not.have.called;
            expect(configuration._associateAliasWithIndex).to.have.been.calledWith(name, configuration._buildIndexNameByAlias(name));

            done();
          }, err => done(err || 'should resolve'));
      });

      it('should create index and associate alias and index if index does not exist', done => {
        const name = 'abc';
        const type = 'type';
        const data = { foo: 'bar' };

        mockery.registerMock('fs-promise', {
          readJSON: (file) => {
            return q.when(data);
          }
        });

        configuration._doesAliasExist = sinon.stub().returns(q.when(true));
        configuration._doesIndexExist = sinon.stub().returns(q.when(false));

        configuration.ensureIndexIsConfiguredProperly(name, type)
          .then(() => {
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

    describe('In case alias does not exist', () => {
      it('should convert index to alias if the alias name have been taken by index', done => {
        const name = 'abc';
        const type = 'type';

        configuration._doesAliasExist = sinon.stub().returns(q.when(false));
        configuration._doesIndexExist = sinon.stub().returns(q.when(true));

        configuration.ensureIndexIsConfiguredProperly(name, type)
          .then(() => {
            expect(configuration._doesAliasExist).to.have.been.calledWith(name);
            expect(configuration._doesIndexExist).to.have.been.calledWith(name);
            expect(configuration._convertIndexToAlias).to.have.been.calledWith(name, type);

            done();
          }, err => done(err || 'should resolve'));
      });
    });
  });

  describe('The _switchIndexForAlias function', () => {
    let alias, sourceIndex, destIndex, actions;

    beforeEach(() => {
      alias = 'abc';
      sourceIndex = 'source';
      destIndex = 'dest';
      actions = [
        { add: { index: destIndex, alias } },
        { remove: { index: sourceIndex, alias } }
      ];
    });

    it('should resolve if create switch index for alias is successfully', done => {
      esClientMock.indices.updateAliases = sinon.spy((options, callback) => {
        callback();
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);

      const configuration = getConfigurationInstance();

      configuration._switchIndexForAlias(alias, sourceIndex, destIndex)
        .then(() => {
          expect(esClientMock.indices.updateAliases).to.have.been.calledWith({ body: { actions } });

          done();
        }, err => done(err || 'should resolve'));
    });

    it('should reject if failed to switch index for alias', done => {
      const error = new Error('something wrong');

      esClientMock.indices.updateAliases = sinon.spy((options, callback) => {
        callback(error);
      });
      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration._switchIndexForAlias(alias, sourceIndex, destIndex)
        .catch(err => {
          expect(esClientMock.indices.updateAliases).to.have.been.calledWith({ body: { actions } });
          expect(err).to.deep.equal(error);

          done();
        });
    });
  });

  describe('The index function', () => {
    let indexOptions;

    beforeEach(() => {
      indexOptions = {
        document: { id: 'document' },
        name: 'abc',
        type: 'type'
      };
    });

    it('should reject if failed to index document', done => {
      const error = new Error('something wrong');

      esClientMock.index = sinon.spy((options, callback) => {
        callback(error);
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.index(indexOptions)
        .catch(err => {
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

    it('should resolve if index document successfully', done => {
      esClientMock.index = sinon.spy((options, callback) => {
        callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.index(indexOptions)
        .then(() => {
          expect(esClientMock.index).to.have.been.calledWith({
            index: indexOptions.name,
            type: indexOptions.type,
            refresh: true,
            id: indexOptions.document.id,
            body: indexOptions.document
          });

          done();
        }, err => done(err || 'should resolve'));
    });

    it('should denormalize document if denormalize function is provided', (done) => {
      indexOptions.denormalize = sinon.spy(function(data) {
        return data;
      });

      esClientMock.index = sinon.spy((options, callback) => {
        callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.index(indexOptions)
        .then(() => {
          expect(indexOptions.denormalize).to.have.been.calledWith(indexOptions.document);
          expect(esClientMock.index).to.have.been.calledWith({
            index: indexOptions.name,
            type: indexOptions.type,
            refresh: true,
            id: indexOptions.document.id,
            body: indexOptions.document
          });

          done();
        }, err => done(err || 'should resolve'));
    });

    it('should use getId funtion if it is provided', (done) => {
      indexOptions.getId = sinon.spy(function(data) {
        return data.id;
      });

      esClientMock.index = sinon.spy((options, callback) => {
        callback();
      });

      mockery.registerMock('elasticsearch', elasticsearchMock);
      const configuration = getConfigurationInstance();

      configuration.index(indexOptions)
        .then(() => {
          expect(indexOptions.getId).to.have.been.calledWith(indexOptions.document);
          expect(esClientMock.index).to.have.been.calledWith({
            index: indexOptions.name,
            type: indexOptions.type,
            refresh: true,
            id: indexOptions.document.id,
            body: indexOptions.document
          });

          done();
        }, err => done(err || 'should resolve'));
    });
  });

  describe('The indexDocs function', () => {
    it('should call index function multiple times to index multiple documents', function(done) {
      const documents = [{ doc1: 'doc1' }, { doc2: 'doc2 '}];
      const options = {};
      const configuration = getConfigurationInstance();

      configuration.index = sinon.stub().returns(q.when());

      configuration.indexDocs(documents, options).then(() => {
        expect(configuration.index).to.have.been.calledTwice;
        done();
      }, done);
    });
  });

  describe('The reconfigure function', () => {
    it('should resolve if success to reindex configuration', done => {
      const name = 'abc';
      const type = 'type';
      const configuration = getConfigurationInstance();

      configuration.ensureIndexIsConfiguredProperly = sinon.stub().returns(q.when());
      configuration.createIndex = sinon.stub().returns(q.when());
      configuration.reindex = sinon.stub().returns(q.when());
      configuration.deleteIndex = sinon.stub().returns(q.when());
      configuration._switchIndexForAlias = sinon.stub().returns(q.when());

      configuration.reconfigure(name, type).then(() => {
        expect(configuration.ensureIndexIsConfiguredProperly).to.have.been.calledWith(name, type);
        expect(configuration.createIndex).to.have.been.calledTwice;
        expect(configuration.reindex).to.have.been.calledTwice;
        expect(configuration.deleteIndex).to.have.been.calledTwice;
        expect(configuration._switchIndexForAlias).to.have.been.calledTwice;

        done();
      }, err => done(err || 'should resolve'));
    });
  });

  describe('The reindexAll function', () => {
    it('should resolve if success to reindex configuration and data', done => {
      const doc1 = { id: 'doc1' };
      const doc2 = { id: 'doc2' };
      const next = sinon.stub();

      next.onCall(0).returns(q.when(doc1));
      next.onCall(1).returns(q.when(doc2));
      next.onCall(2).returns(q.when());
      const options = {
        next,
        name: 'abc',
        type: 'abc'
      };
      const configuration = getConfigurationInstance();
      const indexName = configuration._buildIndexNameByAlias(options.name);

      configuration.ensureIndexIsConfiguredProperly = sinon.stub().returns(q.when());
      configuration.createIndex = sinon.stub().returns(q.when());
      configuration.reindex = sinon.stub().returns(q.when());
      configuration.deleteIndex = sinon.stub().returns(q.when());
      configuration.index = sinon.stub().returns(q.when());
      configuration._switchIndexForAlias = sinon.stub().returns(q.when());

      configuration.reindexAll(options).then(() => {
        expect(configuration.ensureIndexIsConfiguredProperly).to.have.been.calledWith(options.name, options.type);
        expect(configuration.createIndex).to.have.been.calledTwice;
        expect(configuration._switchIndexForAlias).to.have.been.calledTwice;
        expect(configuration.deleteIndex).to.have.been.calledTwice;
        expect(configuration.reindex).to.have.been.calledWith(`tmp.${indexName}`, indexName);

        done();
      }, err => done(err || 'should resolve'));
    });
  });
});
