
const pOptions = Symbol('options')

class ServiceProvider {

  constructor(options) {
    this[pOptions] = options
  }

}

class IdentityProvider {

  constructor(options) {
    this[pOptions] = options
  }

}

Object.keys(module.exports).forEach((method) => {

  const moduleFn = module.exports[method]
  if (typeof module.exports[method] === 'function') {
    Object.defineProperty(ServiceProvider.prototype, method, {
      value(...args) {

        // convert idp to plain object and inject sp config
        args.forEach((v, i, a) => {
          if (v instanceof IdentityProvider) {
            a[i] = v[pOptions]
          }
        })
        return moduleFn(this[pOptions], ...args)
      }
    })

  }

})

module.exports = {
  IdentityProvider,
  ServiceProvider
}
