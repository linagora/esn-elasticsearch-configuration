'use strict';

let mockery = require('mockery');
let chai = require('chai');
let q = require('q');
let expect = chai.expect;

describe('The configuration class', () => {

  beforeEach(() => {
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

      expect(c.getIndexUrl(name)).to.equal(`http://${options.host}:${options.port}/${name}.idx`);
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
});
