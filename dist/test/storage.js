'use strict';

var _chai = require('chai');

var _chai2 = _interopRequireDefault(_chai);

var _chaiAsPromised = require('chai-as-promised');

var _chaiAsPromised2 = _interopRequireDefault(_chaiAsPromised);

var _memory = require('../storage/memory');

var _redis = require('../storage/redis');

var _rest = require('../storage/rest');

var _sql = require('../storage/sql');

var _axiosMocking = require('./axiosMocking');

var _axiosMocking2 = _interopRequireDefault(_axiosMocking);

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _pg = require('pg');

var pg = _interopRequireWildcard(_pg);

var _redis2 = require('redis');

var Redis = _interopRequireWildcard(_redis2);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint-env node, mocha*/
/* eslint no-shadow: 0 */

var testType = {
  $name: 'tests',
  $id: 'id',
  $fields: {
    id: {
      type: 'number'
    },
    name: {
      type: 'string'
    },
    extended: {
      type: 'object'
    },
    children: {
      type: 'hasMany',
      joinTable: 'children',
      parentColumn: 'parent_id',
      childColumn: 'child_id',
      childType: 'tests'
    }
  }
};

function runSQL(command) {
  var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  var connOptions = Object.assign({}, {
    user: 'postgres',
    host: 'localhost',
    port: 5432,
    database: 'postgres',
    charset: 'utf8'
  }, opts);
  var client = new pg.Client(connOptions);
  return new _bluebird2.default(function (resolve) {
    client.connect(function (err) {
      if (err) throw err;
      client.query(command, function (err) {
        if (err) throw err;
        client.end(function (err) {
          if (err) throw err;
          resolve();
        });
      });
    });
  });
}

function flushRedis() {
  var r = Redis.createClient({
    port: 6379,
    host: 'localhost',
    db: 0
  });
  return new _bluebird2.default(function (resolve) {
    r.flushdb(function (err) {
      if (err) throw err;
      r.quit(function (err) {
        if (err) throw err;
        resolve();
      });
    });
  });
}

var storageTypes = [{
  name: 'redis',
  constructor: _redis.RedisStorage,
  opts: {
    terminal: true
  },
  before: function before() {
    return flushRedis();
  },
  after: function after(driver) {
    return flushRedis().then(function () {
      return driver.teardown();
    });
  }
}, {
  name: 'sql',
  constructor: _sql.SQLStorage,
  opts: {
    sql: {
      connection: {
        database: 'guild_test'
      }
    },
    terminal: true
  },
  before: function before() {
    return runSQL('DROP DATABASE if exists guild_test;').then(function () {
      return runSQL('CREATE DATABASE guild_test;');
    }).then(function () {
      return runSQL('\n          CREATE SEQUENCE testid_seq\n            START WITH 1\n            INCREMENT BY 1\n            NO MINVALUE\n            MAXVALUE 2147483647\n            CACHE 1\n            CYCLE;\n          CREATE TABLE tests (\n            id integer not null primary key DEFAULT nextval(\'testid_seq\'::regclass),\n            name text,\n            extended jsonb not null default \'{}\'::jsonb\n          );\n          CREATE TABLE children (parent_id integer not null, child_id integer not null);\n        ', { database: 'guild_test' });
    });
  },
  after: function after(driver) {
    return driver.teardown().then(function () {
      return runSQL('DROP DATABASE guild_test;');
    });
  }
}, {
  name: 'rest',
  constructor: _rest.RestStorage,
  opts: {
    terminal: true,
    axios: _axiosMocking2.default.mockup(testType)
  }
}, {
  name: 'memory',
  constructor: _memory.MemoryStorage,
  opts: { terminal: true }
}];

var sampleObject = {
  name: 'potato',
  extended: {
    actual: 'rutabaga',
    otherValue: 42
  }
};

_chai2.default.use(_chaiAsPromised2.default);
var expect = _chai2.default.expect;

