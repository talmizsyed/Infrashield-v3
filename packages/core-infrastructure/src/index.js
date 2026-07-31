'use strict';
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __exportStar =
  (this && this.__exportStar) ||
  function (m, exports) {
    for (var p in m)
      if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p))
        __createBinding(exports, m, p);
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.ValidationException =
  exports.ServiceScope =
  exports.ServiceProvider =
  exports.Transient =
  exports.Singleton =
  exports.Scoped =
  exports.ServiceLifetime =
  exports.ServiceDescriptor =
  exports.ServiceCollection =
  exports.ResolutionException =
  exports.DependencyRegistrationError =
  exports.DependencyInjectionError =
  exports.createInjectionToken =
  exports.CircularDependencyException =
    void 0;
__exportStar(require('./clock'), exports);
__exportStar(require('./configuration'), exports);
var di_1 = require('./di');
Object.defineProperty(exports, 'CircularDependencyException', {
  enumerable: true,
  get: function () {
    return di_1.CircularDependencyException;
  },
});
Object.defineProperty(exports, 'createInjectionToken', {
  enumerable: true,
  get: function () {
    return di_1.createInjectionToken;
  },
});
Object.defineProperty(exports, 'DependencyInjectionError', {
  enumerable: true,
  get: function () {
    return di_1.DependencyInjectionError;
  },
});
Object.defineProperty(exports, 'DependencyRegistrationError', {
  enumerable: true,
  get: function () {
    return di_1.DependencyRegistrationError;
  },
});
Object.defineProperty(exports, 'ResolutionException', {
  enumerable: true,
  get: function () {
    return di_1.ResolutionException;
  },
});
Object.defineProperty(exports, 'ServiceCollection', {
  enumerable: true,
  get: function () {
    return di_1.ServiceCollection;
  },
});
Object.defineProperty(exports, 'ServiceDescriptor', {
  enumerable: true,
  get: function () {
    return di_1.ServiceDescriptor;
  },
});
Object.defineProperty(exports, 'ServiceLifetime', {
  enumerable: true,
  get: function () {
    return di_1.ServiceLifetime;
  },
});
Object.defineProperty(exports, 'Scoped', {
  enumerable: true,
  get: function () {
    return di_1.Scoped;
  },
});
Object.defineProperty(exports, 'Singleton', {
  enumerable: true,
  get: function () {
    return di_1.Singleton;
  },
});
Object.defineProperty(exports, 'Transient', {
  enumerable: true,
  get: function () {
    return di_1.Transient;
  },
});
Object.defineProperty(exports, 'ServiceProvider', {
  enumerable: true,
  get: function () {
    return di_1.ServiceProvider;
  },
});
Object.defineProperty(exports, 'ServiceScope', {
  enumerable: true,
  get: function () {
    return di_1.ServiceScope;
  },
});
Object.defineProperty(exports, 'ValidationException', {
  enumerable: true,
  get: function () {
    return di_1.ValidationException;
  },
});
__exportStar(require('./errors'), exports);
__exportStar(require('./event-bus'), exports);
__exportStar(require('./logger'), exports);
__exportStar(require('./options'), exports);
__exportStar(require('./primitives'), exports);
__exportStar(require('./result'), exports);
__exportStar(require('./serializer'), exports);
//# sourceMappingURL=index.js.map
