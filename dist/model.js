"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mergeOptions = require("merge-options");
var rxjs_1 = require("rxjs");
var plumpObservable_1 = require("./plumpObservable");
var Model = (function () {
    function Model(opts, plump) {
        this.plump = plump;
        this.error = null;
        if (this.type === 'BASE') {
            throw new TypeError('Cannot instantiate base plump Models, please subclass with a schema and valid type');
        }
        this.dirty = {
            attributes: {},
            relationships: {},
        };
        this.$$copyValuesFrom(opts);
    }
    Object.defineProperty(Model.prototype, "type", {
        get: function () {
            return this.constructor['type'];
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Model.prototype, "schema", {
        get: function () {
            return this.constructor['schema'];
        },
        enumerable: true,
        configurable: true
    });
    Model.prototype.dirtyFields = function () {
        var _this = this;
        return Object.keys(this.dirty.attributes)
            .filter(function (k) { return k !== _this.schema.idAttribute; })
            .concat(Object.keys(this.dirty.relationships));
    };
    Model.prototype.$$copyValuesFrom = function (opts) {
        if (opts === void 0) { opts = {}; }
        if (this.id === undefined && opts[this.schema.idAttribute]) {
            this.id = opts[this.schema.idAttribute];
        }
        this.dirty = mergeOptions(this.dirty, { attributes: opts });
    };
    Model.prototype.$$resetDirty = function () {
        this.dirty = {
            attributes: {},
            relationships: {},
        };
    };
    Model.prototype.get = function (opts) {
        var _this = this;
        if (opts === void 0) { opts = 'attributes'; }
        var keys = opts && !Array.isArray(opts) ? [opts] : opts;
        return this.plump
            .get(this, keys)
            .catch(function (e) {
            _this.error = e;
            return null;
        })
            .then(function (self) {
            if (!self && _this.dirtyFields().length === 0) {
                return null;
            }
            else if (_this.dirtyFields().length === 0) {
                return self;
            }
            else {
                var resolved = Model.resolveAndOverlay(_this.dirty, self || undefined);
                return mergeOptions({}, self || { id: _this.id, type: _this.type }, resolved);
            }
        });
    };
    Model.prototype.bulkGet = function () {
        return this.plump.bulkGet(this);
    };
    Model.prototype.save = function () {
        var _this = this;
        var update = mergeOptions({ id: this.id, type: this.type }, this.dirty);
        return this.plump
            .save(update)
            .then(function (updated) {
            _this.$$resetDirty();
            if (updated.id) {
                _this.id = updated.id;
            }
            return _this.get();
        })
            .catch(function (err) {
            throw err;
        });
    };
    Model.prototype.set = function (update) {
        var _this = this;
        var flat = update.attributes || update;
        var sanitized = Object.keys(flat)
            .filter(function (k) { return k in _this.schema.attributes; })
            .map(function (k) {
            return _a = {}, _a[k] = flat[k], _a;
            var _a;
        })
            .reduce(function (acc, curr) { return mergeOptions(acc, curr); }, {});
        this.$$copyValuesFrom(sanitized);
        return this;
    };
    Model.prototype.asObservable = function (opts) {
        var _this = this;
        if (opts === void 0) { opts = ['relationships', 'attributes']; }
        var fields = Array.isArray(opts) ? opts.concat() : [opts];
        if (fields.indexOf('relationships') >= 0) {
            fields = fields.concat(Object.keys(this.schema.relationships).map(function (k) { return "relationships." + k; }));
        }
        var hots = this.plump.caches.filter(function (s) { return s.hot(_this); });
        var colds = this.plump.caches.filter(function (s) { return !s.hot(_this); });
        var terminal = this.plump.terminal;
        var preload$ = rxjs_1.Observable.from(hots)
            .flatMap(function (s) { return rxjs_1.Observable.fromPromise(s.read(_this, fields)); })
            .defaultIfEmpty(null)
            .flatMap(function (v) {
            if (v !== null) {
                return rxjs_1.Observable.of(v);
            }
            else {
                var terminal$ = rxjs_1.Observable.fromPromise(terminal.read(_this, fields));
                var cold$ = rxjs_1.Observable.from(colds).flatMap(function (s) {
                    return rxjs_1.Observable.fromPromise(s.read(_this, fields));
                });
                return rxjs_1.Observable.merge(terminal$, cold$.takeUntil(terminal$));
            }
        });
        var watchWrite$ = terminal.write$
            .filter(function (v) {
            return (v.type === _this.type &&
                v.id === _this.id &&
                v.invalidate.some(function (i) { return fields.indexOf(i) >= 0; }));
        })
            .flatMapTo(rxjs_1.Observable.of(terminal).flatMap(function (s) {
            return rxjs_1.Observable.fromPromise(s.read(_this, fields));
        }));
        return rxjs_1.Observable.merge(preload$, watchWrite$).let(function (obs) {
            return new plumpObservable_1.PlumpObservable(_this.plump, obs);
        });
    };
    Model.prototype.subscribe = function (arg1, arg2) {
        var fields = [];
        var cb = null;
        if (arg2) {
            cb = arg2;
            if (Array.isArray(arg1)) {
                fields = arg1;
            }
            else {
                fields = [arg1];
            }
        }
        else {
            cb = arg1;
            fields = ['attributes'];
        }
        return this.asObservable(fields).subscribe(cb);
    };
    Model.prototype.delete = function () {
        return this.plump.delete(this);
    };
    Model.prototype.add = function (key, item) {
        if (key in this.schema.relationships) {
            if (item.id >= 1) {
                if (this.dirty.relationships[key] === undefined) {
                    this.dirty.relationships[key] = [];
                }
                this.dirty.relationships[key].push({
                    op: 'add',
                    data: item,
                });
                return this;
            }
            else {
                throw new Error('Invalid item added to hasMany');
            }
        }
        else {
            throw new Error('Cannot $add except to hasMany field');
        }
    };
    Model.prototype.modifyRelationship = function (key, item) {
        if (key in this.schema.relationships) {
            if (item.id >= 1) {
                this.dirty.relationships[key] = this.dirty.relationships[key] || [];
                this.dirty.relationships[key].push({
                    op: 'modify',
                    data: item,
                });
                return this;
            }
            else {
                throw new Error('Invalid item added to hasMany');
            }
        }
        else {
            throw new Error('Cannot $add except to hasMany field');
        }
    };
    Model.prototype.remove = function (key, item) {
        if (key in this.schema.relationships) {
            if (item.id >= 1) {
                if (!(key in this.dirty.relationships)) {
                    this.dirty.relationships[key] = [];
                }
                this.dirty.relationships[key].push({
                    op: 'remove',
                    data: item,
                });
                return this;
            }
            else {
                throw new Error('Invalid item $removed from hasMany');
            }
        }
        else {
            throw new Error('Cannot $remove except from hasMany field');
        }
    };
    Model.applyDelta = function (current, delta) {
        if (delta.op === 'add' || delta.op === 'modify') {
            var retVal = mergeOptions({}, current, delta.data);
            return retVal;
        }
        else if (delta.op === 'remove') {
            return undefined;
        }
        else {
            return current;
        }
    };
    Model.resolveAndOverlay = function (update, base) {
        if (base === void 0) { base = {
            attributes: {},
            relationships: {},
        }; }
        var attributes = mergeOptions({}, base.attributes, update.attributes);
        var resolvedRelationships = this.resolveRelationships(update.relationships, base.relationships);
        return { attributes: attributes, relationships: resolvedRelationships };
    };
    Model.resolveRelationships = function (deltas, base) {
        var _this = this;
        if (base === void 0) { base = {}; }
        var updates = Object.keys(deltas)
            .map(function (relName) {
            var resolved = _this.resolveRelationship(deltas[relName], base[relName]);
            return _a = {}, _a[relName] = resolved, _a;
            var _a;
        })
            .reduce(function (acc, curr) { return mergeOptions(acc, curr); }, {});
        return mergeOptions({}, base, updates);
    };
    Model.resolveRelationship = function (deltas, base) {
        if (base === void 0) { base = []; }
        var retVal = base.concat();
        deltas.forEach(function (delta) {
            if (delta.op === 'add' || delta.op === 'modify') {
                var currentIndex = retVal.findIndex(function (v) { return v.id === delta.data.id; });
                if (currentIndex >= 0) {
                    retVal[currentIndex] = delta.data;
                }
                else {
                    retVal.push(delta.data);
                }
            }
            else if (delta.op === 'remove') {
                var currentIndex = retVal.findIndex(function (v) { return v.id === delta.data.id; });
                if (currentIndex >= 0) {
                    retVal.splice(currentIndex, 1);
                }
            }
        });
        return retVal;
    };
    Model.type = 'BASE';
    Model.schema = {
        idAttribute: 'id',
        name: 'BASE',
        attributes: {},
        relationships: {},
    };
    return Model;
}());
exports.Model = Model;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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O2dCQUNqQyxJQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLEVBQUUsS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBdEIsQ0FBc0IsQ0FBQyxDQUFDO2dCQUNuRSxFQUFFLENBQUMsQ0FBQyxZQUFZLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDdEIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pDLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDSCxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFoVk0sVUFBSSxHQUFHLE1BQU0sQ0FBQztJQUNkLFlBQU0sR0FBZ0I7UUFDM0IsV0FBVyxFQUFFLElBQUk7UUFDakIsSUFBSSxFQUFFLE1BQU07UUFDWixVQUFVLEVBQUUsRUFBRTtRQUNkLGFBQWEsRUFBRSxFQUFFO0tBQ2xCLENBQUM7SUEyVUosWUFBQztDQW5WRCxBQW1WQyxJQUFBO0FBblZZLHNCQUFLIiwiZmlsZSI6Im1vZGVsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgbWVyZ2VPcHRpb25zIGZyb20gJ21lcmdlLW9wdGlvbnMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgU3Vic2NyaXB0aW9uLCBPYnNlcnZlciB9IGZyb20gJ3J4anMnO1xuXG5pbXBvcnQge1xuICBNb2RlbERhdGEsXG4gIE1vZGVsRGVsdGEsXG4gIE1vZGVsU2NoZW1hLFxuICBEaXJ0eVZhbHVlcyxcbiAgRGlydHlNb2RlbCxcbiAgUmVsYXRpb25zaGlwRGVsdGEsXG4gIFJlbGF0aW9uc2hpcEl0ZW0sXG4gIENhY2hlU3RvcmUsXG4gIFRlcm1pbmFsU3RvcmUsXG59IGZyb20gJy4vZGF0YVR5cGVzJztcblxuaW1wb3J0IHsgUGx1bXAgfSBmcm9tICcuL3BsdW1wJztcbmltcG9ydCB7IFBsdW1wT2JzZXJ2YWJsZSB9IGZyb20gJy4vcGx1bXBPYnNlcnZhYmxlJztcbmltcG9ydCB7IFBsdW1wRXJyb3IgfSBmcm9tICcuL2Vycm9ycyc7XG5cbi8vIFRPRE86IGZpZ3VyZSBvdXQgd2hlcmUgZXJyb3IgZXZlbnRzIG9yaWdpbmF0ZSAoc3RvcmFnZSBvciBtb2RlbClcbi8vIGFuZCB3aG8ga2VlcHMgYSByb2xsLWJhY2thYmxlIGRlbHRhXG5cbmV4cG9ydCBjbGFzcyBNb2RlbDxNRCBleHRlbmRzIE1vZGVsRGF0YT4ge1xuICBpZDogc3RyaW5nIHwgbnVtYmVyO1xuICBzdGF0aWMgdHlwZSA9ICdCQVNFJztcbiAgc3RhdGljIHNjaGVtYTogTW9kZWxTY2hlbWEgPSB7XG4gICAgaWRBdHRyaWJ1dGU6ICdpZCcsXG4gICAgbmFtZTogJ0JBU0UnLFxuICAgIGF0dHJpYnV0ZXM6IHt9LFxuICAgIHJlbGF0aW9uc2hpcHM6IHt9LFxuICB9O1xuXG4gIHB1YmxpYyBlcnJvcjogUGx1bXBFcnJvcjtcblxuICBwcml2YXRlIGRpcnR5OiBEaXJ0eVZhbHVlcztcblxuICBnZXQgdHlwZSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3RvclsndHlwZSddO1xuICB9XG5cbiAgZ2V0IHNjaGVtYSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvclsnc2NoZW1hJ107XG4gIH1cblxuICBkaXJ0eUZpZWxkcygpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5kaXJ0eS5hdHRyaWJ1dGVzKVxuICAgICAgLmZpbHRlcihrID0+IGsgIT09IHRoaXMuc2NoZW1hLmlkQXR0cmlidXRlKVxuICAgICAgLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLmRpcnR5LnJlbGF0aW9uc2hpcHMpKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKG9wdHMsIHByaXZhdGUgcGx1bXA6IFBsdW1wKSB7XG4gICAgLy8gVE9ETzogRGVmaW5lIERlbHRhIGludGVyZmFjZVxuICAgIHRoaXMuZXJyb3IgPSBudWxsO1xuICAgIGlmICh0aGlzLnR5cGUgPT09ICdCQVNFJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgJ0Nhbm5vdCBpbnN0YW50aWF0ZSBiYXNlIHBsdW1wIE1vZGVscywgcGxlYXNlIHN1YmNsYXNzIHdpdGggYSBzY2hlbWEgYW5kIHZhbGlkIHR5cGUnLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0aGlzLmRpcnR5ID0ge1xuICAgICAgYXR0cmlidXRlczoge30sIC8vIFNpbXBsZSBrZXktdmFsdWVcbiAgICAgIHJlbGF0aW9uc2hpcHM6IHt9LCAvLyByZWxOYW1lOiBEZWx0YVtdXG4gICAgfTtcbiAgICB0aGlzLiQkY29weVZhbHVlc0Zyb20ob3B0cyk7XG4gICAgLy8gdGhpcy4kJGZpcmVVcGRhdGUob3B0cyk7XG4gIH1cblxuICAkJGNvcHlWYWx1ZXNGcm9tKG9wdHMgPSB7fSk6IHZvaWQge1xuICAgIC8vIGNvbnN0IGlkRmllbGQgPSB0aGlzLmNvbnN0cnVjdG9yLiRpZCBpbiBvcHRzID8gdGhpcy5jb25zdHJ1Y3Rvci4kaWQgOiAnaWQnO1xuICAgIC8vIHRoaXNbdGhpcy5jb25zdHJ1Y3Rvci4kaWRdID0gb3B0c1tpZEZpZWxkXSB8fCB0aGlzLmlkO1xuICAgIGlmICh0aGlzLmlkID09PSB1bmRlZmluZWQgJiYgb3B0c1t0aGlzLnNjaGVtYS5pZEF0dHJpYnV0ZV0pIHtcbiAgICAgIHRoaXMuaWQgPSBvcHRzW3RoaXMuc2NoZW1hLmlkQXR0cmlidXRlXTtcbiAgICB9XG4gICAgdGhpcy5kaXJ0eSA9IG1lcmdlT3B0aW9ucyh0aGlzLmRpcnR5LCB7IGF0dHJpYnV0ZXM6IG9wdHMgfSk7XG4gIH1cblxuICAkJHJlc2V0RGlydHkoKTogdm9pZCB7XG4gICAgdGhpcy5kaXJ0eSA9IHtcbiAgICAgIGF0dHJpYnV0ZXM6IHt9LCAvLyBTaW1wbGUga2V5LXZhbHVlXG4gICAgICByZWxhdGlvbnNoaXBzOiB7fSwgLy8gcmVsTmFtZTogRGVsdGFbXVxuICAgIH07XG4gIH1cblxuICBnZXQ8VCBleHRlbmRzIE1vZGVsRGF0YT4ob3B0czogc3RyaW5nIHwgc3RyaW5nW10gPSAnYXR0cmlidXRlcycpOiBQcm9taXNlPFQ+IHtcbiAgICAvLyBJZiBvcHRzIGlzIGZhbHN5IChpLmUuLCB1bmRlZmluZWQpLCBnZXQgYXR0cmlidXRlc1xuICAgIC8vIE90aGVyd2lzZSwgZ2V0IHdoYXQgd2FzIHJlcXVlc3RlZCxcbiAgICAvLyB3cmFwcGluZyB0aGUgcmVxdWVzdCBpbiBhIEFycmF5IGlmIGl0IHdhc24ndCBhbHJlYWR5IG9uZVxuICAgIGNvbnN0IGtleXMgPSBvcHRzICYmICFBcnJheS5pc0FycmF5KG9wdHMpID8gW29wdHNdIDogb3B0cyBhcyBzdHJpbmdbXTtcbiAgICByZXR1cm4gdGhpcy5wbHVtcFxuICAgICAgLmdldCh0aGlzLCBrZXlzKVxuICAgICAgLmNhdGNoKChlOiBQbHVtcEVycm9yKSA9PiB7XG4gICAgICAgIHRoaXMuZXJyb3IgPSBlO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0pXG4gICAgICAudGhlbjxUPihzZWxmID0+IHtcbiAgICAgICAgaWYgKCFzZWxmICYmIHRoaXMuZGlydHlGaWVsZHMoKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmRpcnR5RmllbGRzKCkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIHNlbGY7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBNb2RlbC5yZXNvbHZlQW5kT3ZlcmxheShcbiAgICAgICAgICAgIHRoaXMuZGlydHksXG4gICAgICAgICAgICBzZWxmIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgICApO1xuICAgICAgICAgIHJldHVybiBtZXJnZU9wdGlvbnMoXG4gICAgICAgICAgICB7fSxcbiAgICAgICAgICAgIHNlbGYgfHwgeyBpZDogdGhpcy5pZCwgdHlwZTogdGhpcy50eXBlIH0sXG4gICAgICAgICAgICByZXNvbHZlZCxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIGJ1bGtHZXQ8VCBleHRlbmRzIE1vZGVsRGF0YT4oKTogUHJvbWlzZTxUPiB7XG4gICAgcmV0dXJuIHRoaXMucGx1bXAuYnVsa0dldCh0aGlzKSBhcyBQcm9taXNlPFQ+O1xuICB9XG5cbiAgLy8gVE9ETzogU2hvdWxkICRzYXZlIHVsdGltYXRlbHkgcmV0dXJuIHRoaXMuZ2V0KCk/XG4gIHNhdmU8VCBleHRlbmRzIE1vZGVsRGF0YT4oKTogUHJvbWlzZTxUPiB7XG4gICAgY29uc3QgdXBkYXRlOiBEaXJ0eU1vZGVsID0gbWVyZ2VPcHRpb25zKFxuICAgICAgeyBpZDogdGhpcy5pZCwgdHlwZTogdGhpcy50eXBlIH0sXG4gICAgICB0aGlzLmRpcnR5LFxuICAgICk7XG4gICAgcmV0dXJuIHRoaXMucGx1bXBcbiAgICAgIC5zYXZlKHVwZGF0ZSlcbiAgICAgIC50aGVuPFQ+KHVwZGF0ZWQgPT4ge1xuICAgICAgICB0aGlzLiQkcmVzZXREaXJ0eSgpO1xuICAgICAgICBpZiAodXBkYXRlZC5pZCkge1xuICAgICAgICAgIHRoaXMuaWQgPSB1cGRhdGVkLmlkO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmdldCgpO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChlcnIgPT4ge1xuICAgICAgICB0aHJvdyBlcnI7XG4gICAgICB9KTtcbiAgfVxuXG4gIHNldCh1cGRhdGUpOiB0aGlzIHtcbiAgICBjb25zdCBmbGF0ID0gdXBkYXRlLmF0dHJpYnV0ZXMgfHwgdXBkYXRlO1xuICAgIC8vIEZpbHRlciBvdXQgbm9uLWF0dHJpYnV0ZSBrZXlzXG4gICAgY29uc3Qgc2FuaXRpemVkID0gT2JqZWN0LmtleXMoZmxhdClcbiAgICAgIC5maWx0ZXIoayA9PiBrIGluIHRoaXMuc2NoZW1hLmF0dHJpYnV0ZXMpXG4gICAgICAubWFwKGsgPT4ge1xuICAgICAgICByZXR1cm4geyBba106IGZsYXRba10gfTtcbiAgICAgIH0pXG4gICAgICAucmVkdWNlKChhY2MsIGN1cnIpID0+IG1lcmdlT3B0aW9ucyhhY2MsIGN1cnIpLCB7fSk7XG5cbiAgICB0aGlzLiQkY29weVZhbHVlc0Zyb20oc2FuaXRpemVkKTtcbiAgICAvLyB0aGlzLiQkZmlyZVVwZGF0ZShzYW5pdGl6ZWQpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgYXNPYnNlcnZhYmxlKFxuICAgIG9wdHM6IHN0cmluZyB8IHN0cmluZ1tdID0gWydyZWxhdGlvbnNoaXBzJywgJ2F0dHJpYnV0ZXMnXSxcbiAgKTogUGx1bXBPYnNlcnZhYmxlPE1EPiB7XG4gICAgbGV0IGZpZWxkcyA9IEFycmF5LmlzQXJyYXkob3B0cykgPyBvcHRzLmNvbmNhdCgpIDogW29wdHNdO1xuICAgIGlmIChmaWVsZHMuaW5kZXhPZigncmVsYXRpb25zaGlwcycpID49IDApIHtcbiAgICAgIGZpZWxkcyA9IGZpZWxkcy5jb25jYXQoXG4gICAgICAgIE9iamVjdC5rZXlzKHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHMpLm1hcChrID0+IGByZWxhdGlvbnNoaXBzLiR7a31gKSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgY29uc3QgaG90cyA9IHRoaXMucGx1bXAuY2FjaGVzLmZpbHRlcihzID0+IHMuaG90KHRoaXMpKTtcbiAgICBjb25zdCBjb2xkcyA9IHRoaXMucGx1bXAuY2FjaGVzLmZpbHRlcihzID0+ICFzLmhvdCh0aGlzKSk7XG4gICAgY29uc3QgdGVybWluYWwgPSB0aGlzLnBsdW1wLnRlcm1pbmFsO1xuXG4gICAgY29uc3QgcHJlbG9hZCQgPSBPYnNlcnZhYmxlLmZyb20oaG90cylcbiAgICAgIC5mbGF0TWFwKChzOiBDYWNoZVN0b3JlKSA9PiBPYnNlcnZhYmxlLmZyb21Qcm9taXNlKHMucmVhZCh0aGlzLCBmaWVsZHMpKSlcbiAgICAgIC5kZWZhdWx0SWZFbXB0eShudWxsKVxuICAgICAgLmZsYXRNYXAodiA9PiB7XG4gICAgICAgIGlmICh2ICE9PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2Yodik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgdGVybWluYWwkID0gT2JzZXJ2YWJsZS5mcm9tUHJvbWlzZSh0ZXJtaW5hbC5yZWFkKHRoaXMsIGZpZWxkcykpO1xuICAgICAgICAgIGNvbnN0IGNvbGQkID0gT2JzZXJ2YWJsZS5mcm9tKGNvbGRzKS5mbGF0TWFwKChzOiBDYWNoZVN0b3JlKSA9PlxuICAgICAgICAgICAgT2JzZXJ2YWJsZS5mcm9tUHJvbWlzZShzLnJlYWQodGhpcywgZmllbGRzKSksXG4gICAgICAgICAgKTtcbiAgICAgICAgICAvLyAuc3RhcnRXaXRoKHVuZGVmaW5lZCk7XG4gICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUubWVyZ2UodGVybWluYWwkLCBjb2xkJC50YWtlVW50aWwodGVybWluYWwkKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIC8vIFRPRE86IGNhY2hlYWJsZSByZWFkc1xuICAgIC8vIGNvbnN0IHdhdGNoUmVhZCQgPSBPYnNlcnZhYmxlLmZyb20odGVybWluYWwpXG4gICAgLy8gLmZsYXRNYXAocyA9PiBzLnJlYWQkLmZpbHRlcih2ID0+IHYudHlwZSA9PT0gdGhpcy50eXBlICYmIHYuaWQgPT09IHRoaXMuaWQpKTtcbiAgICBjb25zdCB3YXRjaFdyaXRlJDogT2JzZXJ2YWJsZTxNb2RlbERhdGE+ID0gdGVybWluYWwud3JpdGUkXG4gICAgICAuZmlsdGVyKCh2OiBNb2RlbERlbHRhKSA9PiB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgdi50eXBlID09PSB0aGlzLnR5cGUgJiZcbiAgICAgICAgICB2LmlkID09PSB0aGlzLmlkICYmXG4gICAgICAgICAgdi5pbnZhbGlkYXRlLnNvbWUoaSA9PiBmaWVsZHMuaW5kZXhPZihpKSA+PSAwKVxuICAgICAgICApO1xuICAgICAgfSlcbiAgICAgIC5mbGF0TWFwVG8oXG4gICAgICAgIE9ic2VydmFibGUub2YodGVybWluYWwpLmZsYXRNYXAoKHM6IFRlcm1pbmFsU3RvcmUpID0+XG4gICAgICAgICAgT2JzZXJ2YWJsZS5mcm9tUHJvbWlzZShzLnJlYWQodGhpcywgZmllbGRzKSksXG4gICAgICAgICksXG4gICAgICApO1xuICAgIC8vICk7XG4gICAgcmV0dXJuIE9ic2VydmFibGUubWVyZ2UocHJlbG9hZCQsIHdhdGNoV3JpdGUkKS5sZXQob2JzID0+IHtcbiAgICAgIHJldHVybiBuZXcgUGx1bXBPYnNlcnZhYmxlKHRoaXMucGx1bXAsIG9icyk7XG4gICAgfSkgYXMgUGx1bXBPYnNlcnZhYmxlPE1EPjtcbiAgfVxuXG4gIHN1YnNjcmliZShjYjogT2JzZXJ2ZXI8TUQ+KTogU3Vic2NyaXB0aW9uO1xuICBzdWJzY3JpYmUoZmllbGRzOiBzdHJpbmcgfCBzdHJpbmdbXSwgY2I6IE9ic2VydmVyPE1EPik6IFN1YnNjcmlwdGlvbjtcbiAgc3Vic2NyaWJlKFxuICAgIGFyZzE6IE9ic2VydmVyPE1EPiB8IHN0cmluZyB8IHN0cmluZ1tdLFxuICAgIGFyZzI/OiBPYnNlcnZlcjxNRD4sXG4gICk6IFN1YnNjcmlwdGlvbiB7XG4gICAgbGV0IGZpZWxkczogc3RyaW5nW10gPSBbXTtcbiAgICBsZXQgY2I6IE9ic2VydmVyPE1EPiA9IG51bGw7XG5cbiAgICBpZiAoYXJnMikge1xuICAgICAgY2IgPSBhcmcyO1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoYXJnMSkpIHtcbiAgICAgICAgZmllbGRzID0gYXJnMSBhcyBzdHJpbmdbXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZpZWxkcyA9IFthcmcxIGFzIHN0cmluZ107XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNiID0gYXJnMSBhcyBPYnNlcnZlcjxNRD47XG4gICAgICBmaWVsZHMgPSBbJ2F0dHJpYnV0ZXMnXTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuYXNPYnNlcnZhYmxlKGZpZWxkcykuc3Vic2NyaWJlKGNiKTtcbiAgfVxuXG4gIGRlbGV0ZSgpIHtcbiAgICByZXR1cm4gdGhpcy5wbHVtcC5kZWxldGUodGhpcyk7XG4gIH1cblxuICAvLyAkcmVzdChvcHRzKSB7XG4gIC8vICAgY29uc3QgcmVzdE9wdHMgPSBPYmplY3QuYXNzaWduKFxuICAvLyAgICAge30sXG4gIC8vICAgICBvcHRzLFxuICAvLyAgICAge1xuICAvLyAgICAgICB1cmw6IGAvJHt0aGlzLmNvbnN0cnVjdG9yWyd0eXBlJ119LyR7dGhpcy5pZH0vJHtvcHRzLnVybH1gLFxuICAvLyAgICAgfVxuICAvLyAgICk7XG4gIC8vICAgcmV0dXJuIHRoaXMucGx1bXAucmVzdFJlcXVlc3QocmVzdE9wdHMpLnRoZW4ocmVzID0+IHJlcy5kYXRhKTtcbiAgLy8gfVxuXG4gIGFkZChrZXk6IHN0cmluZywgaXRlbTogUmVsYXRpb25zaGlwSXRlbSk6IHRoaXMge1xuICAgIGlmIChrZXkgaW4gdGhpcy5zY2hlbWEucmVsYXRpb25zaGlwcykge1xuICAgICAgaWYgKGl0ZW0uaWQgPj0gMSkge1xuICAgICAgICBpZiAodGhpcy5kaXJ0eS5yZWxhdGlvbnNoaXBzW2tleV0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgIHRoaXMuZGlydHkucmVsYXRpb25zaGlwc1trZXldID0gW107XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLmRpcnR5LnJlbGF0aW9uc2hpcHNba2V5XS5wdXNoKHtcbiAgICAgICAgICBvcDogJ2FkZCcsXG4gICAgICAgICAgZGF0YTogaXRlbSxcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIHRoaXMuJCRmaXJlVXBkYXRlKCk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGl0ZW0gYWRkZWQgdG8gaGFzTWFueScpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCAkYWRkIGV4Y2VwdCB0byBoYXNNYW55IGZpZWxkJyk7XG4gICAgfVxuICB9XG5cbiAgbW9kaWZ5UmVsYXRpb25zaGlwKGtleTogc3RyaW5nLCBpdGVtOiBSZWxhdGlvbnNoaXBJdGVtKTogdGhpcyB7XG4gICAgaWYgKGtleSBpbiB0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICBpZiAoaXRlbS5pZCA+PSAxKSB7XG4gICAgICAgIHRoaXMuZGlydHkucmVsYXRpb25zaGlwc1trZXldID0gdGhpcy5kaXJ0eS5yZWxhdGlvbnNoaXBzW2tleV0gfHwgW107XG4gICAgICAgIHRoaXMuZGlydHkucmVsYXRpb25zaGlwc1trZXldLnB1c2goe1xuICAgICAgICAgIG9wOiAnbW9kaWZ5JyxcbiAgICAgICAgICBkYXRhOiBpdGVtLFxuICAgICAgICB9KTtcbiAgICAgICAgLy8gdGhpcy4kJGZpcmVVcGRhdGUoKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaXRlbSBhZGRlZCB0byBoYXNNYW55Jyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90ICRhZGQgZXhjZXB0IHRvIGhhc01hbnkgZmllbGQnKTtcbiAgICB9XG4gIH1cblxuICByZW1vdmUoa2V5OiBzdHJpbmcsIGl0ZW06IFJlbGF0aW9uc2hpcEl0ZW0pOiB0aGlzIHtcbiAgICBpZiAoa2V5IGluIHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgIGlmIChpdGVtLmlkID49IDEpIHtcbiAgICAgICAgaWYgKCEoa2V5IGluIHRoaXMuZGlydHkucmVsYXRpb25zaGlwcykpIHtcbiAgICAgICAgICB0aGlzLmRpcnR5LnJlbGF0aW9uc2hpcHNba2V5XSA9IFtdO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZGlydHkucmVsYXRpb25zaGlwc1trZXldLnB1c2goe1xuICAgICAgICAgIG9wOiAncmVtb3ZlJyxcbiAgICAgICAgICBkYXRhOiBpdGVtLFxuICAgICAgICB9KTtcbiAgICAgICAgLy8gdGhpcy4kJGZpcmVVcGRhdGUoKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaXRlbSAkcmVtb3ZlZCBmcm9tIGhhc01hbnknKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgJHJlbW92ZSBleGNlcHQgZnJvbSBoYXNNYW55IGZpZWxkJyk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIGFwcGx5RGVsdGEoY3VycmVudCwgZGVsdGEpIHtcbiAgICBpZiAoZGVsdGEub3AgPT09ICdhZGQnIHx8IGRlbHRhLm9wID09PSAnbW9kaWZ5Jykge1xuICAgICAgY29uc3QgcmV0VmFsID0gbWVyZ2VPcHRpb25zKHt9LCBjdXJyZW50LCBkZWx0YS5kYXRhKTtcbiAgICAgIHJldHVybiByZXRWYWw7XG4gICAgfSBlbHNlIGlmIChkZWx0YS5vcCA9PT0gJ3JlbW92ZScpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjdXJyZW50O1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyByZXNvbHZlQW5kT3ZlcmxheShcbiAgICB1cGRhdGUsXG4gICAgYmFzZTogeyBhdHRyaWJ1dGVzPzogYW55OyByZWxhdGlvbnNoaXBzPzogYW55IH0gPSB7XG4gICAgICBhdHRyaWJ1dGVzOiB7fSxcbiAgICAgIHJlbGF0aW9uc2hpcHM6IHt9LFxuICAgIH0sXG4gICkge1xuICAgIGNvbnN0IGF0dHJpYnV0ZXMgPSBtZXJnZU9wdGlvbnMoe30sIGJhc2UuYXR0cmlidXRlcywgdXBkYXRlLmF0dHJpYnV0ZXMpO1xuICAgIGNvbnN0IHJlc29sdmVkUmVsYXRpb25zaGlwcyA9IHRoaXMucmVzb2x2ZVJlbGF0aW9uc2hpcHMoXG4gICAgICB1cGRhdGUucmVsYXRpb25zaGlwcyxcbiAgICAgIGJhc2UucmVsYXRpb25zaGlwcyxcbiAgICApO1xuICAgIHJldHVybiB7IGF0dHJpYnV0ZXMsIHJlbGF0aW9uc2hpcHM6IHJlc29sdmVkUmVsYXRpb25zaGlwcyB9O1xuICB9XG5cbiAgc3RhdGljIHJlc29sdmVSZWxhdGlvbnNoaXBzKGRlbHRhcywgYmFzZSA9IHt9KSB7XG4gICAgY29uc3QgdXBkYXRlcyA9IE9iamVjdC5rZXlzKGRlbHRhcylcbiAgICAgIC5tYXAocmVsTmFtZSA9PiB7XG4gICAgICAgIGNvbnN0IHJlc29sdmVkID0gdGhpcy5yZXNvbHZlUmVsYXRpb25zaGlwKFxuICAgICAgICAgIGRlbHRhc1tyZWxOYW1lXSxcbiAgICAgICAgICBiYXNlW3JlbE5hbWVdLFxuICAgICAgICApO1xuICAgICAgICByZXR1cm4geyBbcmVsTmFtZV06IHJlc29sdmVkIH07XG4gICAgICB9KVxuICAgICAgLnJlZHVjZSgoYWNjLCBjdXJyKSA9PiBtZXJnZU9wdGlvbnMoYWNjLCBjdXJyKSwge30pO1xuICAgIHJldHVybiBtZXJnZU9wdGlvbnMoe30sIGJhc2UsIHVwZGF0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHJlc29sdmVSZWxhdGlvbnNoaXAoXG4gICAgZGVsdGFzOiBSZWxhdGlvbnNoaXBEZWx0YVtdLFxuICAgIGJhc2U6IFJlbGF0aW9uc2hpcEl0ZW1bXSA9IFtdLFxuICApIHtcbiAgICBjb25zdCByZXRWYWwgPSBiYXNlLmNvbmNhdCgpO1xuICAgIGRlbHRhcy5mb3JFYWNoKGRlbHRhID0+IHtcbiAgICAgIGlmIChkZWx0YS5vcCA9PT0gJ2FkZCcgfHwgZGVsdGEub3AgPT09ICdtb2RpZnknKSB7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRJbmRleCA9IHJldFZhbC5maW5kSW5kZXgodiA9PiB2LmlkID09PSBkZWx0YS5kYXRhLmlkKTtcbiAgICAgICAgaWYgKGN1cnJlbnRJbmRleCA+PSAwKSB7XG4gICAgICAgICAgcmV0VmFsW2N1cnJlbnRJbmRleF0gPSBkZWx0YS5kYXRhO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldFZhbC5wdXNoKGRlbHRhLmRhdGEpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGRlbHRhLm9wID09PSAncmVtb3ZlJykge1xuICAgICAgICBjb25zdCBjdXJyZW50SW5kZXggPSByZXRWYWwuZmluZEluZGV4KHYgPT4gdi5pZCA9PT0gZGVsdGEuZGF0YS5pZCk7XG4gICAgICAgIGlmIChjdXJyZW50SW5kZXggPj0gMCkge1xuICAgICAgICAgIHJldFZhbC5zcGxpY2UoY3VycmVudEluZGV4LCAxKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiByZXRWYWw7XG4gIH1cbn1cbiJdfQ==
