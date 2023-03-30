const Operator = require('../operator'),
      { ExpressionFactory } = require('../factory'),
      { isPlainObjectWithSubstance } = require('../../../utils')

class Operator$i18n extends Operator {

  parse(value, expression) {
    if (isPlainObjectWithSubstance(value)) {
      const { key, locale, namespace } = value
      super.parse({
        key: ExpressionFactory.guess(key, { parent: expression }),
        locale: ExpressionFactory.guess(locale, { parent: expression }),
        namespace: ExpressionFactory.guess(namespace, { parent: expression })
      }, expression)
    } else {
      super.parse({ key: ExpressionFactory.guess(value, { parent: expression }) }, expression)
    }
  }

  async evaluate(ec) {
    const { ac } = ec,
          { key, namespace, locale } = this.value,
          loc = locale ? await locale.evaluate(ec) : null,
          ns = namespace ? await namespace.evaluate(ec) : null,
          k = await key.evaluate(ec)
    return ac.principal.org.i18n.translate(ac, k, { locale: loc, namespace: ns })
  }

}

module.exports = Operator$i18n
