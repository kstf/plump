"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mergeOptions = require("merge-options");
var rxjs_1 = require("rxjs");
var Storage = (function () {
    function Storage(opts) {
        if (opts === void 0) { opts = {}; }
        this.types = {};
        this.readSubject = new rxjs_1.Subject();
        this.writeSubject = new rxjs_1.Subject();
        this.terminal = opts.terminal || false;
        this.read$ = this.readSubject.asObservable();
        this.write$ = this.writeSubject.asObservable();
    }
    Storage.prototype.readRelationships = function (item, relationships) {
        var _this = this;
        return Promise.all(relationships.map(function (r) { return _this.readRelationship(item, r); }))
            .then(function (rA) {
            return rA.reduce(function (a, r) { return mergeOptions(a, r || {}); }, { type: item.type, id: item.id, attributes: {}, relationships: {} });
        });
    };
    Storage.prototype.read = function (item, opts) {
        var _this = this;
        if (opts === void 0) { opts = ['attributes']; }
        var schema = this.getSchema(item.type);
        var keys = (opts && !Array.isArray(opts) ? [opts] : opts);
        return this.readAttributes(item)
            .then(function (attributes) {
            if (!attributes) {
                return null;
            }
            else {
                if (attributes.id && attributes.attributes && !attributes.attributes[schema.idAttribute]) {
                    attributes.attributes[schema.idAttribute] = attributes.id;
                }
                if (attributes.attributes) {
                    for (var attrName in schema.attributes) {
                        if (!attributes.attributes[attrName] && (schema.attributes[attrName].default !== undefined)) {
                            if (Array.isArray(schema.attributes[attrName].default)) {
                                attributes.attributes[attrName] = schema.attributes[attrName].default.concat();
                            }
                            else if (typeof schema.attributes[attrName].default === 'object') {
                                attributes.attributes[attrName] = Object.assign({}, schema.attributes[attrName].default);
                            }
                            else {
                                attributes.attributes[attrName] = schema.attributes[attrName].default;
                            }
                        }
                    }
                }
                var relsWanted = (keys.indexOf('relationships') >= 0)
                    ? Object.keys(schema.relationships)
                    : keys.map(function (k) { return k.split('.'); })
                        .filter(function (ka) { return ka[0] === 'relationships'; })
                        .map(function (ka) { return ka[1]; });
                var relsToFetch = relsWanted.filter(function (relName) { return !attributes.relationships[relName]; });
                if (relsToFetch.length > 0) {
                    return _this.readRelationships(item, relsToFetch)
                        .then(function (rels) {
                        return mergeOptions(attributes, rels);
                    });
                }
                else {
                    return attributes;
                }
            }
        })
            .then(function (result) {
            if (result) {
                Object.keys(result.relationships).forEach(function (relName) {
                    result.relationships[relName].forEach(function (relItem) {
                        relItem.type = _this.getSchema(result.type).relationships[relName].type.sides[relName].otherType;
                    });
                });
                _this.fireReadUpdate(result);
            }
            return result;
        });
    };
    Storage.prototype.bulkRead = function (item) {
        return this.read(item).then(function (data) {
            if (data.included === undefined) {
                data.included = [];
            }
            return data;
        });
    };
    Storage.prototype.hot = function (item) {
        return false;
    };
    Storage.prototype.validateInput = function (value) {
        var schema = this.getSchema(value.type);
        var retVal = { type: value.type, id: value.id, attributes: {}, relationships: {} };
        var typeAttrs = Object.keys(schema.attributes || {});
        var valAttrs = Object.keys(value.attributes || {});
        var typeRels = Object.keys(schema.relationships || {});
        var valRels = Object.keys(value.relationships || {});
        var idAttribute = schema.idAttribute;
        var invalidAttrs = valAttrs.filter(function (item) { return typeAttrs.indexOf(item) < 0; });
        var invalidRels = valRels.filter(function (item) { return typeRels.indexOf(item) < 0; });
        if (invalidAttrs.length > 0) {
            throw new Error("Invalid attributes on value object: " + JSON.stringify(invalidAttrs));
        }
        if (invalidRels.length > 0) {
            throw new Error("Invalid relationships on value object: " + JSON.stringify(invalidRels));
        }
        if (value.attributes[idAttribute] && !retVal.id) {
            retVal.id = value.attributes[idAttribute];
        }
        for (var relName in schema.relationships) {
            if (value.relationships && value.relationships[relName] && !Array.isArray(value.relationships[relName])) {
                throw new Error("relation " + relName + " is not an array");
            }
        }
        return mergeOptions({}, value, retVal);
    };
    Storage.prototype.getSchema = function (t) {
        if (typeof t === 'string') {
            return this.types[t];
        }
        else if (t['schema']) {
            return t.schema;
        }
        else {
            return t;
        }
    };
    Storage.prototype.addSchema = function (t) {
        this.types[t.type] = t.schema;
        return Promise.resolve();
    };
    Storage.prototype.addSchemas = function (a) {
        var _this = this;
        return Promise.all(a.map(function (t) { return _this.addSchema(t); })).then(function () { });
    };
    Storage.prototype.fireWriteUpdate = function (val) {
        this.writeSubject.next(val);
        return Promise.resolve(val);
    };
    Storage.prototype.fireReadUpdate = function (val) {
        this.readSubject.next(val);
        return Promise.resolve(val);
    };
    return Storage;
}());
exports.Storage = Storage;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zdG9yYWdlL3N0b3JhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFFQSw0Q0FBOEM7QUFFOUMsNkJBQTJDO0FBdUIzQztJQVVFLGlCQUFZLElBQXlCO1FBQXpCLHFCQUFBLEVBQUEsU0FBeUI7UUFMM0IsVUFBSyxHQUFtQyxFQUFFLENBQUM7UUFDN0MsZ0JBQVcsR0FBRyxJQUFJLGNBQU8sRUFBRSxDQUFDO1FBQzVCLGlCQUFZLEdBQUcsSUFBSSxjQUFPLEVBQUUsQ0FBQztRQVluQyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUM3QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDakQsQ0FBQztJQXFCRCxtQ0FBaUIsR0FBakIsVUFBa0IsSUFBb0IsRUFBRSxhQUF1QjtRQUEvRCxpQkFRQztRQVBDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxLQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUE5QixDQUE4QixDQUFDLENBQUM7YUFDekUsSUFBSSxDQUFDLFVBQUEsRUFBRTtZQUNOLE9BQUEsRUFBRSxDQUFDLE1BQU0sQ0FDUCxVQUFDLENBQUMsRUFBRSxDQUFDLElBQUssT0FBQSxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBeEIsQ0FBd0IsRUFDbEMsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxFQUFFLEVBQUUsQ0FDcEU7UUFIRCxDQUdDLENBQ0YsQ0FBQztJQUNKLENBQUM7SUFFRCxzQkFBSSxHQUFKLFVBQUssSUFBb0IsRUFBRSxJQUF3QztRQUFuRSxpQkF1REM7UUF2RDBCLHFCQUFBLEVBQUEsUUFBMkIsWUFBWSxDQUFDO1FBQ2pFLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3pDLElBQU0sSUFBSSxHQUFHLENBQUMsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBYSxDQUFDO1FBQ3hFLE1BQU0sQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQzthQUMvQixJQUFJLENBQUMsVUFBQSxVQUFVO1lBQ2QsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUNoQixNQUFNLENBQUMsSUFBSSxDQUFDO1lBQ2QsQ0FBQztZQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNOLEVBQUUsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxFQUFFLElBQUksVUFBVSxDQUFDLFVBQVUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDekYsVUFBVSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEdBQUcsVUFBVSxDQUFDLEVBQUUsQ0FBQztnQkFDNUQsQ0FBQztnQkFHRCxFQUFFLENBQUMsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQztvQkFDMUIsR0FBRyxDQUFDLENBQUMsSUFBTSxRQUFRLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7d0JBQ3pDLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsQ0FBQzs0QkFDNUYsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztnQ0FDdkQsVUFBVSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsR0FBSSxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQWlCLENBQUMsTUFBTSxFQUFFLENBQUM7NEJBQzVGLENBQUM7NEJBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sTUFBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztnQ0FDbkUsVUFBVSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDOzRCQUMzRixDQUFDOzRCQUFDLElBQUksQ0FBQyxDQUFDO2dDQUNOLFVBQVUsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxPQUFPLENBQUM7NEJBQ3hFLENBQUM7d0JBQ0gsQ0FBQztvQkFDSCxDQUFDO2dCQUNILENBQUM7Z0JBRUQsSUFBTSxVQUFVLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztzQkFDbkQsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDO3NCQUNqQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBWixDQUFZLENBQUM7eUJBQzFCLE1BQU0sQ0FBQyxVQUFBLEVBQUUsSUFBSSxPQUFBLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxlQUFlLEVBQXpCLENBQXlCLENBQUM7eUJBQ3ZDLEdBQUcsQ0FBQyxVQUFBLEVBQUUsSUFBSSxPQUFBLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBTCxDQUFLLENBQUMsQ0FBQztnQkFDdEIsSUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxVQUFBLE9BQU8sSUFBSSxPQUFBLENBQUMsVUFBVSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsRUFBbEMsQ0FBa0MsQ0FBQyxDQUFDO2dCQUVyRixFQUFFLENBQUMsQ0FBQyxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzNCLE1BQU0sQ0FBQyxLQUFJLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQzt5QkFDL0MsSUFBSSxDQUFDLFVBQUEsSUFBSTt3QkFDUixNQUFNLENBQUMsWUFBWSxDQUFDLFVBQVUsRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDeEMsQ0FBQyxDQUFDLENBQUM7Z0JBQ0wsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixNQUFNLENBQUMsVUFBVSxDQUFDO2dCQUNwQixDQUFDO1lBQ0gsQ0FBQztRQUNILENBQUMsQ0FBQzthQUNELElBQUksQ0FBQyxVQUFDLE1BQU07WUFDWCxFQUFFLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO2dCQUNYLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFDLE9BQU87b0JBQ2hELE1BQU0sQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUMsT0FBTzt3QkFDNUMsT0FBTyxDQUFDLElBQUksR0FBRyxLQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxTQUFTLENBQUM7b0JBQ2xHLENBQUMsQ0FBQyxDQUFDO2dCQUNMLENBQUMsQ0FBQyxDQUFDO2dCQUNILEtBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDOUIsQ0FBQztZQUNELE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDaEIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsMEJBQVEsR0FBUixVQUFTLElBQW9CO1FBRzNCLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFBLElBQUk7WUFDOUIsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDO2dCQUNoQyxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztZQUNyQixDQUFDO1lBQ0QsTUFBTSxDQUFDLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUdELHFCQUFHLEdBQUgsVUFBSSxJQUFvQjtRQVV0QixNQUFNLENBQUMsS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQUVELCtCQUFhLEdBQWIsVUFBYyxLQUFzQztRQUNsRCxJQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxQyxJQUFNLE1BQU0sR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLFVBQVUsRUFBRSxFQUFFLEVBQUUsYUFBYSxFQUFFLEVBQUUsRUFBRSxDQUFDO1FBQ3JGLElBQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUN2RCxJQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLElBQUksRUFBRSxDQUFDLENBQUM7UUFDckQsSUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3pELElBQU0sT0FBTyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUN2RCxJQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDO1FBRXZDLElBQU0sWUFBWSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBM0IsQ0FBMkIsQ0FBQyxDQUFDO1FBQzFFLElBQU0sV0FBVyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBMUIsQ0FBMEIsQ0FBQyxDQUFDO1FBRXZFLEVBQUUsQ0FBQyxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF1QyxJQUFJLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBRyxDQUFDLENBQUM7UUFDekYsQ0FBQztRQUVELEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQixNQUFNLElBQUksS0FBSyxDQUFDLDRDQUEwQyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBRyxDQUFDLENBQUM7UUFDM0YsQ0FBQztRQWVELEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUNoRCxNQUFNLENBQUMsRUFBRSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDNUMsQ0FBQztRQUVELEdBQUcsQ0FBQyxDQUFDLElBQU0sT0FBTyxJQUFJLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1lBQzNDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxhQUFhLElBQUksS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDeEcsTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFZLE9BQU8scUJBQWtCLENBQUMsQ0FBQztZQUN6RCxDQUFDO1FBQ0gsQ0FBQztRQUNELE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBSUQsMkJBQVMsR0FBVCxVQUFVLENBQStDO1FBQ3ZELEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7WUFDMUIsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDdkIsQ0FBQztRQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZCLE1BQU0sQ0FBRSxDQUEyQixDQUFDLE1BQU0sQ0FBQztRQUM3QyxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixNQUFNLENBQUMsQ0FBZ0IsQ0FBQztRQUMxQixDQUFDO0lBQ0gsQ0FBQztJQUVELDJCQUFTLEdBQVQsVUFBVSxDQUFzQztRQUM5QyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDO1FBQzlCLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7SUFDM0IsQ0FBQztJQUVELDRCQUFVLEdBQVYsVUFBVyxDQUF3QztRQUFuRCxpQkFJQztRQUhDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUNoQixDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsS0FBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsRUFBakIsQ0FBaUIsQ0FBQyxDQUM5QixDQUFDLElBQUksQ0FBQyxjQUFpQixDQUFDLENBQUMsQ0FBQztJQUM3QixDQUFDO0lBR0QsaUNBQWUsR0FBZixVQUFnQixHQUFlO1FBQzdCLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzVCLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFFRCxnQ0FBYyxHQUFkLFVBQWUsR0FBYztRQUMzQixJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMzQixNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBQ0gsY0FBQztBQUFELENBck5BLEFBcU5DLElBQUE7QUFyTnFCLDBCQUFPIiwiZmlsZSI6InN0b3JhZ2Uvc3RvcmFnZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGVzbGludCBuby11bnVzZWQtdmFyczogMCAqL1xuXG5pbXBvcnQgKiBhcyBtZXJnZU9wdGlvbnMgZnJvbSAnbWVyZ2Utb3B0aW9ucyc7XG4vLyBpbXBvcnQgeyB2YWxpZGF0ZUlucHV0IH0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQgeyBTdWJqZWN0LCBPYnNlcnZhYmxlIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQge1xuICBJbmRlZmluaXRlTW9kZWxEYXRhLFxuICBNb2RlbERhdGEsXG4gIE1vZGVsRGVsdGEsXG4gIE1vZGVsU2NoZW1hLFxuICBNb2RlbFJlZmVyZW5jZSxcbiAgQmFzZVN0b3JlLFxuICBTdG9yYWdlT3B0aW9ucyxcbiAgLy8gUmVsYXRpb25zaGlwSXRlbSxcbn0gZnJvbSAnLi4vZGF0YVR5cGVzJztcblxuLy8gdHlwZTogYW4gb2JqZWN0IHRoYXQgZGVmaW5lcyB0aGUgdHlwZS4gdHlwaWNhbGx5IHRoaXMgd2lsbCBiZVxuLy8gcGFydCBvZiB0aGUgTW9kZWwgY2xhc3MgaGllcmFyY2h5LCBidXQgU3RvcmFnZSBvYmplY3RzIGNhbGwgbm8gbWV0aG9kc1xuLy8gb24gdGhlIHR5cGUgb2JqZWN0LiBXZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIFR5cGUuJG5hbWUsIFR5cGUuJGlkIGFuZCBUeXBlLiRzY2hlbWEuXG4vLyBOb3RlIHRoYXQgVHlwZS4kaWQgaXMgdGhlICpuYW1lIG9mIHRoZSBpZCBmaWVsZCogb24gaW5zdGFuY2VzXG4vLyAgICBhbmQgTk9UIHRoZSBhY3R1YWwgaWQgZmllbGQgKGUuZy4sIGluIG1vc3QgY2FzZXMsIFR5cGUuJGlkID09PSAnaWQnKS5cbi8vIGlkOiB1bmlxdWUgaWQuIE9mdGVuIGFuIGludGVnZXIsIGJ1dCBub3QgbmVjZXNzYXJ5IChjb3VsZCBiZSBhbiBvaWQpXG5cblxuLy8gaGFzTWFueSByZWxhdGlvbnNoaXBzIGFyZSB0cmVhdGVkIGxpa2UgaWQgYXJyYXlzLiBTbywgYWRkIC8gcmVtb3ZlIC8gaGFzXG4vLyBqdXN0IHN0b3JlcyBhbmQgcmVtb3ZlcyBpbnRlZ2Vycy5cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFN0b3JhZ2UgaW1wbGVtZW50cyBCYXNlU3RvcmUge1xuXG4gIHRlcm1pbmFsOiBib29sZWFuO1xuICByZWFkJDogT2JzZXJ2YWJsZTxNb2RlbERhdGE+O1xuICB3cml0ZSQ6IE9ic2VydmFibGU8TW9kZWxEZWx0YT47XG4gIHByb3RlY3RlZCB0eXBlczogeyBbdHlwZTogc3RyaW5nXTogTW9kZWxTY2hlbWF9ID0ge307XG4gIHByaXZhdGUgcmVhZFN1YmplY3QgPSBuZXcgU3ViamVjdCgpO1xuICBwcml2YXRlIHdyaXRlU3ViamVjdCA9IG5ldyBTdWJqZWN0KCk7XG4gIC8vIHByb3RlY3RlZCB0eXBlczogTW9kZWxbXTsgVE9ETzogZmlndXJlIHRoaXMgb3V0XG5cbiAgY29uc3RydWN0b3Iob3B0czogU3RvcmFnZU9wdGlvbnMgPSB7fSkge1xuICAgIC8vIGEgXCJ0ZXJtaW5hbFwiIHN0b3JhZ2UgZmFjaWxpdHkgaXMgdGhlIGVuZCBvZiB0aGUgc3RvcmFnZSBjaGFpbi5cbiAgICAvLyB1c3VhbGx5IHNxbCBvbiB0aGUgc2VydmVyIHNpZGUgYW5kIHJlc3Qgb24gdGhlIGNsaWVudCBzaWRlLCBpdCAqbXVzdCpcbiAgICAvLyByZWNlaXZlIHRoZSB3cml0ZXMsIGFuZCBpcyB0aGUgZmluYWwgYXV0aG9yaXRhdGl2ZSBhbnN3ZXIgb24gd2hldGhlclxuICAgIC8vIHNvbWV0aGluZyBpcyA0MDQuXG5cbiAgICAvLyB0ZXJtaW5hbCBmYWNpbGl0aWVzIGFyZSBhbHNvIHRoZSBvbmx5IG9uZXMgdGhhdCBjYW4gYXV0aG9yaXRhdGl2ZWx5IGFuc3dlclxuICAgIC8vIGF1dGhvcml6YXRpb24gcXVlc3Rpb25zLCBidXQgdGhlIGRlc2lnbiBtYXkgYWxsb3cgZm9yIGF1dGhvcml6YXRpb24gdG8gYmVcbiAgICAvLyBjYWNoZWQuXG4gICAgdGhpcy50ZXJtaW5hbCA9IG9wdHMudGVybWluYWwgfHwgZmFsc2U7XG4gICAgdGhpcy5yZWFkJCA9IHRoaXMucmVhZFN1YmplY3QuYXNPYnNlcnZhYmxlKCk7XG4gICAgdGhpcy53cml0ZSQgPSB0aGlzLndyaXRlU3ViamVjdC5hc09ic2VydmFibGUoKTtcbiAgfVxuXG4gIC8vIEFic3RyYWN0IC0gYWxsIHN0b3JlcyBtdXN0IHByb3ZpZGUgYmVsb3c6XG5cbiAgLy8gYWJzdHJhY3QgYWxsb2NhdGVJZCh0eXBlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IG51bWJlcj47XG4gIC8vIGFic3RyYWN0IHdyaXRlQXR0cmlidXRlcyh2YWx1ZTogSW5kZWZpbml0ZU1vZGVsRGF0YSk6IFByb21pc2U8TW9kZWxEYXRhPjtcbiAgYWJzdHJhY3QgcmVhZEF0dHJpYnV0ZXModmFsdWU6IE1vZGVsUmVmZXJlbmNlKTogUHJvbWlzZTxNb2RlbERhdGE+O1xuICBhYnN0cmFjdCByZWFkUmVsYXRpb25zaGlwKHZhbHVlOiBNb2RlbFJlZmVyZW5jZSwgcmVsTmFtZTogc3RyaW5nKTogUHJvbWlzZTxNb2RlbERhdGE+O1xuICAvLyBhYnN0cmFjdCBkZWxldGUodmFsdWU6IE1vZGVsUmVmZXJlbmNlKTogUHJvbWlzZTx2b2lkPjtcbiAgLy8gYWJzdHJhY3Qgd3JpdGVSZWxhdGlvbnNoaXBJdGVtKCB2YWx1ZTogTW9kZWxSZWZlcmVuY2UsIHJlbE5hbWU6IHN0cmluZywgY2hpbGQ6IHtpZDogc3RyaW5nIHwgbnVtYmVyfSApOiBQcm9taXNlPE1vZGVsRGF0YT47XG4gIC8vIGFic3RyYWN0IGRlbGV0ZVJlbGF0aW9uc2hpcEl0ZW0oIHZhbHVlOiBNb2RlbFJlZmVyZW5jZSwgcmVsTmFtZTogc3RyaW5nLCBjaGlsZDoge2lkOiBzdHJpbmcgfCBudW1iZXJ9ICk6IFByb21pc2U8TW9kZWxEYXRhPjtcbiAgLy9cbiAgLy9cbiAgLy8gcXVlcnkocTogYW55KTogUHJvbWlzZTxNb2RlbFJlZmVyZW5jZVtdPiB7XG4gIC8vICAgLy8gcToge3R5cGU6IHN0cmluZywgcXVlcnk6IGFueX1cbiAgLy8gICAvLyBxLnF1ZXJ5IGlzIGltcGwgZGVmaW5lZCAtIGEgc3RyaW5nIGZvciBzcWwgKHJhdyBzcWwpXG4gIC8vICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignUXVlcnkgbm90IGltcGxlbWVudGVkJykpO1xuICAvLyB9XG4gIC8vXG4gIC8vIGNvbnZlbmllbmNlIGZ1bmN0aW9uIHVzZWQgaW50ZXJuYWxseVxuICAvLyByZWFkIGEgYnVuY2ggb2YgcmVsYXRpb25zaGlwcyBhbmQgbWVyZ2UgdGhlbSB0b2dldGhlci5cbiAgcmVhZFJlbGF0aW9uc2hpcHMoaXRlbTogTW9kZWxSZWZlcmVuY2UsIHJlbGF0aW9uc2hpcHM6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHJlbGF0aW9uc2hpcHMubWFwKHIgPT4gdGhpcy5yZWFkUmVsYXRpb25zaGlwKGl0ZW0sIHIpKSlcbiAgICAudGhlbihyQSA9PlxuICAgICAgckEucmVkdWNlKFxuICAgICAgICAoYSwgcikgPT4gbWVyZ2VPcHRpb25zKGEsIHIgfHwge30pLFxuICAgICAgICB7IHR5cGU6IGl0ZW0udHlwZSwgaWQ6IGl0ZW0uaWQsIGF0dHJpYnV0ZXM6IHt9LCByZWxhdGlvbnNoaXBzOiB7fSB9XG4gICAgICApXG4gICAgKTtcbiAgfVxuXG4gIHJlYWQoaXRlbTogTW9kZWxSZWZlcmVuY2UsIG9wdHM6IHN0cmluZyB8IHN0cmluZ1tdID0gWydhdHRyaWJ1dGVzJ10pIHtcbiAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmdldFNjaGVtYShpdGVtLnR5cGUpO1xuICAgIGNvbnN0IGtleXMgPSAob3B0cyAmJiAhQXJyYXkuaXNBcnJheShvcHRzKSA/IFtvcHRzXSA6IG9wdHMpIGFzIHN0cmluZ1tdO1xuICAgIHJldHVybiB0aGlzLnJlYWRBdHRyaWJ1dGVzKGl0ZW0pXG4gICAgLnRoZW4oYXR0cmlidXRlcyA9PiB7XG4gICAgICBpZiAoIWF0dHJpYnV0ZXMpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoYXR0cmlidXRlcy5pZCAmJiBhdHRyaWJ1dGVzLmF0dHJpYnV0ZXMgJiYgIWF0dHJpYnV0ZXMuYXR0cmlidXRlc1tzY2hlbWEuaWRBdHRyaWJ1dGVdKSB7XG4gICAgICAgICAgYXR0cmlidXRlcy5hdHRyaWJ1dGVzW3NjaGVtYS5pZEF0dHJpYnV0ZV0gPSBhdHRyaWJ1dGVzLmlkOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXBhcmFtLXJlYXNzaWduXG4gICAgICAgIH1cblxuICAgICAgICAvLyBsb2FkIGluIGRlZmF1bHQgdmFsdWVzXG4gICAgICAgIGlmIChhdHRyaWJ1dGVzLmF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGF0dHJOYW1lIGluIHNjaGVtYS5hdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBpZiAoIWF0dHJpYnV0ZXMuYXR0cmlidXRlc1thdHRyTmFtZV0gJiYgKHNjaGVtYS5hdHRyaWJ1dGVzW2F0dHJOYW1lXS5kZWZhdWx0ICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHNjaGVtYS5hdHRyaWJ1dGVzW2F0dHJOYW1lXS5kZWZhdWx0KSkge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXMuYXR0cmlidXRlc1thdHRyTmFtZV0gPSAoc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLmRlZmF1bHQgYXMgYW55W10pLmNvbmNhdCgpO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBzY2hlbWEuYXR0cmlidXRlc1thdHRyTmFtZV0uZGVmYXVsdCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzLmF0dHJpYnV0ZXNbYXR0ck5hbWVdID0gT2JqZWN0LmFzc2lnbih7fSwgc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLmRlZmF1bHQpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXMuYXR0cmlidXRlc1thdHRyTmFtZV0gPSBzY2hlbWEuYXR0cmlidXRlc1thdHRyTmFtZV0uZGVmYXVsdDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlbHNXYW50ZWQgPSAoa2V5cy5pbmRleE9mKCdyZWxhdGlvbnNoaXBzJykgPj0gMClcbiAgICAgICAgICA/IE9iamVjdC5rZXlzKHNjaGVtYS5yZWxhdGlvbnNoaXBzKVxuICAgICAgICAgIDoga2V5cy5tYXAoayA9PiBrLnNwbGl0KCcuJykpXG4gICAgICAgICAgICAuZmlsdGVyKGthID0+IGthWzBdID09PSAncmVsYXRpb25zaGlwcycpXG4gICAgICAgICAgICAubWFwKGthID0+IGthWzFdKTtcbiAgICAgICAgY29uc3QgcmVsc1RvRmV0Y2ggPSByZWxzV2FudGVkLmZpbHRlcihyZWxOYW1lID0+ICFhdHRyaWJ1dGVzLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0pO1xuICAgICAgICAvLyByZWFkQXR0cmlidXRlcyBjYW4gcmV0dXJuIHJlbGF0aW9uc2hpcCBkYXRhLCBzbyBkb24ndCBmZXRjaCB0aG9zZVxuICAgICAgICBpZiAocmVsc1RvRmV0Y2gubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlYWRSZWxhdGlvbnNoaXBzKGl0ZW0sIHJlbHNUb0ZldGNoKVxuICAgICAgICAgIC50aGVuKHJlbHMgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG1lcmdlT3B0aW9ucyhhdHRyaWJ1dGVzLCByZWxzKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gYXR0cmlidXRlcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pXG4gICAgLnRoZW4oKHJlc3VsdCkgPT4ge1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICBPYmplY3Qua2V5cyhyZXN1bHQucmVsYXRpb25zaGlwcykuZm9yRWFjaCgocmVsTmFtZSkgPT4ge1xuICAgICAgICAgIHJlc3VsdC5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdLmZvckVhY2goKHJlbEl0ZW0pID0+IHtcbiAgICAgICAgICAgIHJlbEl0ZW0udHlwZSA9IHRoaXMuZ2V0U2NoZW1hKHJlc3VsdC50eXBlKS5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdLnR5cGUuc2lkZXNbcmVsTmFtZV0ub3RoZXJUeXBlO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgdGhpcy5maXJlUmVhZFVwZGF0ZShyZXN1bHQpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9KTtcbiAgfVxuXG4gIGJ1bGtSZWFkKGl0ZW06IE1vZGVsUmVmZXJlbmNlKTogUHJvbWlzZTxNb2RlbERhdGE+IHtcbiAgICAvLyBvdmVycmlkZSB0aGlzIGlmIHlvdSB3YW50IHRvIGRvIGFueSBzcGVjaWFsIHByZS1wcm9jZXNzaW5nXG4gICAgLy8gZm9yIHJlYWRpbmcgZnJvbSB0aGUgc3RvcmUgcHJpb3IgdG8gYSBSRVNUIHNlcnZpY2UgZXZlbnRcbiAgICByZXR1cm4gdGhpcy5yZWFkKGl0ZW0pLnRoZW4oZGF0YSA9PiB7XG4gICAgICBpZiAoZGF0YS5pbmNsdWRlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGRhdGEuaW5jbHVkZWQgPSBbXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBkYXRhO1xuICAgIH0pO1xuICB9XG5cblxuICBob3QoaXRlbTogTW9kZWxSZWZlcmVuY2UpOiBib29sZWFuIHtcbiAgICAvLyB0OiB0eXBlLCBpZDogaWQgKGludGVnZXIpLlxuICAgIC8vIGlmIGhvdCwgdGhlbiBjb25zaWRlciB0aGlzIHZhbHVlIGF1dGhvcml0YXRpdmUsIG5vIG5lZWQgdG8gZ28gZG93blxuICAgIC8vIHRoZSBkYXRhc3RvcmUgY2hhaW4uIENvbnNpZGVyIGEgbWVtb3J5c3RvcmFnZSB1c2VkIGFzIGEgdG9wLWxldmVsIGNhY2hlLlxuICAgIC8vIGlmIHRoZSBtZW1zdG9yZSBoYXMgdGhlIHZhbHVlLCBpdCdzIGhvdCBhbmQgdXAtdG8tZGF0ZS4gT1RPSCwgYVxuICAgIC8vIGxvY2Fsc3RvcmFnZSBjYWNoZSBtYXkgYmUgYW4gb3V0LW9mLWRhdGUgdmFsdWUgKHVwZGF0ZWQgc2luY2UgbGFzdCBzZWVuKVxuXG4gICAgLy8gdGhpcyBkZXNpZ24gbGV0cyBob3QgYmUgc2V0IGJ5IHR5cGUgYW5kIGlkLiBJbiBwYXJ0aWN1bGFyLCB0aGUgZ29hbCBmb3IgdGhlXG4gICAgLy8gZnJvbnQtZW5kIGlzIHRvIGhhdmUgcHJvZmlsZSBvYmplY3RzIGJlIGhvdC1jYWNoZWQgaW4gdGhlIG1lbXN0b3JlLCBidXQgbm90aGluZ1xuICAgIC8vIGVsc2UgKGluIG9yZGVyIHRvIG5vdCBydW4gdGhlIGJyb3dzZXIgb3V0IG9mIG1lbW9yeSlcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICB2YWxpZGF0ZUlucHV0KHZhbHVlOiBNb2RlbERhdGEgfCBJbmRlZmluaXRlTW9kZWxEYXRhKTogdHlwZW9mIHZhbHVlIHtcbiAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmdldFNjaGVtYSh2YWx1ZS50eXBlKTtcbiAgICBjb25zdCByZXRWYWwgPSB7IHR5cGU6IHZhbHVlLnR5cGUsIGlkOiB2YWx1ZS5pZCwgYXR0cmlidXRlczoge30sIHJlbGF0aW9uc2hpcHM6IHt9IH07XG4gICAgY29uc3QgdHlwZUF0dHJzID0gT2JqZWN0LmtleXMoc2NoZW1hLmF0dHJpYnV0ZXMgfHwge30pO1xuICAgIGNvbnN0IHZhbEF0dHJzID0gT2JqZWN0LmtleXModmFsdWUuYXR0cmlidXRlcyB8fCB7fSk7XG4gICAgY29uc3QgdHlwZVJlbHMgPSBPYmplY3Qua2V5cyhzY2hlbWEucmVsYXRpb25zaGlwcyB8fCB7fSk7XG4gICAgY29uc3QgdmFsUmVscyA9IE9iamVjdC5rZXlzKHZhbHVlLnJlbGF0aW9uc2hpcHMgfHwge30pO1xuICAgIGNvbnN0IGlkQXR0cmlidXRlID0gc2NoZW1hLmlkQXR0cmlidXRlO1xuXG4gICAgY29uc3QgaW52YWxpZEF0dHJzID0gdmFsQXR0cnMuZmlsdGVyKGl0ZW0gPT4gdHlwZUF0dHJzLmluZGV4T2YoaXRlbSkgPCAwKTtcbiAgICBjb25zdCBpbnZhbGlkUmVscyA9IHZhbFJlbHMuZmlsdGVyKGl0ZW0gPT4gdHlwZVJlbHMuaW5kZXhPZihpdGVtKSA8IDApO1xuXG4gICAgaWYgKGludmFsaWRBdHRycy5sZW5ndGggPiAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgYXR0cmlidXRlcyBvbiB2YWx1ZSBvYmplY3Q6ICR7SlNPTi5zdHJpbmdpZnkoaW52YWxpZEF0dHJzKX1gKTtcbiAgICB9XG5cbiAgICBpZiAoaW52YWxpZFJlbHMubGVuZ3RoID4gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIHJlbGF0aW9uc2hpcHMgb24gdmFsdWUgb2JqZWN0OiAke0pTT04uc3RyaW5naWZ5KGludmFsaWRSZWxzKX1gKTtcbiAgICB9XG5cbiAgICAvL1xuICAgIC8vIGZvciAoY29uc3QgYXR0ck5hbWUgaW4gc2NoZW1hLmF0dHJpYnV0ZXMpIHtcbiAgICAvLyAgIGlmICghdmFsdWUuYXR0cmlidXRlc1thdHRyTmFtZV0gJiYgKHNjaGVtYS5hdHRyaWJ1dGVzW2F0dHJOYW1lXS5kZWZhdWx0ICE9PSB1bmRlZmluZWQpKSB7XG4gICAgLy8gICAgIGlmIChBcnJheS5pc0FycmF5KHNjaGVtYS5hdHRyaWJ1dGVzW2F0dHJOYW1lXS5kZWZhdWx0KSkge1xuICAgIC8vICAgICAgIHJldFZhbC5hdHRyaWJ1dGVzW2F0dHJOYW1lXSA9IChzY2hlbWEuYXR0cmlidXRlc1thdHRyTmFtZV0uZGVmYXVsdCBhcyBhbnlbXSkuY29uY2F0KCk7XG4gICAgLy8gICAgIH0gZWxzZSBpZiAodHlwZW9mIHNjaGVtYS5hdHRyaWJ1dGVzW2F0dHJOYW1lXS5kZWZhdWx0ID09PSAnb2JqZWN0Jykge1xuICAgIC8vICAgICAgIHJldFZhbC5hdHRyaWJ1dGVzW2F0dHJOYW1lXSA9IE9iamVjdC5hc3NpZ24oe30sIHNjaGVtYS5hdHRyaWJ1dGVzW2F0dHJOYW1lXS5kZWZhdWx0KTtcbiAgICAvLyAgICAgfSBlbHNlIHtcbiAgICAvLyAgICAgICByZXRWYWwuYXR0cmlidXRlc1thdHRyTmFtZV0gPSBzY2hlbWEuYXR0cmlidXRlc1thdHRyTmFtZV0uZGVmYXVsdDtcbiAgICAvLyAgICAgfVxuICAgIC8vICAgfVxuICAgIC8vIH1cblxuICAgIGlmICh2YWx1ZS5hdHRyaWJ1dGVzW2lkQXR0cmlidXRlXSAmJiAhcmV0VmFsLmlkKSB7XG4gICAgICByZXRWYWwuaWQgPSB2YWx1ZS5hdHRyaWJ1dGVzW2lkQXR0cmlidXRlXTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IHJlbE5hbWUgaW4gc2NoZW1hLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgIGlmICh2YWx1ZS5yZWxhdGlvbnNoaXBzICYmIHZhbHVlLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0gJiYgIUFycmF5LmlzQXJyYXkodmFsdWUucmVsYXRpb25zaGlwc1tyZWxOYW1lXSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGByZWxhdGlvbiAke3JlbE5hbWV9IGlzIG5vdCBhbiBhcnJheWApO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbWVyZ2VPcHRpb25zKHt9LCB2YWx1ZSwgcmV0VmFsKTtcbiAgfVxuXG4gIC8vIHN0b3JlIHR5cGUgaW5mbyBkYXRhIG9uIHRoZSBzdG9yZSBpdHNlbGZcblxuICBnZXRTY2hlbWEodDoge3NjaGVtYTogTW9kZWxTY2hlbWF9IHwgTW9kZWxTY2hlbWEgfCBzdHJpbmcpOiBNb2RlbFNjaGVtYSB7XG4gICAgaWYgKHR5cGVvZiB0ID09PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIHRoaXMudHlwZXNbdF07XG4gICAgfSBlbHNlIGlmICh0WydzY2hlbWEnXSkge1xuICAgICAgcmV0dXJuICh0IGFzIHtzY2hlbWE6IE1vZGVsU2NoZW1hfSkuc2NoZW1hO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdCBhcyBNb2RlbFNjaGVtYTtcbiAgICB9XG4gIH1cblxuICBhZGRTY2hlbWEodDoge3R5cGU6IHN0cmluZywgc2NoZW1hOiBNb2RlbFNjaGVtYX0pIHtcbiAgICB0aGlzLnR5cGVzW3QudHlwZV0gPSB0LnNjaGVtYTtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG4gIH1cblxuICBhZGRTY2hlbWFzKGE6IHt0eXBlOiBzdHJpbmcsIHNjaGVtYTogTW9kZWxTY2hlbWF9W10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoXG4gICAgICBhLm1hcCh0ID0+IHRoaXMuYWRkU2NoZW1hKHQpKVxuICAgICkudGhlbigoKSA9PiB7Lyogbm9vcCAqL30pO1xuICB9XG5cblxuICBmaXJlV3JpdGVVcGRhdGUodmFsOiBNb2RlbERlbHRhKSB7XG4gICAgdGhpcy53cml0ZVN1YmplY3QubmV4dCh2YWwpO1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodmFsKTtcbiAgfVxuXG4gIGZpcmVSZWFkVXBkYXRlKHZhbDogTW9kZWxEYXRhKSB7XG4gICAgdGhpcy5yZWFkU3ViamVjdC5uZXh0KHZhbCk7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh2YWwpO1xuICB9XG59XG4iXX0=