storageTypes.forEach(function (store) {
  describe(store.name, function () {
    var actualStore = void 0;
    before(function () {
      return (store.before || function () {
        return _bluebird2.default.resolve();
      })(actualStore).then(function () {
        actualStore = new store.constructor(store.opts);
      });
    });

    it('supports creating values with no id field, and retrieving values', function () {
      return actualStore.write(testType, sampleObject).then(function (createdObject) {
        return expect(actualStore.read(testType, createdObject.id)).to.eventually.deep.equal(Object.assign({}, sampleObject, { id: createdObject.id }));
      });
    });

    it('allows objects to be stored by id', function () {
      return actualStore.write(testType, sampleObject).then(function (createdObject) {
        var modObject = Object.assign({}, createdObject, { name: 'carrot' });
        return actualStore.write(testType, modObject).then(function (updatedObject) {
          return expect(actualStore.read(testType, updatedObject.id)).to.eventually.deep.equal(Object.assign({}, sampleObject, { id: createdObject.id, name: 'carrot' }));
        });
      });
    });

    it('allows for deletion of objects by id', function () {
      return actualStore.write(testType, sampleObject).then(function (createdObject) {
        return actualStore.delete(testType, createdObject.id).then(function () {
          return expect(actualStore.read(testType, createdObject.id)).to.eventually.deep.equal(null);
        });
      });
    });

    it('supports querying objects');

    it('can add to a hasMany relationship', function () {
      return actualStore.write(testType, sampleObject).then(function (createdObject) {
        return actualStore.add(testType, createdObject.id, 'children', 100).then(function () {
          return expect(actualStore.has(testType, createdObject.id, 'children')).to.eventually.deep.equal([100]);
        });
      });
    });

    it('can remove from a hasMany relationship', function () {
      return actualStore.write(testType, sampleObject).then(function (createdObject) {
        return actualStore.add(testType, createdObject.id, 'children', 100).then(function () {
          return expect(actualStore.has(testType, createdObject.id, 'children')).to.eventually.deep.equal([100]);
        }).then(function () {
          return actualStore.remove(testType, createdObject.id, 'children', 100);
        }).then(function () {
          return expect(actualStore.has(testType, createdObject.id, 'children')).to.eventually.deep.equal([]);
        });
      });
    });

    after(function () {
      return (store.after || function () {})(actualStore);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3Qvc3RvcmFnZS5qcyJdLCJuYW1lcyI6WyJwZyIsIlJlZGlzIiwidGVzdFR5cGUiLCIkbmFtZSIsIiRpZCIsIiRmaWVsZHMiLCJpZCIsInR5cGUiLCJuYW1lIiwiZXh0ZW5kZWQiLCJjaGlsZHJlbiIsImpvaW5UYWJsZSIsInBhcmVudENvbHVtbiIsImNoaWxkQ29sdW1uIiwiY2hpbGRUeXBlIiwicnVuU1FMIiwiY29tbWFuZCIsIm9wdHMiLCJjb25uT3B0aW9ucyIsIk9iamVjdCIsImFzc2lnbiIsInVzZXIiLCJob3N0IiwicG9ydCIsImRhdGFiYXNlIiwiY2hhcnNldCIsImNsaWVudCIsIkNsaWVudCIsInJlc29sdmUiLCJjb25uZWN0IiwiZXJyIiwicXVlcnkiLCJlbmQiLCJmbHVzaFJlZGlzIiwiciIsImNyZWF0ZUNsaWVudCIsImRiIiwiZmx1c2hkYiIsInF1aXQiLCJzdG9yYWdlVHlwZXMiLCJjb25zdHJ1Y3RvciIsInRlcm1pbmFsIiwiYmVmb3JlIiwiYWZ0ZXIiLCJkcml2ZXIiLCJ0aGVuIiwidGVhcmRvd24iLCJzcWwiLCJjb25uZWN0aW9uIiwiYXhpb3MiLCJtb2NrdXAiLCJzYW1wbGVPYmplY3QiLCJhY3R1YWwiLCJvdGhlclZhbHVlIiwidXNlIiwiZXhwZWN0IiwiZm9yRWFjaCIsInN0b3JlIiwiZGVzY3JpYmUiLCJhY3R1YWxTdG9yZSIsIml0Iiwid3JpdGUiLCJjcmVhdGVkT2JqZWN0IiwicmVhZCIsInRvIiwiZXZlbnR1YWxseSIsImRlZXAiLCJlcXVhbCIsIm1vZE9iamVjdCIsInVwZGF0ZWRPYmplY3QiLCJkZWxldGUiLCJhZGQiLCJoYXMiLCJyZW1vdmUiXSwibWFwcGluZ3MiOiI7O0FBR0E7Ozs7QUFDQTs7OztBQUNBOztBQUNBOztBQUNBOztBQUNBOztBQUNBOzs7O0FBQ0E7Ozs7QUFDQTs7SUFBWUEsRTs7QUFDWjs7SUFBWUMsSzs7Ozs7O0FBWlo7QUFDQTs7QUFhQSxJQUFNQyxXQUFXO0FBQ2ZDLFNBQU8sT0FEUTtBQUVm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QyxVQUFuRSxDQUE4RUMsSUFBOUUsQ0FBbUZDLEtBQW5GLENBQXlGLENBQUMsR0FBRCxDQUF6RixDQUFOO0FBQUEsU0FEQyxFQUVOdEIsSUFGTSxDQUVEO0FBQUEsaUJBQU1jLFlBQVljLE1BQVosQ0FBbUJ2RSxRQUFuQixFQUE2QjRELGNBQWN4RCxFQUEzQyxFQUErQyxVQUEvQyxFQUEyRCxHQUEzRCxDQUFOO0FBQUEsU0FGQyxFQUdOdUMsSUFITSxDQUdEO0FBQUEsaUJBQU1VLE9BQU9JLFlBQVlhLEdBQVosQ0FBZ0J0RSxRQUFoQixFQUEwQjRELGNBQWN4RCxFQUF4QyxFQUE0QyxVQUE1QyxDQUFQLEVBQWdFMEQsRUFBaEUsQ0FBbUVDLFVBQW5FLENBQThFQyxJQUE5RSxDQUFtRkMsS0FBbkYsQ0FBeUYsRUFBekYsQ0FBTjtBQUFBLFNBSEMsQ0FBUDtBQUlELE9BTk0sQ0FBUDtBQU9ELEtBUkQ7O0FBVUF4QixVQUFNLFlBQU07QUFDVixhQUFPLENBQUNjLE1BQU1kLEtBQU4sSUFBZ0IsWUFBTSxDQUFFLENBQXpCLEVBQTRCZ0IsV0FBNUIsQ0FBUDtBQUNELEtBRkQ7QUFHRCxHQTVERDtBQTZERCxDQTlERCIsImZpbGUiOiJ0ZXN0L3N0b3JhZ2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKiBlc2xpbnQtZW52IG5vZGUsIG1vY2hhKi9cbi8qIGVzbGludCBuby1zaGFkb3c6IDAgKi9cblxuaW1wb3J0IGNoYWkgZnJvbSAnY2hhaSc7XG5pbXBvcnQgY2hhaUFzUHJvbWlzZWQgZnJvbSAnY2hhaS1hcy1wcm9taXNlZCc7XG5pbXBvcnQgeyBNZW1vcnlTdG9yYWdlIH0gZnJvbSAnLi4vc3RvcmFnZS9tZW1vcnknO1xuaW1wb3J0IHsgUmVkaXNTdG9yYWdlIH0gZnJvbSAnLi4vc3RvcmFnZS9yZWRpcyc7XG5pbXBvcnQgeyBSZXN0U3RvcmFnZSB9IGZyb20gJy4uL3N0b3JhZ2UvcmVzdCc7XG5pbXBvcnQgeyBTUUxTdG9yYWdlIH0gZnJvbSAnLi4vc3RvcmFnZS9zcWwnO1xuaW1wb3J0IGF4aW9zTW9jayBmcm9tICcuL2F4aW9zTW9ja2luZyc7XG5pbXBvcnQgUHJvbWlzZSBmcm9tICdibHVlYmlyZCc7XG5pbXBvcnQgKiBhcyBwZyBmcm9tICdwZyc7XG5pbXBvcnQgKiBhcyBSZWRpcyBmcm9tICdyZWRpcyc7XG5cbmNvbnN0IHRlc3RUeXBlID0ge1xuICAkbmFtZTogJ3Rlc3RzJyxcbiAgJGlkOiAnaWQnLFxuICAkZmllbGRzOiB7XG4gICAgaWQ6IHtcbiAgICAgIHR5cGU6ICdudW1iZXInLFxuICAgIH0sXG4gICAgbmFtZToge1xuICAgICAgdHlwZTogJ3N0cmluZycsXG4gICAgfSxcbiAgICBleHRlbmRlZDoge1xuICAgICAgdHlwZTogJ29iamVjdCcsXG4gICAgfSxcbiAgICBjaGlsZHJlbjoge1xuICAgICAgdHlwZTogJ2hhc01hbnknLFxuICAgICAgam9pblRhYmxlOiAnY2hpbGRyZW4nLFxuICAgICAgcGFyZW50Q29sdW1uOiAncGFyZW50X2lkJyxcbiAgICAgIGNoaWxkQ29sdW1uOiAnY2hpbGRfaWQnLFxuICAgICAgY2hpbGRUeXBlOiAndGVzdHMnLFxuICAgIH0sXG4gIH0sXG59O1xuXG5mdW5jdGlvbiBydW5TUUwoY29tbWFuZCwgb3B0cyA9IHt9KSB7XG4gIGNvbnN0IGNvbm5PcHRpb25zID0gT2JqZWN0LmFzc2lnbihcbiAgICB7fSxcbiAgICB7XG4gICAgICB1c2VyOiAncG9zdGdyZXMnLFxuICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXG4gICAgICBwb3J0OiA1NDMyLFxuICAgICAgZGF0YWJhc2U6ICdwb3N0Z3JlcycsXG4gICAgICBjaGFyc2V0OiAndXRmOCcsXG4gICAgfSxcbiAgICBvcHRzXG4gICk7XG4gIGNvbnN0IGNsaWVudCA9IG5ldyBwZy5DbGllbnQoY29ubk9wdGlvbnMpO1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICBjbGllbnQuY29ubmVjdCgoZXJyKSA9PiB7XG4gICAgICBpZiAoZXJyKSB0aHJvdyBlcnI7XG4gICAgICBjbGllbnQucXVlcnkoY29tbWFuZCwgKGVycikgPT4ge1xuICAgICAgICBpZiAoZXJyKSB0aHJvdyBlcnI7XG4gICAgICAgIGNsaWVudC5lbmQoKGVycikgPT4ge1xuICAgICAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBmbHVzaFJlZGlzKCkge1xuICBjb25zdCByID0gUmVkaXMuY3JlYXRlQ2xpZW50KHtcbiAgICBwb3J0OiA2Mzc5LFxuICAgIGhvc3Q6ICdsb2NhbGhvc3QnLFxuICAgIGRiOiAwLFxuICB9KTtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB7XG4gICAgci5mbHVzaGRiKChlcnIpID0+IHtcbiAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgIHIucXVpdCgoZXJyKSA9PiB7XG4gICAgICAgIGlmIChlcnIpIHRocm93IGVycjtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xufVxuXG5jb25zdCBzdG9yYWdlVHlwZXMgPSBbXG4gIHtcbiAgICBuYW1lOiAncmVkaXMnLFxuICAgIGNvbnN0cnVjdG9yOiBSZWRpc1N0b3JhZ2UsXG4gICAgb3B0czoge1xuICAgICAgdGVybWluYWw6IHRydWUsXG4gICAgfSxcbiAgICBiZWZvcmU6ICgpID0+IHtcbiAgICAgIHJldHVybiBmbHVzaFJlZGlzKCk7XG4gICAgfSxcbiAgICBhZnRlcjogKGRyaXZlcikgPT4ge1xuICAgICAgcmV0dXJuIGZsdXNoUmVkaXMoKS50aGVuKCgpID0+IGRyaXZlci50ZWFyZG93bigpKTtcbiAgICB9LFxuICB9LFxuICB7XG4gICAgbmFtZTogJ3NxbCcsXG4gICAgY29uc3RydWN0b3I6IFNRTFN0b3JhZ2UsXG4gICAgb3B0czoge1xuICAgICAgc3FsOiB7XG4gICAgICAgIGNvbm5lY3Rpb246IHtcbiAgICAgICAgICBkYXRhYmFzZTogJ2d1aWxkX3Rlc3QnLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHRlcm1pbmFsOiB0cnVlLFxuICAgIH0sXG4gICAgYmVmb3JlOiAoKSA9PiB7XG4gICAgICByZXR1cm4gcnVuU1FMKCdEUk9QIERBVEFCQVNFIGlmIGV4aXN0cyBndWlsZF90ZXN0OycpXG4gICAgICAudGhlbigoKSA9PiBydW5TUUwoJ0NSRUFURSBEQVRBQkFTRSBndWlsZF90ZXN0OycpKVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICByZXR1cm4gcnVuU1FMKGBcbiAgICAgICAgICBDUkVBVEUgU0VRVUVOQ0UgdGVzdGlkX3NlcVxuICAgICAgICAgICAgU1RBUlQgV0lUSCAxXG4gICAgICAgICAgICBJTkNSRU1FTlQgQlkgMVxuICAgICAgICAgICAgTk8gTUlOVkFMVUVcbiAgICAgICAgICAgIE1BWFZBTFVFIDIxNDc0ODM2NDdcbiAgICAgICAgICAgIENBQ0hFIDFcbiAgICAgICAgICAgIENZQ0xFO1xuICAgICAgICAgIENSRUFURSBUQUJMRSB0ZXN0cyAoXG4gICAgICAgICAgICBpZCBpbnRlZ2VyIG5vdCBudWxsIHByaW1hcnkga2V5IERFRkFVTFQgbmV4dHZhbCgndGVzdGlkX3NlcSc6OnJlZ2NsYXNzKSxcbiAgICAgICAgICAgIG5hbWUgdGV4dCxcbiAgICAgICAgICAgIGV4dGVuZGVkIGpzb25iIG5vdCBudWxsIGRlZmF1bHQgJ3t9Jzo6anNvbmJcbiAgICAgICAgICApO1xuICAgICAgICAgIENSRUFURSBUQUJMRSBjaGlsZHJlbiAocGFyZW50X2lkIGludGVnZXIgbm90IG51bGwsIGNoaWxkX2lkIGludGVnZXIgbm90IG51bGwpO1xuICAgICAgICBgLCB7ZGF0YWJhc2U6ICdndWlsZF90ZXN0J30pO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBhZnRlcjogKGRyaXZlcikgPT4ge1xuICAgICAgcmV0dXJuIGRyaXZlci50ZWFyZG93bigpXG4gICAgICAudGhlbigoKSA9PiBydW5TUUwoJ0RST1AgREFUQUJBU0UgZ3VpbGRfdGVzdDsnKSk7XG4gICAgfSxcbiAgfSxcbiAge1xuICAgIG5hbWU6ICdyZXN0JyxcbiAgICBjb25zdHJ1Y3RvcjogUmVzdFN0b3JhZ2UsXG4gICAgb3B0czoge1xuICAgICAgdGVybWluYWw6IHRydWUsXG4gICAgICBheGlvczogYXhpb3NNb2NrLm1vY2t1cCh0ZXN0VHlwZSksXG4gICAgfSxcbiAgfSxcbiAge1xuICAgIG5hbWU6ICdtZW1vcnknLFxuICAgIGNvbnN0cnVjdG9yOiBNZW1vcnlTdG9yYWdlLFxuICAgIG9wdHM6IHt0ZXJtaW5hbDogdHJ1ZX0sXG4gIH0sXG5dO1xuXG5jb25zdCBzYW1wbGVPYmplY3QgPSB7XG4gIG5hbWU6ICdwb3RhdG8nLFxuICBleHRlbmRlZDoge1xuICAgIGFjdHVhbDogJ3J1dGFiYWdhJyxcbiAgICBvdGhlclZhbHVlOiA0MixcbiAgfSxcbn07XG5cbmNoYWkudXNlKGNoYWlBc1Byb21pc2VkKTtcbmNvbnN0IGV4cGVjdCA9IGNoYWkuZXhwZWN0O1xuXG5zdG9yYWdlVHlwZXMuZm9yRWFjaCgoc3RvcmUpID0+IHtcbiAgZGVzY3JpYmUoc3RvcmUubmFtZSwgKCkgPT4ge1xuICAgIGxldCBhY3R1YWxTdG9yZTtcbiAgICBiZWZvcmUoKCkgPT4ge1xuICAgICAgcmV0dXJuIChzdG9yZS5iZWZvcmUgfHwgKCgpID0+IFByb21pc2UucmVzb2x2ZSgpKSkoYWN0dWFsU3RvcmUpXG4gICAgICAudGhlbigoKSA9PiB7XG4gICAgICAgIGFjdHVhbFN0b3JlID0gbmV3IHN0b3JlLmNvbnN0cnVjdG9yKHN0b3JlLm9wdHMpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpdCgnc3VwcG9ydHMgY3JlYXRpbmcgdmFsdWVzIHdpdGggbm8gaWQgZmllbGQsIGFuZCByZXRyaWV2aW5nIHZhbHVlcycsICgpID0+IHtcbiAgICAgIHJldHVybiBhY3R1YWxTdG9yZS53cml0ZSh0ZXN0VHlwZSwgc2FtcGxlT2JqZWN0KVxuICAgICAgLnRoZW4oKGNyZWF0ZWRPYmplY3QpID0+IHtcbiAgICAgICAgcmV0dXJuIGV4cGVjdChhY3R1YWxTdG9yZS5yZWFkKHRlc3RUeXBlLCBjcmVhdGVkT2JqZWN0LmlkKSlcbiAgICAgICAgLnRvLmV2ZW50dWFsbHkuZGVlcC5lcXVhbChPYmplY3QuYXNzaWduKHt9LCBzYW1wbGVPYmplY3QsIHtpZDogY3JlYXRlZE9iamVjdC5pZH0pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgaXQoJ2FsbG93cyBvYmplY3RzIHRvIGJlIHN0b3JlZCBieSBpZCcsICgpID0+IHtcbiAgICAgIHJldHVybiBhY3R1YWxTdG9yZS53cml0ZSh0ZXN0VHlwZSwgc2FtcGxlT2JqZWN0KVxuICAgICAgLnRoZW4oKGNyZWF0ZWRPYmplY3QpID0+IHtcbiAgICAgICAgY29uc3QgbW9kT2JqZWN0ID0gT2JqZWN0LmFzc2lnbih7fSwgY3JlYXRlZE9iamVjdCwge25hbWU6ICdjYXJyb3QnfSk7XG4gICAgICAgIHJldHVybiBhY3R1YWxTdG9yZS53cml0ZSh0ZXN0VHlwZSwgbW9kT2JqZWN0KVxuICAgICAgICAudGhlbigodXBkYXRlZE9iamVjdCkgPT4ge1xuICAgICAgICAgIHJldHVybiBleHBlY3QoYWN0dWFsU3RvcmUucmVhZCh0ZXN0VHlwZSwgdXBkYXRlZE9iamVjdC5pZCkpXG4gICAgICAgICAgLnRvLmV2ZW50dWFsbHkuZGVlcC5lcXVhbChPYmplY3QuYXNzaWduKHt9LCBzYW1wbGVPYmplY3QsIHtpZDogY3JlYXRlZE9iamVjdC5pZCwgbmFtZTogJ2NhcnJvdCd9KSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpdCgnYWxsb3dzIGZvciBkZWxldGlvbiBvZiBvYmplY3RzIGJ5IGlkJywgKCkgPT4ge1xuICAgICAgcmV0dXJuIGFjdHVhbFN0b3JlLndyaXRlKHRlc3RUeXBlLCBzYW1wbGVPYmplY3QpXG4gICAgICAudGhlbigoY3JlYXRlZE9iamVjdCkgPT4ge1xuICAgICAgICByZXR1cm4gYWN0dWFsU3RvcmUuZGVsZXRlKHRlc3RUeXBlLCBjcmVhdGVkT2JqZWN0LmlkKVxuICAgICAgICAudGhlbigoKSA9PiBleHBlY3QoYWN0dWFsU3RvcmUucmVhZCh0ZXN0VHlwZSwgY3JlYXRlZE9iamVjdC5pZCkpLnRvLmV2ZW50dWFsbHkuZGVlcC5lcXVhbChudWxsKSk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGl0KCdzdXBwb3J0cyBxdWVyeWluZyBvYmplY3RzJyk7XG5cbiAgICBpdCgnY2FuIGFkZCB0byBhIGhhc01hbnkgcmVsYXRpb25zaGlwJywgKCkgPT4ge1xuICAgICAgcmV0dXJuIGFjdHVhbFN0b3JlLndyaXRlKHRlc3RUeXBlLCBzYW1wbGVPYmplY3QpXG4gICAgICAudGhlbigoY3JlYXRlZE9iamVjdCkgPT4ge1xuICAgICAgICByZXR1cm4gYWN0dWFsU3RvcmUuYWRkKHRlc3RUeXBlLCBjcmVhdGVkT2JqZWN0LmlkLCAnY2hpbGRyZW4nLCAxMDApXG4gICAgICAgIC50aGVuKCgpID0+IGV4cGVjdChhY3R1YWxTdG9yZS5oYXModGVzdFR5cGUsIGNyZWF0ZWRPYmplY3QuaWQsICdjaGlsZHJlbicpKS50by5ldmVudHVhbGx5LmRlZXAuZXF1YWwoWzEwMF0pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgaXQoJ2NhbiByZW1vdmUgZnJvbSBhIGhhc01hbnkgcmVsYXRpb25zaGlwJywgKCkgPT4ge1xuICAgICAgcmV0dXJuIGFjdHVhbFN0b3JlLndyaXRlKHRlc3RUeXBlLCBzYW1wbGVPYmplY3QpXG4gICAgICAudGhlbigoY3JlYXRlZE9iamVjdCkgPT4ge1xuICAgICAgICByZXR1cm4gYWN0dWFsU3RvcmUuYWRkKHRlc3RUeXBlLCBjcmVhdGVkT2JqZWN0LmlkLCAnY2hpbGRyZW4nLCAxMDApXG4gICAgICAgIC50aGVuKCgpID0+IGV4cGVjdChhY3R1YWxTdG9yZS5oYXModGVzdFR5cGUsIGNyZWF0ZWRPYmplY3QuaWQsICdjaGlsZHJlbicpKS50by5ldmVudHVhbGx5LmRlZXAuZXF1YWwoWzEwMF0pKVxuICAgICAgICAudGhlbigoKSA9PiBhY3R1YWxTdG9yZS5yZW1vdmUodGVzdFR5cGUsIGNyZWF0ZWRPYmplY3QuaWQsICdjaGlsZHJlbicsIDEwMCkpXG4gICAgICAgIC50aGVuKCgpID0+IGV4cGVjdChhY3R1YWxTdG9yZS5oYXModGVzdFR5cGUsIGNyZWF0ZWRPYmplY3QuaWQsICdjaGlsZHJlbicpKS50by5ldmVudHVhbGx5LmRlZXAuZXF1YWwoW10pKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgYWZ0ZXIoKCkgPT4ge1xuICAgICAgcmV0dXJuIChzdG9yZS5hZnRlciB8fCAoKCkgPT4ge30pKShhY3R1YWxTdG9yZSk7XG4gICAgfSk7XG4gIH0pO1xufSk7XG4iXSwic291cmNlUm9vdCI6Ii9zb3VyY2UvIn0=