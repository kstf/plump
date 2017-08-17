"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mergeOptions = require("merge-options");
var rxjs_1 = require("rxjs");
var plumpObservable_1 = require("./plumpObservable");
var errors_1 = require("./errors");
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
                if (_this.id) {
                    _this.error = new errors_1.NotFoundError();
                }
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
                var terminal$ = rxjs_1.Observable.fromPromise(terminal.read(_this, fields).then(function (terminalValue) {
                    if (terminalValue === null) {
                        throw new errors_1.NotFoundError();
                    }
                    else {
                        return terminalValue;
                    }
                }));
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
            return rxjs_1.Observable.fromPromise(s.read(_this, fields, true));
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFLLEtBQUssQ0FBQyxJQUFJLENBQUMsRUFBRSxFQUF0QixDQUFzQixDQUFDLENBQUM7Z0JBQ25FLEVBQUUsQ0FBQyxDQUFDLFlBQVksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN0QixNQUFNLENBQUMsWUFBWSxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztnQkFDcEMsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDMUIsQ0FBQztZQUNILENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDO2dCQUNqQyxJQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxDQUFDLEVBQUUsS0FBSyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBdEIsQ0FBc0IsQ0FBQyxDQUFDO2dCQUNuRSxFQUFFLENBQUMsQ0FBQyxZQUFZLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDdEIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pDLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDSCxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUEzVk0sVUFBSSxHQUFHLE1BQU0sQ0FBQztJQUNkLFlBQU0sR0FBZ0I7UUFDM0IsV0FBVyxFQUFFLElBQUk7UUFDakIsSUFBSSxFQUFFLE1BQU07UUFDWixVQUFVLEVBQUUsRUFBRTtRQUNkLGFBQWEsRUFBRSxFQUFFO0tBQ2xCLENBQUM7SUFzVkosWUFBQztDQTlWRCxBQThWQyxJQUFBO0FBOVZZLHNCQUFLIiwiZmlsZSI6Im1vZGVsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgbWVyZ2VPcHRpb25zIGZyb20gJ21lcmdlLW9wdGlvbnMnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgU3Vic2NyaXB0aW9uLCBPYnNlcnZlciB9IGZyb20gJ3J4anMnO1xuXG5pbXBvcnQge1xuICBNb2RlbERhdGEsXG4gIE1vZGVsRGVsdGEsXG4gIE1vZGVsU2NoZW1hLFxuICBEaXJ0eVZhbHVlcyxcbiAgRGlydHlNb2RlbCxcbiAgUmVsYXRpb25zaGlwRGVsdGEsXG4gIFJlbGF0aW9uc2hpcEl0ZW0sXG4gIENhY2hlU3RvcmUsXG4gIFRlcm1pbmFsU3RvcmUsXG59IGZyb20gJy4vZGF0YVR5cGVzJztcblxuaW1wb3J0IHsgUGx1bXAgfSBmcm9tICcuL3BsdW1wJztcbmltcG9ydCB7IFBsdW1wT2JzZXJ2YWJsZSB9IGZyb20gJy4vcGx1bXBPYnNlcnZhYmxlJztcbmltcG9ydCB7IFBsdW1wRXJyb3IsIE5vdEZvdW5kRXJyb3IgfSBmcm9tICcuL2Vycm9ycyc7XG5cbi8vIFRPRE86IGZpZ3VyZSBvdXQgd2hlcmUgZXJyb3IgZXZlbnRzIG9yaWdpbmF0ZSAoc3RvcmFnZSBvciBtb2RlbClcbi8vIGFuZCB3aG8ga2VlcHMgYSByb2xsLWJhY2thYmxlIGRlbHRhXG5cbmV4cG9ydCBjbGFzcyBNb2RlbDxNRCBleHRlbmRzIE1vZGVsRGF0YT4ge1xuICBpZDogc3RyaW5nIHwgbnVtYmVyO1xuICBzdGF0aWMgdHlwZSA9ICdCQVNFJztcbiAgc3RhdGljIHNjaGVtYTogTW9kZWxTY2hlbWEgPSB7XG4gICAgaWRBdHRyaWJ1dGU6ICdpZCcsXG4gICAgbmFtZTogJ0JBU0UnLFxuICAgIGF0dHJpYnV0ZXM6IHt9LFxuICAgIHJlbGF0aW9uc2hpcHM6IHt9LFxuICB9O1xuXG4gIHB1YmxpYyBlcnJvcjogUGx1bXBFcnJvcjtcblxuICBwcml2YXRlIGRpcnR5OiBEaXJ0eVZhbHVlcztcblxuICBnZXQgdHlwZSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3RvclsndHlwZSddO1xuICB9XG5cbiAgZ2V0IHNjaGVtYSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb25zdHJ1Y3Rvclsnc2NoZW1hJ107XG4gIH1cblxuICBkaXJ0eUZpZWxkcygpIHtcbiAgICByZXR1cm4gT2JqZWN0LmtleXModGhpcy5kaXJ0eS5hdHRyaWJ1dGVzKVxuICAgICAgLmZpbHRlcihrID0+IGsgIT09IHRoaXMuc2NoZW1hLmlkQXR0cmlidXRlKVxuICAgICAgLmNvbmNhdChPYmplY3Qua2V5cyh0aGlzLmRpcnR5LnJlbGF0aW9uc2hpcHMpKTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKG9wdHMsIHByaXZhdGUgcGx1bXA6IFBsdW1wKSB7XG4gICAgLy8gVE9ETzogRGVmaW5lIERlbHRhIGludGVyZmFjZVxuICAgIHRoaXMuZXJyb3IgPSBudWxsO1xuICAgIGlmICh0aGlzLnR5cGUgPT09ICdCQVNFJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcbiAgICAgICAgJ0Nhbm5vdCBpbnN0YW50aWF0ZSBiYXNlIHBsdW1wIE1vZGVscywgcGxlYXNlIHN1YmNsYXNzIHdpdGggYSBzY2hlbWEgYW5kIHZhbGlkIHR5cGUnLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICB0aGlzLmRpcnR5ID0ge1xuICAgICAgYXR0cmlidXRlczoge30sIC8vIFNpbXBsZSBrZXktdmFsdWVcbiAgICAgIHJlbGF0aW9uc2hpcHM6IHt9LCAvLyByZWxOYW1lOiBEZWx0YVtdXG4gICAgfTtcbiAgICB0aGlzLiQkY29weVZhbHVlc0Zyb20ob3B0cyk7XG4gICAgLy8gdGhpcy4kJGZpcmVVcGRhdGUob3B0cyk7XG4gIH1cblxuICAkJGNvcHlWYWx1ZXNGcm9tKG9wdHMgPSB7fSk6IHZvaWQge1xuICAgIC8vIGNvbnN0IGlkRmllbGQgPSB0aGlzLmNvbnN0cnVjdG9yLiRpZCBpbiBvcHRzID8gdGhpcy5jb25zdHJ1Y3Rvci4kaWQgOiAnaWQnO1xuICAgIC8vIHRoaXNbdGhpcy5jb25zdHJ1Y3Rvci4kaWRdID0gb3B0c1tpZEZpZWxkXSB8fCB0aGlzLmlkO1xuICAgIGlmICh0aGlzLmlkID09PSB1bmRlZmluZWQgJiYgb3B0c1t0aGlzLnNjaGVtYS5pZEF0dHJpYnV0ZV0pIHtcbiAgICAgIHRoaXMuaWQgPSBvcHRzW3RoaXMuc2NoZW1hLmlkQXR0cmlidXRlXTtcbiAgICB9XG4gICAgdGhpcy5kaXJ0eSA9IG1lcmdlT3B0aW9ucyh0aGlzLmRpcnR5LCB7IGF0dHJpYnV0ZXM6IG9wdHMgfSk7XG4gIH1cblxuICAkJHJlc2V0RGlydHkoKTogdm9pZCB7XG4gICAgdGhpcy5kaXJ0eSA9IHtcbiAgICAgIGF0dHJpYnV0ZXM6IHt9LCAvLyBTaW1wbGUga2V5LXZhbHVlXG4gICAgICByZWxhdGlvbnNoaXBzOiB7fSwgLy8gcmVsTmFtZTogRGVsdGFbXVxuICAgIH07XG4gIH1cblxuICBnZXQ8VCBleHRlbmRzIE1vZGVsRGF0YT4ob3B0czogc3RyaW5nIHwgc3RyaW5nW10gPSAnYXR0cmlidXRlcycpOiBQcm9taXNlPFQ+IHtcbiAgICAvLyBJZiBvcHRzIGlzIGZhbHN5IChpLmUuLCB1bmRlZmluZWQpLCBnZXQgYXR0cmlidXRlc1xuICAgIC8vIE90aGVyd2lzZSwgZ2V0IHdoYXQgd2FzIHJlcXVlc3RlZCxcbiAgICAvLyB3cmFwcGluZyB0aGUgcmVxdWVzdCBpbiBhIEFycmF5IGlmIGl0IHdhc24ndCBhbHJlYWR5IG9uZVxuICAgIGNvbnN0IGtleXMgPSBvcHRzICYmICFBcnJheS5pc0FycmF5KG9wdHMpID8gW29wdHNdIDogb3B0cyBhcyBzdHJpbmdbXTtcbiAgICByZXR1cm4gdGhpcy5wbHVtcFxuICAgICAgLmdldCh0aGlzLCBrZXlzKVxuICAgICAgLmNhdGNoKChlOiBQbHVtcEVycm9yKSA9PiB7XG4gICAgICAgIHRoaXMuZXJyb3IgPSBlO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0pXG4gICAgICAudGhlbjxUPihzZWxmID0+IHtcbiAgICAgICAgaWYgKCFzZWxmICYmIHRoaXMuZGlydHlGaWVsZHMoKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBpZiAodGhpcy5pZCkge1xuICAgICAgICAgICAgdGhpcy5lcnJvciA9IG5ldyBOb3RGb3VuZEVycm9yKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMuZGlydHlGaWVsZHMoKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gc2VsZjtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IE1vZGVsLnJlc29sdmVBbmRPdmVybGF5KFxuICAgICAgICAgICAgdGhpcy5kaXJ0eSxcbiAgICAgICAgICAgIHNlbGYgfHwgdW5kZWZpbmVkLFxuICAgICAgICAgICk7XG4gICAgICAgICAgcmV0dXJuIG1lcmdlT3B0aW9ucyhcbiAgICAgICAgICAgIHt9LFxuICAgICAgICAgICAgc2VsZiB8fCB7IGlkOiB0aGlzLmlkLCB0eXBlOiB0aGlzLnR5cGUgfSxcbiAgICAgICAgICAgIHJlc29sdmVkLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgYnVsa0dldDxUIGV4dGVuZHMgTW9kZWxEYXRhPigpOiBQcm9taXNlPFQ+IHtcbiAgICByZXR1cm4gdGhpcy5wbHVtcC5idWxrR2V0KHRoaXMpIGFzIFByb21pc2U8VD47XG4gIH1cblxuICAvLyBUT0RPOiBTaG91bGQgJHNhdmUgdWx0aW1hdGVseSByZXR1cm4gdGhpcy5nZXQoKT9cbiAgc2F2ZTxUIGV4dGVuZHMgTW9kZWxEYXRhPigpOiBQcm9taXNlPFQ+IHtcbiAgICBjb25zdCB1cGRhdGU6IERpcnR5TW9kZWwgPSBtZXJnZU9wdGlvbnMoXG4gICAgICB7IGlkOiB0aGlzLmlkLCB0eXBlOiB0aGlzLnR5cGUgfSxcbiAgICAgIHRoaXMuZGlydHksXG4gICAgKTtcbiAgICByZXR1cm4gdGhpcy5wbHVtcFxuICAgICAgLnNhdmUodXBkYXRlKVxuICAgICAgLnRoZW48VD4odXBkYXRlZCA9PiB7XG4gICAgICAgIHRoaXMuJCRyZXNldERpcnR5KCk7XG4gICAgICAgIGlmICh1cGRhdGVkLmlkKSB7XG4gICAgICAgICAgdGhpcy5pZCA9IHVwZGF0ZWQuaWQ7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KCk7XG4gICAgICB9KVxuICAgICAgLmNhdGNoKGVyciA9PiB7XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH0pO1xuICB9XG5cbiAgc2V0KHVwZGF0ZSk6IHRoaXMge1xuICAgIGNvbnN0IGZsYXQgPSB1cGRhdGUuYXR0cmlidXRlcyB8fCB1cGRhdGU7XG4gICAgLy8gRmlsdGVyIG91dCBub24tYXR0cmlidXRlIGtleXNcbiAgICBjb25zdCBzYW5pdGl6ZWQgPSBPYmplY3Qua2V5cyhmbGF0KVxuICAgICAgLmZpbHRlcihrID0+IGsgaW4gdGhpcy5zY2hlbWEuYXR0cmlidXRlcylcbiAgICAgIC5tYXAoayA9PiB7XG4gICAgICAgIHJldHVybiB7IFtrXTogZmxhdFtrXSB9O1xuICAgICAgfSlcbiAgICAgIC5yZWR1Y2UoKGFjYywgY3VycikgPT4gbWVyZ2VPcHRpb25zKGFjYywgY3VyciksIHt9KTtcblxuICAgIHRoaXMuJCRjb3B5VmFsdWVzRnJvbShzYW5pdGl6ZWQpO1xuICAgIC8vIHRoaXMuJCRmaXJlVXBkYXRlKHNhbml0aXplZCk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBhc09ic2VydmFibGUoXG4gICAgb3B0czogc3RyaW5nIHwgc3RyaW5nW10gPSBbJ3JlbGF0aW9uc2hpcHMnLCAnYXR0cmlidXRlcyddLFxuICApOiBQbHVtcE9ic2VydmFibGU8TUQ+IHtcbiAgICBsZXQgZmllbGRzID0gQXJyYXkuaXNBcnJheShvcHRzKSA/IG9wdHMuY29uY2F0KCkgOiBbb3B0c107XG4gICAgaWYgKGZpZWxkcy5pbmRleE9mKCdyZWxhdGlvbnNoaXBzJykgPj0gMCkge1xuICAgICAgZmllbGRzID0gZmllbGRzLmNvbmNhdChcbiAgICAgICAgT2JqZWN0LmtleXModGhpcy5zY2hlbWEucmVsYXRpb25zaGlwcykubWFwKGsgPT4gYHJlbGF0aW9uc2hpcHMuJHtrfWApLFxuICAgICAgKTtcbiAgICB9XG5cbiAgICBjb25zdCBob3RzID0gdGhpcy5wbHVtcC5jYWNoZXMuZmlsdGVyKHMgPT4gcy5ob3QodGhpcykpO1xuICAgIGNvbnN0IGNvbGRzID0gdGhpcy5wbHVtcC5jYWNoZXMuZmlsdGVyKHMgPT4gIXMuaG90KHRoaXMpKTtcbiAgICBjb25zdCB0ZXJtaW5hbCA9IHRoaXMucGx1bXAudGVybWluYWw7XG5cbiAgICBjb25zdCBwcmVsb2FkJCA9IE9ic2VydmFibGUuZnJvbShob3RzKVxuICAgICAgLmZsYXRNYXAoKHM6IENhY2hlU3RvcmUpID0+IE9ic2VydmFibGUuZnJvbVByb21pc2Uocy5yZWFkKHRoaXMsIGZpZWxkcykpKVxuICAgICAgLmRlZmF1bHRJZkVtcHR5KG51bGwpXG4gICAgICAuZmxhdE1hcCh2ID0+IHtcbiAgICAgICAgaWYgKHYgIT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZih2KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCB0ZXJtaW5hbCQgPSBPYnNlcnZhYmxlLmZyb21Qcm9taXNlKFxuICAgICAgICAgICAgdGVybWluYWwucmVhZCh0aGlzLCBmaWVsZHMpLnRoZW4odGVybWluYWxWYWx1ZSA9PiB7XG4gICAgICAgICAgICAgIGlmICh0ZXJtaW5hbFZhbHVlID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IE5vdEZvdW5kRXJyb3IoKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGVybWluYWxWYWx1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgKTtcbiAgICAgICAgICBjb25zdCBjb2xkJCA9IE9ic2VydmFibGUuZnJvbShjb2xkcykuZmxhdE1hcCgoczogQ2FjaGVTdG9yZSkgPT5cbiAgICAgICAgICAgIE9ic2VydmFibGUuZnJvbVByb21pc2Uocy5yZWFkKHRoaXMsIGZpZWxkcykpLFxuICAgICAgICAgICk7XG4gICAgICAgICAgLy8gLnN0YXJ0V2l0aCh1bmRlZmluZWQpO1xuICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLm1lcmdlKHRlcm1pbmFsJCwgY29sZCQudGFrZVVudGlsKHRlcm1pbmFsJCkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAvLyBUT0RPOiBjYWNoZWFibGUgcmVhZHNcbiAgICAvLyBjb25zdCB3YXRjaFJlYWQkID0gT2JzZXJ2YWJsZS5mcm9tKHRlcm1pbmFsKVxuICAgIC8vIC5mbGF0TWFwKHMgPT4gcy5yZWFkJC5maWx0ZXIodiA9PiB2LnR5cGUgPT09IHRoaXMudHlwZSAmJiB2LmlkID09PSB0aGlzLmlkKSk7XG4gICAgY29uc3Qgd2F0Y2hXcml0ZSQ6IE9ic2VydmFibGU8TW9kZWxEYXRhPiA9IHRlcm1pbmFsLndyaXRlJFxuICAgICAgLmZpbHRlcigodjogTW9kZWxEZWx0YSkgPT4ge1xuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIHYudHlwZSA9PT0gdGhpcy50eXBlICYmXG4gICAgICAgICAgdi5pZCA9PT0gdGhpcy5pZCAmJlxuICAgICAgICAgIHYuaW52YWxpZGF0ZS5zb21lKGkgPT4gZmllbGRzLmluZGV4T2YoaSkgPj0gMClcbiAgICAgICAgKTtcbiAgICAgIH0pXG4gICAgICAuZmxhdE1hcFRvKFxuICAgICAgICBPYnNlcnZhYmxlLm9mKHRlcm1pbmFsKS5mbGF0TWFwKChzOiBUZXJtaW5hbFN0b3JlKSA9PlxuICAgICAgICAgIE9ic2VydmFibGUuZnJvbVByb21pc2Uocy5yZWFkKHRoaXMsIGZpZWxkcywgdHJ1ZSkpLFxuICAgICAgICApLFxuICAgICAgKTtcbiAgICAvLyApO1xuICAgIHJldHVybiBPYnNlcnZhYmxlLm1lcmdlKHByZWxvYWQkLCB3YXRjaFdyaXRlJCkubGV0KG9icyA9PiB7XG4gICAgICByZXR1cm4gbmV3IFBsdW1wT2JzZXJ2YWJsZSh0aGlzLnBsdW1wLCBvYnMpO1xuICAgIH0pIGFzIFBsdW1wT2JzZXJ2YWJsZTxNRD47XG4gIH1cblxuICBzdWJzY3JpYmUoY2I6IE9ic2VydmVyPE1EPik6IFN1YnNjcmlwdGlvbjtcbiAgc3Vic2NyaWJlKGZpZWxkczogc3RyaW5nIHwgc3RyaW5nW10sIGNiOiBPYnNlcnZlcjxNRD4pOiBTdWJzY3JpcHRpb247XG4gIHN1YnNjcmliZShcbiAgICBhcmcxOiBPYnNlcnZlcjxNRD4gfCBzdHJpbmcgfCBzdHJpbmdbXSxcbiAgICBhcmcyPzogT2JzZXJ2ZXI8TUQ+LFxuICApOiBTdWJzY3JpcHRpb24ge1xuICAgIGxldCBmaWVsZHM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGNiOiBPYnNlcnZlcjxNRD4gPSBudWxsO1xuXG4gICAgaWYgKGFyZzIpIHtcbiAgICAgIGNiID0gYXJnMjtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGFyZzEpKSB7XG4gICAgICAgIGZpZWxkcyA9IGFyZzEgYXMgc3RyaW5nW107XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmaWVsZHMgPSBbYXJnMSBhcyBzdHJpbmddO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjYiA9IGFyZzEgYXMgT2JzZXJ2ZXI8TUQ+O1xuICAgICAgZmllbGRzID0gWydhdHRyaWJ1dGVzJ107XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmFzT2JzZXJ2YWJsZShmaWVsZHMpLnN1YnNjcmliZShjYik7XG4gIH1cblxuICBkZWxldGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucGx1bXAuZGVsZXRlKHRoaXMpO1xuICB9XG5cbiAgLy8gJHJlc3Qob3B0cykge1xuICAvLyAgIGNvbnN0IHJlc3RPcHRzID0gT2JqZWN0LmFzc2lnbihcbiAgLy8gICAgIHt9LFxuICAvLyAgICAgb3B0cyxcbiAgLy8gICAgIHtcbiAgLy8gICAgICAgdXJsOiBgLyR7dGhpcy5jb25zdHJ1Y3RvclsndHlwZSddfS8ke3RoaXMuaWR9LyR7b3B0cy51cmx9YCxcbiAgLy8gICAgIH1cbiAgLy8gICApO1xuICAvLyAgIHJldHVybiB0aGlzLnBsdW1wLnJlc3RSZXF1ZXN0KHJlc3RPcHRzKS50aGVuKHJlcyA9PiByZXMuZGF0YSk7XG4gIC8vIH1cblxuICBhZGQoa2V5OiBzdHJpbmcsIGl0ZW06IFJlbGF0aW9uc2hpcEl0ZW0pOiB0aGlzIHtcbiAgICBpZiAoa2V5IGluIHRoaXMuc2NoZW1hLnJlbGF0aW9uc2hpcHMpIHtcbiAgICAgIGlmIChpdGVtLmlkID49IDEpIHtcbiAgICAgICAgaWYgKHRoaXMuZGlydHkucmVsYXRpb25zaGlwc1trZXldID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICB0aGlzLmRpcnR5LnJlbGF0aW9uc2hpcHNba2V5XSA9IFtdO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5kaXJ0eS5yZWxhdGlvbnNoaXBzW2tleV0ucHVzaCh7XG4gICAgICAgICAgb3A6ICdhZGQnLFxuICAgICAgICAgIGRhdGE6IGl0ZW0sXG4gICAgICAgIH0pO1xuICAgICAgICAvLyB0aGlzLiQkZmlyZVVwZGF0ZSgpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBpdGVtIGFkZGVkIHRvIGhhc01hbnknKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgJGFkZCBleGNlcHQgdG8gaGFzTWFueSBmaWVsZCcpO1xuICAgIH1cbiAgfVxuXG4gIG1vZGlmeVJlbGF0aW9uc2hpcChrZXk6IHN0cmluZywgaXRlbTogUmVsYXRpb25zaGlwSXRlbSk6IHRoaXMge1xuICAgIGlmIChrZXkgaW4gdGhpcy5zY2hlbWEucmVsYXRpb25zaGlwcykge1xuICAgICAgaWYgKGl0ZW0uaWQgPj0gMSkge1xuICAgICAgICB0aGlzLmRpcnR5LnJlbGF0aW9uc2hpcHNba2V5XSA9IHRoaXMuZGlydHkucmVsYXRpb25zaGlwc1trZXldIHx8IFtdO1xuICAgICAgICB0aGlzLmRpcnR5LnJlbGF0aW9uc2hpcHNba2V5XS5wdXNoKHtcbiAgICAgICAgICBvcDogJ21vZGlmeScsXG4gICAgICAgICAgZGF0YTogaXRlbSxcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIHRoaXMuJCRmaXJlVXBkYXRlKCk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGl0ZW0gYWRkZWQgdG8gaGFzTWFueScpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCAkYWRkIGV4Y2VwdCB0byBoYXNNYW55IGZpZWxkJyk7XG4gICAgfVxuICB9XG5cbiAgcmVtb3ZlKGtleTogc3RyaW5nLCBpdGVtOiBSZWxhdGlvbnNoaXBJdGVtKTogdGhpcyB7XG4gICAgaWYgKGtleSBpbiB0aGlzLnNjaGVtYS5yZWxhdGlvbnNoaXBzKSB7XG4gICAgICBpZiAoaXRlbS5pZCA+PSAxKSB7XG4gICAgICAgIGlmICghKGtleSBpbiB0aGlzLmRpcnR5LnJlbGF0aW9uc2hpcHMpKSB7XG4gICAgICAgICAgdGhpcy5kaXJ0eS5yZWxhdGlvbnNoaXBzW2tleV0gPSBbXTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRpcnR5LnJlbGF0aW9uc2hpcHNba2V5XS5wdXNoKHtcbiAgICAgICAgICBvcDogJ3JlbW92ZScsXG4gICAgICAgICAgZGF0YTogaXRlbSxcbiAgICAgICAgfSk7XG4gICAgICAgIC8vIHRoaXMuJCRmaXJlVXBkYXRlKCk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGl0ZW0gJHJlbW92ZWQgZnJvbSBoYXNNYW55Jyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90ICRyZW1vdmUgZXhjZXB0IGZyb20gaGFzTWFueSBmaWVsZCcpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyBhcHBseURlbHRhKGN1cnJlbnQsIGRlbHRhKSB7XG4gICAgaWYgKGRlbHRhLm9wID09PSAnYWRkJyB8fCBkZWx0YS5vcCA9PT0gJ21vZGlmeScpIHtcbiAgICAgIGNvbnN0IHJldFZhbCA9IG1lcmdlT3B0aW9ucyh7fSwgY3VycmVudCwgZGVsdGEuZGF0YSk7XG4gICAgICByZXR1cm4gcmV0VmFsO1xuICAgIH0gZWxzZSBpZiAoZGVsdGEub3AgPT09ICdyZW1vdmUnKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gY3VycmVudDtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgcmVzb2x2ZUFuZE92ZXJsYXkoXG4gICAgdXBkYXRlLFxuICAgIGJhc2U6IHsgYXR0cmlidXRlcz86IGFueTsgcmVsYXRpb25zaGlwcz86IGFueSB9ID0ge1xuICAgICAgYXR0cmlidXRlczoge30sXG4gICAgICByZWxhdGlvbnNoaXBzOiB7fSxcbiAgICB9LFxuICApIHtcbiAgICBjb25zdCBhdHRyaWJ1dGVzID0gbWVyZ2VPcHRpb25zKHt9LCBiYXNlLmF0dHJpYnV0ZXMsIHVwZGF0ZS5hdHRyaWJ1dGVzKTtcbiAgICBjb25zdCByZXNvbHZlZFJlbGF0aW9uc2hpcHMgPSB0aGlzLnJlc29sdmVSZWxhdGlvbnNoaXBzKFxuICAgICAgdXBkYXRlLnJlbGF0aW9uc2hpcHMsXG4gICAgICBiYXNlLnJlbGF0aW9uc2hpcHMsXG4gICAgKTtcbiAgICByZXR1cm4geyBhdHRyaWJ1dGVzLCByZWxhdGlvbnNoaXBzOiByZXNvbHZlZFJlbGF0aW9uc2hpcHMgfTtcbiAgfVxuXG4gIHN0YXRpYyByZXNvbHZlUmVsYXRpb25zaGlwcyhkZWx0YXMsIGJhc2UgPSB7fSkge1xuICAgIGNvbnN0IHVwZGF0ZXMgPSBPYmplY3Qua2V5cyhkZWx0YXMpXG4gICAgICAubWFwKHJlbE5hbWUgPT4ge1xuICAgICAgICBjb25zdCByZXNvbHZlZCA9IHRoaXMucmVzb2x2ZVJlbGF0aW9uc2hpcChcbiAgICAgICAgICBkZWx0YXNbcmVsTmFtZV0sXG4gICAgICAgICAgYmFzZVtyZWxOYW1lXSxcbiAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIHsgW3JlbE5hbWVdOiByZXNvbHZlZCB9O1xuICAgICAgfSlcbiAgICAgIC5yZWR1Y2UoKGFjYywgY3VycikgPT4gbWVyZ2VPcHRpb25zKGFjYywgY3VyciksIHt9KTtcbiAgICByZXR1cm4gbWVyZ2VPcHRpb25zKHt9LCBiYXNlLCB1cGRhdGVzKTtcbiAgfVxuXG4gIHN0YXRpYyByZXNvbHZlUmVsYXRpb25zaGlwKFxuICAgIGRlbHRhczogUmVsYXRpb25zaGlwRGVsdGFbXSxcbiAgICBiYXNlOiBSZWxhdGlvbnNoaXBJdGVtW10gPSBbXSxcbiAgKSB7XG4gICAgY29uc3QgcmV0VmFsID0gYmFzZS5jb25jYXQoKTtcbiAgICBkZWx0YXMuZm9yRWFjaChkZWx0YSA9PiB7XG4gICAgICBpZiAoZGVsdGEub3AgPT09ICdhZGQnIHx8IGRlbHRhLm9wID09PSAnbW9kaWZ5Jykge1xuICAgICAgICBjb25zdCBjdXJyZW50SW5kZXggPSByZXRWYWwuZmluZEluZGV4KHYgPT4gdi5pZCA9PT0gZGVsdGEuZGF0YS5pZCk7XG4gICAgICAgIGlmIChjdXJyZW50SW5kZXggPj0gMCkge1xuICAgICAgICAgIHJldFZhbFtjdXJyZW50SW5kZXhdID0gZGVsdGEuZGF0YTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXRWYWwucHVzaChkZWx0YS5kYXRhKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChkZWx0YS5vcCA9PT0gJ3JlbW92ZScpIHtcbiAgICAgICAgY29uc3QgY3VycmVudEluZGV4ID0gcmV0VmFsLmZpbmRJbmRleCh2ID0+IHYuaWQgPT09IGRlbHRhLmRhdGEuaWQpO1xuICAgICAgICBpZiAoY3VycmVudEluZGV4ID49IDApIHtcbiAgICAgICAgICByZXRWYWwuc3BsaWNlKGN1cnJlbnRJbmRleCwgMSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmV0VmFsO1xuICB9XG59XG4iXX0=
