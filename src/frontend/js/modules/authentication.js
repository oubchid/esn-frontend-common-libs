import jwtDecode from 'jwt-decode';

angular.module('esn.authentication', ['esn.http'])
  .factory('tokenAPI', function(esnRestangular, $log) {

    // https://github.com/linagora/openpaas-esn/blob/master/backend/core/auth/token.js#L3
    // token TTL is 60 seconds server-side. We keep a lower value to get over
    // network lags
    const SERVER_TTL = 60 * 1000;
    const NETWORK_LAG = 15 * 1000;
    const CACHE_MAX_TTL = SERVER_TTL - NETWORK_LAG;
    const cachedToken = { promise: null, timestamp: 0 };
    const cachedJWTToken = { promise: null, expirationTime: 0 };

    return {
      getNewToken,
      getWebToken
    };

    function getNewToken(resetCache = false) {
      return resetCache ? getTokenNoCache() : getCachedToken();
    }

    function getWebToken(reset = false) {
      return reset ? requestNewWebToken() : getCachedWebToken();
    }

    function requestNewWebToken() {
      const jwtPromise = esnRestangular.one('jwt/generate').post();

      return jwtPromise
        .then(({ data: token }) => {
          // Expiration time claim not included? default to 0, meaning never expires
          const { exp = 0 } = jwtDecode(token);

          setJWTCache(jwtPromise, exp);

          return jwtPromise;
        })
        .catch(err => {
          $log.error(`An error occured while fetching the JWT: ${err}`);
          setJWTCache(null);
        });
    }

    function getCachedWebToken() {
      const { expirationTime, promise } = cachedJWTToken;

      // check if the cached token never expires.
      if (!expirationTime) return promise || requestNewWebToken();

      // check if we haven't reached the expiration time yet.
      // jwt exp claim is a NumericDate value that is defined as the number of seconds (not milliseconds) since Epoch.
      return expirationTime > Date.now() / 1000 ? promise : requestNewWebToken();
    }

    function getCachedToken() {
      const { promise, timestamp } = getCache();

      return timestamp + CACHE_MAX_TTL > Date.now() ? promise : getTokenNoCache();
    }

    function getTokenNoCache() {
      setCache(esnRestangular.one('authenticationtoken').get(), Date.now());

      cachedToken.promise.catch(() => {
        setCache(null);
      });

      return cachedToken.promise;
    }

    function setCache(promise, timestamp = 0) {
      cachedToken.promise = promise;
      cachedToken.timestamp = timestamp;
    }

    function getCache() {
      return cachedToken;
    }

    function setJWTCache(promise, expirationTime = 0) {
      cachedJWTToken.promise = promise;
      cachedJWTToken.expirationTime = expirationTime;
    }
  });

require('./http.js');
