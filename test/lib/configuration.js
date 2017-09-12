'use strict';

const mockery = require('mockery');
const chai = require('chai');
const q = require('q');
const expect = chai.expect;
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

describe('The configuration class', () => {

  beforeEach(() => {
    chai.use(sinonChai);
    mockery.enable({
      useCleanCache: true,
      warnOnReplace: false,
      warnOnUnregistered: false
    });
  });

  afterEach(() => {
    mockery.disable();
  });

  function requireConfiguration() {
    return require('../../lib/configuration');
  }

  describe('The getIndexUrl function', () => {
    it('should return valid ES index URL', () => {
      let Configuration = requireConfiguration();
      let name = 'contacts';
      var options = {host: 'foo', port: '1234'};
      let c = new Configuration(options);

      expect(c.getIndexUrl(name)).to.equal(`http://${options.host}:${options.port}/${name}`);
    });
  });

  describe('The getIndexConfiguration function', () => {
    it('should load configuration from local file', (done) => {
      let name = 'contacts';

      mockery.registerMock('fs-promise', {
        readJSON: (file) => {
          expect(file.indexOf('data/' + name + '.json') > 0).to.be.true;
          done();
        }
      });

      let Configuration = requireConfiguration();
      let c = new Configuration();

      c.getIndexConfiguration(name);
    });

    it('should load configuration from local file from options path', (done) => {
      let name = 'contacts';
      let options = {path: '/foo/bar/'};

      mockery.registerMock('fs-promise', {
        readJSON: (file) => {
          expect(file.indexOf(options.path + name + '.json') === 0).to.be.true;
          done();
        }
      });

      let Configuration = requireConfiguration();
      let c = new Configuration(options);

      c.getIndexConfiguration(name);
    });
  });

  describe('The createIndex function', () => {
    it('should call ES with valid data', (done) => {
      let data = {foo: 'bar'};
      let name = 'contacts';

      mockery.registerMock('fs-promise', {
        readJSON: (file) => {
          return q.when(data);
        }
      });
      mockery.registerMock('request', {
        post: (options, callback) => {
          expect(options.url).to.be.defined;
          expect(options.body).to.deep.equal(data);
          expect(options.json).to.be.true;
          done();
        }
      });

      let Configuration = requireConfiguration();
      let c = new Configuration();

      c.createIndex(name);
    });

    it('should reject when ES call fails', (done) => {
      mockery.registerMock('request', {
        post: (options, callback) => {
          callback(new Error('Failed'));
        }
      });
      let Configuration = requireConfiguration();
      let c = new Configuration();

      c.createIndex().then(null, () => {
        done();
      });
    });

    it('should reject when ES does not send back valid HTTP code', (done) => {
      mockery.registerMock('request', {
        post: (options, callback) => {
          callback(null, {statusCode: 500});
        }
      });

      let Configuration = requireConfiguration();
      let c = new Configuration();

      c.createIndex().then(null, () => {
        done();
      });
    });

    it('should send back ES response on success', (done) => {
      let body = {foo: 'bar'};

      mockery.registerMock('request', {
        post: (options, callback) => {
          callback(null, {statusCode: 200}, body);
        }
      });

      let Configuration = requireConfiguration();
      let c = new Configuration();

      c.createIndex().then((result) => {
        expect(result).to.deep.equal(body);
        done();
      }, done);
    });
  });

  describe('The deleteIndex function', () => {
    it('should reject when ES call fails', (done) => {
      mockery.registerMock('request', {
        delete: (options, callback) => {
          callback(new Error('Failed'));
        }
      });
      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.deleteIndex().then(null, () => {
        done();
      });
    });

    it('should reject when ES does not send back valid HTTP code', (done) => {
      mockery.registerMock('request', {
        delete: (options, callback) => {
          callback(null, { statusCode: 500 });
        }
      });

      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.deleteIndex().then(null, () => {
        done();
      });
    });

    it('should send back ES response on success', (done) => {
      const body = { foo: 'bar' };

      mockery.registerMock('request', {
        delete: (options, callback) => {
          callback(null, { statusCode: 200 }, body);
        }
      });

      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.deleteIndex().then((result) => {
        expect(result).to.deep.equal(body);
        done();
      }, done);
    });
  });

  describe('The reindex function', () => {
    it('should reject when ES call fails', (done) => {
      mockery.registerMock('request', {
        post: (options, callback) => {
          callback(new Error('Failed'));
        }
      });
      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.reindex().then(null, () => {
        done();
      });
    });

    it('should reject when ES does not send back valid HTTP code', (done) => {
      mockery.registerMock('request', {
        post: (options, callback) => {
          callback(null, { statusCode: 500 });
        }
      });

      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.reindex().then(null, () => {
        done();
      });
    });

    it('should send back ES response on success', (done) => {
      const body = { foo: 'bar' };
      const source = 'source index';
      const dest = 'destination index';

      mockery.registerMock('request', {
        post: (options, callback) => {
          expect(options.body).to.deep.equal({
            source: { index: source },
            dest: { index: dest }
          });

          callback(null, { statusCode: 200 }, body);
        }
      });

      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.reindex(source, dest).then((result) => {
        expect(result).to.deep.equal(body);
        done();
      }, done);
    });
  });

  describe('The index function', () => {
    let indexOptions;

    beforeEach(() => {
      indexOptions = {
        document: { id: 'document' }
      };
    });

    it('should reject when ES call fails', (done) => {
      mockery.registerMock('request', {
        put: (options, callback) => {
          callback(new Error('Failed'));
        }
      });
      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.index(indexOptions).then(null, () => {
        done();
      });
    });

    it('should reject when ES does not send back valid HTTP code', (done) => {
      mockery.registerMock('request', {
        put: (options, callback) => {
          callback(null, { statusCode: 500 });
        }
      });

      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.index(indexOptions).then(null, () => {
        done();
      });
    });

    it('should send back ES response on success', (done) => {
      const body = { foo: 'bar' };

      mockery.registerMock('request', {
        put: (options, callback) => {
          callback(null, { statusCode: 201 }, body);
        }
      });

      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.index(indexOptions).then((result) => {
        expect(result).to.deep.equal(body);
        done();
      }, done);
    });

    it('should denormalize document if denormalize function is provided', (done) => {
      const body = { foo: 'bar' };

      indexOptions.denormalize = sinon.spy(function(data) {
        return data;
      });

      mockery.registerMock('request', {
        put: (options, callback) => {
          callback(null, { statusCode: 201 }, body);
        }
      });

      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.index(indexOptions).then((result) => {
        expect(indexOptions.denormalize).to.have.been.calledWith(indexOptions.document);
        expect(result).to.deep.equal(body);
        done();
      }, done);
    });

    it('should use getId funtion if it is provided', (done) => {
      const body = { foo: 'bar' };

      indexOptions.getId = sinon.spy(function(data) {
        return data.id;
      });

      mockery.registerMock('request', {
        put: (options, callback) => {
          callback(null, { statusCode: 201 }, body);
        }
      });

      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.index(indexOptions).then((result) => {
        expect(indexOptions.getId).to.have.been.calledWith(indexOptions.document);
        expect(result).to.deep.equal(body);
        done();
      }, done);
    });
  });

  describe('The indexDocs function', () => {
    it('should call index function multiple times to index multiple documents', function(done) {
      const documents = [{ doc1: 'doc1' }, { doc2: 'doc2 '}];
      const options = {};
      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.index = sinon.stub().returns(q.when());

      configurationInstance.indexDocs(documents, options).then(() => {
        expect(configurationInstance.index).to.have.been.calledTwice;
        done();
      }, done);
    });
  });

  describe('The reconfig function', () => {
    it('should resolve if success to reindex configuration', function(done) {
      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.createIndex = sinon.stub().returns(q.when());
      configurationInstance.reindex = sinon.stub().returns(q.when());
      configurationInstance.deleteIndex = sinon.stub().returns(q.when());

      configurationInstance.reconfig().then(() => {
        expect(configurationInstance.createIndex).to.have.been.calledTwice;
        expect(configurationInstance.reindex).to.have.been.calledTwice;
        expect(configurationInstance.deleteIndex).to.have.been.calledTwice;
        done();
      }, done);
    });
  });

  describe('The reindexAll function', () => {
    it('should resolve if success to reindex configuration and data', function(done) {
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

      const Configuration = requireConfiguration();
      const configurationInstance = new Configuration();

      configurationInstance.createIndex = sinon.stub().returns(q.when());
      configurationInstance.reindex = sinon.stub().returns(q.when());
      configurationInstance.deleteIndex = sinon.stub().returns(q.when());
      configurationInstance.index = sinon.stub().returns(q.when());

      configurationInstance.reindexAll(options).then(() => {
        expect(configurationInstance.createIndex).to.have.been.calledTwice;
        expect(configurationInstance.reindex).to.have.been.calledTwice;
        expect(configurationInstance.deleteIndex).to.have.been.calledTwice;
        expect(configurationInstance.index).to.have.been.calledTwice;
        done();
      }, done);
    });
  });
});
