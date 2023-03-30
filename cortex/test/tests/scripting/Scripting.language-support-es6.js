'use strict'

const wrapper = require('../../lib/wrapped_sandbox')

module.exports = {

  specification: 'es6',

  main: `

        import objects from "objects"
        import should from "should"

        // destructuring
        let [a, b] = (() => {return [1, 2]})();
        should.equal(a + b, 3);

        const privates = Symbol('privates');
        
        class Thing {
            constructor(z) {
                this.foo = z;
                this[privates] = 'i am private!';
            }
            baz(a, ...b) {
                const boo = () => {
                    return b + '_' + this.foo + '_' + script.principal._id + objects.read('accounts', script.principal._id, {paths:'email'}).email;
                };
                return boo();
            }
        }
        class Thang extends Thing {
            constructor(z = {a: 7}) {
                super(z.a)
            }
        }

        const out = [1, 2, 3], t = new Thang();
        const answer = new Thang().baz(1, 2, 3, 4);        
        
        should.equal(t.privates, undefined);
        should.equal(t[Symbol('privates')], undefined);
        should.equal(t[privates], 'i am private!');
        
        const obj = {out, answer, ['a'+out[0]]: '111'};
        should.equal (
            \`this \${obj.a1} is really something: \${obj.answer}\`,
            'this 111 is really something: 2,3,4_7_' + script.principal._id + script.principal.email
        );

        return true`

}

describe('Scripting', function() {
  it(...wrapper.wrap(__filename, module.exports))
})
