"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Oracle = (function () {
    function Oracle() {
        this.authorizers = {};
    }
    Oracle.prototype.addAuthorizer = function (auth, forType) {
        var authKeys = Object.keys(auth.relationships);
        var forKeys = Object.keys(forType.relationships);
        var missing = forKeys.filter(function (k) { return authKeys.indexOf(k) < 0; });
        if (missing.length > 0) {
            throw new Error("Missing relationship authorizer(s) " + missing.join(', '));
        }
        this.authorizers[forType.name] = auth;
    };
    Oracle.prototype.dispatch = function (request) {
        var _this = this;
        return Promise.resolve()
            .then(function () {
            if (request.kind === 'relationship') {
                var relationshipAuthorizer = _this.authorizers[request.parent.typeName].relationships[request.relationship];
                if (request.action === 'create') {
                    return relationshipAuthorizer.authorizeCreate(request);
                }
                else if (request.action === 'read') {
                    return relationshipAuthorizer.authorizeRead(request);
                }
                else if (request.action === 'update') {
                    return relationshipAuthorizer.authorizeUpdate(request);
                }
                else if (request.action === 'delete') {
                    return relationshipAuthorizer.authorizeDelete(request);
                }
            }
            else if (request.kind === 'attributes') {
                if (request.action === 'create') {
                    return _this.authorizers[request.data.typeName].attributes.authorizeCreate(request);
                }
                else if (request.action === 'read') {
                    return _this.authorizers[request.target.typeName].attributes.authorizeRead(request);
                }
                else if (request.action === 'update') {
                    return _this.authorizers[request.target.typeName].attributes.authorizeUpdate(request);
                }
                else if (request.action === 'delete') {
                    return _this.authorizers[request.target.typeName].attributes.authorizeDelete(request);
                }
            }
            else if (request.kind === 'compound') {
                return Promise.all(request.list.map(function (v) { return _this.dispatch(v); }))
                    .then(function (res) { return request.combinator === 'or' ? res.some(function (v) { return v.result; }) : res.every(function (v) { return v.result; }); })
                    .then(function (f) { return ({ kind: 'final', result: f }); });
            }
        }).then(function (v) {
            if (v.kind === 'final') {
                return v;
            }
            else if (v.kind === 'delegated') {
                return _this.dispatch(v.delegate);
            }
        });
    };
    Oracle.prototype.authorize = function (request) {
        return this.dispatch(request)
            .then(function (f) { return f.result; });
    };
    return Oracle;
}());
exports.Oracle = Oracle;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9hdXRob3JpemUvb3JhY2xlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBUUE7SUFBQTtRQUNVLGdCQUFXLEdBQTJDLEVBQUUsQ0FBQztJQXNEbkUsQ0FBQztJQXBEQyw4QkFBYSxHQUFiLFVBQWMsSUFBMEIsRUFBRSxPQUFvQjtRQUM1RCxJQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNqRCxJQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUNuRCxJQUFNLE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsUUFBUSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLEVBQXZCLENBQXVCLENBQUMsQ0FBQztRQUM3RCxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkIsTUFBTSxJQUFJLEtBQUssQ0FBQyx3Q0FBc0MsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUcsQ0FBQyxDQUFDO1FBQzlFLENBQUM7UUFDRCxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUM7SUFDeEMsQ0FBQztJQUVELHlCQUFRLEdBQVIsVUFBUyxPQUF5QjtRQUFsQyxpQkFvQ0M7UUFuQ0MsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUU7YUFDdkIsSUFBSSxDQUFvQjtZQUN2QixFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFLLGNBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BDLElBQU0sc0JBQXNCLEdBQUcsS0FBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLENBQUM7Z0JBQzdHLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztvQkFDaEMsTUFBTSxDQUFDLHNCQUFzQixDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDekQsQ0FBQztnQkFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDO29CQUNyQyxNQUFNLENBQUMsc0JBQXNCLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN2RCxDQUFDO2dCQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7b0JBQ3ZDLE1BQU0sQ0FBQyxzQkFBc0IsQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3pELENBQUM7Z0JBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztvQkFDdkMsTUFBTSxDQUFDLHNCQUFzQixDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDekQsQ0FBQztZQUNILENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxZQUFZLENBQUMsQ0FBQyxDQUFDO2dCQUN6QyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7b0JBQ2hDLE1BQU0sQ0FBQyxLQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDckYsQ0FBQztnQkFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDO29CQUNyQyxNQUFNLENBQUMsS0FBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQ3JGLENBQUM7Z0JBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQztvQkFDdkMsTUFBTSxDQUFDLEtBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxVQUFVLENBQUMsZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2dCQUN2RixDQUFDO2dCQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUM7b0JBQ3ZDLE1BQU0sQ0FBQyxLQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDdkYsQ0FBQztZQUNILENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDO2dCQUN2QyxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLEtBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLEVBQWhCLENBQWdCLENBQUMsQ0FBQztxQkFDMUQsSUFBSSxDQUFDLFVBQUMsR0FBNkIsSUFBSyxPQUFBLE9BQU8sQ0FBQyxVQUFVLEtBQUssSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsTUFBTSxFQUFSLENBQVEsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsTUFBTSxFQUFSLENBQVEsQ0FBRSxFQUFqRixDQUFpRixDQUFDO3FCQUMxSCxJQUFJLENBQXlCLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQTlCLENBQThCLENBQUMsQ0FBQztZQUNyRSxDQUFDO1FBQ0gsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQUMsQ0FBQztZQUNSLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQztnQkFDdkIsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUNYLENBQUM7WUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDO2dCQUNsQyxNQUFNLENBQUMsS0FBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDbkMsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELDBCQUFTLEdBQVQsVUFBVSxPQUF5QjtRQUNqQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7YUFDNUIsSUFBSSxDQUFDLFVBQUMsQ0FBeUIsSUFBSyxPQUFBLENBQUMsQ0FBQyxNQUFNLEVBQVIsQ0FBUSxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUNILGFBQUM7QUFBRCxDQXZEQSxBQXVEQyxJQUFBO0FBdkRZLHdCQUFNIiwiZmlsZSI6ImF1dGhvcml6ZS9vcmFjbGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBBdXRob3JpemVyRGVmaW5pdGlvbixcbiAgQXV0aG9yaXplUmVxdWVzdCxcbiAgQXV0aG9yaXplUmVzcG9uc2UsXG4gIEZpbmFsQXV0aG9yaXplUmVzcG9uc2UsXG59IGZyb20gJy4vZGF0YVR5cGVzJztcbmltcG9ydCB7IE1vZGVsU2NoZW1hIH0gZnJvbSAnLi4vZGF0YVR5cGVzJztcblxuZXhwb3J0IGNsYXNzIE9yYWNsZSB7XG4gIHByaXZhdGUgYXV0aG9yaXplcnM6IHtbbmFtZTogc3RyaW5nXTogQXV0aG9yaXplckRlZmluaXRpb259ID0ge307XG5cbiAgYWRkQXV0aG9yaXplcihhdXRoOiBBdXRob3JpemVyRGVmaW5pdGlvbiwgZm9yVHlwZTogTW9kZWxTY2hlbWEpIHtcbiAgICBjb25zdCBhdXRoS2V5cyA9IE9iamVjdC5rZXlzKGF1dGgucmVsYXRpb25zaGlwcyk7XG4gICAgY29uc3QgZm9yS2V5cyA9IE9iamVjdC5rZXlzKGZvclR5cGUucmVsYXRpb25zaGlwcyk7XG4gICAgY29uc3QgbWlzc2luZyA9IGZvcktleXMuZmlsdGVyKGsgPT4gYXV0aEtleXMuaW5kZXhPZihrKSA8IDApO1xuICAgIGlmIChtaXNzaW5nLmxlbmd0aCA+IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgTWlzc2luZyByZWxhdGlvbnNoaXAgYXV0aG9yaXplcihzKSAke21pc3Npbmcuam9pbignLCAnKX1gKTtcbiAgICB9XG4gICAgdGhpcy5hdXRob3JpemVyc1tmb3JUeXBlLm5hbWVdID0gYXV0aDtcbiAgfVxuXG4gIGRpc3BhdGNoKHJlcXVlc3Q6IEF1dGhvcml6ZVJlcXVlc3QpOiBQcm9taXNlPEF1dGhvcml6ZVJlc3BvbnNlPiB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgLnRoZW48QXV0aG9yaXplUmVzcG9uc2U+KCgpID0+IHtcbiAgICAgIGlmIChyZXF1ZXN0LmtpbmQgPT09ICdyZWxhdGlvbnNoaXAnKSB7XG4gICAgICAgIGNvbnN0IHJlbGF0aW9uc2hpcEF1dGhvcml6ZXIgPSB0aGlzLmF1dGhvcml6ZXJzW3JlcXVlc3QucGFyZW50LnR5cGVOYW1lXS5yZWxhdGlvbnNoaXBzW3JlcXVlc3QucmVsYXRpb25zaGlwXTtcbiAgICAgICAgaWYgKHJlcXVlc3QuYWN0aW9uID09PSAnY3JlYXRlJykge1xuICAgICAgICAgIHJldHVybiByZWxhdGlvbnNoaXBBdXRob3JpemVyLmF1dGhvcml6ZUNyZWF0ZShyZXF1ZXN0KTtcbiAgICAgICAgfSBlbHNlIGlmIChyZXF1ZXN0LmFjdGlvbiA9PT0gJ3JlYWQnKSB7XG4gICAgICAgICAgcmV0dXJuIHJlbGF0aW9uc2hpcEF1dGhvcml6ZXIuYXV0aG9yaXplUmVhZChyZXF1ZXN0KTtcbiAgICAgICAgfSBlbHNlIGlmIChyZXF1ZXN0LmFjdGlvbiA9PT0gJ3VwZGF0ZScpIHtcbiAgICAgICAgICByZXR1cm4gcmVsYXRpb25zaGlwQXV0aG9yaXplci5hdXRob3JpemVVcGRhdGUocmVxdWVzdCk7XG4gICAgICAgIH0gZWxzZSBpZiAocmVxdWVzdC5hY3Rpb24gPT09ICdkZWxldGUnKSB7XG4gICAgICAgICAgcmV0dXJuIHJlbGF0aW9uc2hpcEF1dGhvcml6ZXIuYXV0aG9yaXplRGVsZXRlKHJlcXVlc3QpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKHJlcXVlc3Qua2luZCA9PT0gJ2F0dHJpYnV0ZXMnKSB7XG4gICAgICAgIGlmIChyZXF1ZXN0LmFjdGlvbiA9PT0gJ2NyZWF0ZScpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5hdXRob3JpemVyc1tyZXF1ZXN0LmRhdGEudHlwZU5hbWVdLmF0dHJpYnV0ZXMuYXV0aG9yaXplQ3JlYXRlKHJlcXVlc3QpO1xuICAgICAgICB9IGVsc2UgaWYgKHJlcXVlc3QuYWN0aW9uID09PSAncmVhZCcpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5hdXRob3JpemVyc1tyZXF1ZXN0LnRhcmdldC50eXBlTmFtZV0uYXR0cmlidXRlcy5hdXRob3JpemVSZWFkKHJlcXVlc3QpO1xuICAgICAgICB9IGVsc2UgaWYgKHJlcXVlc3QuYWN0aW9uID09PSAndXBkYXRlJykge1xuICAgICAgICAgIHJldHVybiB0aGlzLmF1dGhvcml6ZXJzW3JlcXVlc3QudGFyZ2V0LnR5cGVOYW1lXS5hdHRyaWJ1dGVzLmF1dGhvcml6ZVVwZGF0ZShyZXF1ZXN0KTtcbiAgICAgICAgfSBlbHNlIGlmIChyZXF1ZXN0LmFjdGlvbiA9PT0gJ2RlbGV0ZScpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5hdXRob3JpemVyc1tyZXF1ZXN0LnRhcmdldC50eXBlTmFtZV0uYXR0cmlidXRlcy5hdXRob3JpemVEZWxldGUocmVxdWVzdCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocmVxdWVzdC5raW5kID09PSAnY29tcG91bmQnKSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLmFsbChyZXF1ZXN0Lmxpc3QubWFwKHYgPT4gdGhpcy5kaXNwYXRjaCh2KSkpXG4gICAgICAgIC50aGVuKChyZXM6IEZpbmFsQXV0aG9yaXplUmVzcG9uc2VbXSkgPT4gcmVxdWVzdC5jb21iaW5hdG9yID09PSAnb3InID8gcmVzLnNvbWUodiA9PiB2LnJlc3VsdCkgOiByZXMuZXZlcnkodiA9PiB2LnJlc3VsdCApKVxuICAgICAgICAudGhlbjxGaW5hbEF1dGhvcml6ZVJlc3BvbnNlPihmID0+ICh7IGtpbmQ6ICdmaW5hbCcsIHJlc3VsdDogZiB9KSk7XG4gICAgICB9XG4gICAgfSkudGhlbigodikgPT4ge1xuICAgICAgaWYgKHYua2luZCA9PT0gJ2ZpbmFsJykge1xuICAgICAgICByZXR1cm4gdjtcbiAgICAgIH0gZWxzZSBpZiAodi5raW5kID09PSAnZGVsZWdhdGVkJykge1xuICAgICAgICByZXR1cm4gdGhpcy5kaXNwYXRjaCh2LmRlbGVnYXRlKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIGF1dGhvcml6ZShyZXF1ZXN0OiBBdXRob3JpemVSZXF1ZXN0KTogUHJvbWlzZTxib29sZWFuPiB7XG4gICAgcmV0dXJuIHRoaXMuZGlzcGF0Y2gocmVxdWVzdClcbiAgICAudGhlbigoZjogRmluYWxBdXRob3JpemVSZXNwb25zZSkgPT4gZi5yZXN1bHQpO1xuICB9XG59XG4iXX0=
