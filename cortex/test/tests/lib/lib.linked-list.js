'use strict'

const LinkedList = require('cortex-service/lib/linked-list'),
      should = require('should')

describe('Lib', function() {

  describe('Linked List', function() {

    const listNumbers = new LinkedList(),
          listStrings = new LinkedList(),
          listEmpty = new LinkedList()

    it('push', function() {

      listNumbers.push(new LinkedList.Node(1))
      listNumbers.push(new LinkedList.Node(2))
      listNumbers.push(new LinkedList.Node(3))
      listNumbers.push(new LinkedList.Node(4))
      listNumbers.push(new LinkedList.Node(5))

      should.equal(listNumbers.last.value, 5)

      should.equal(listNumbers.length, 5)

      listStrings.push(new LinkedList.Node('one'))
      listStrings.push(new LinkedList.Node('two'))
      listStrings.push(new LinkedList.Node('three'))
      listStrings.push(new LinkedList.Node('four'))
      listStrings.push(new LinkedList.Node('five'))

      should.equal(listStrings.last.value, 'five')

    })

    it('at', function() {

      should.equal(listNumbers.at(-1), undefined)
      should.equal(listNumbers.at(5), undefined)
      should.equal(listNumbers.at(0).value, 1)

      should.equal(listEmpty.at(0), undefined)

    })

    it('pop', function() {

      should.equal(listNumbers.pop().value, 5)

      should.equal(listNumbers.length, 4)

      should.equal(listEmpty.pop(), undefined)

    })

    it('shift', function() {

      should.equal(listNumbers.shift().value, 1)

      should.equal(listNumbers.length, 3)

      should.equal(listEmpty.shift(), undefined)

    })

    it('insertAt', function() {

      listNumbers.insertAt(0, new LinkedList.Node(1))
      listNumbers.insertAt(3, new LinkedList.Node(3.5))

      should.equal(listNumbers.at(-1), undefined)
      should.equal(listNumbers.at(5), undefined)
      should.equal(listNumbers.at(0).value, 1)
      should.equal(listNumbers.at(3).value, 3.5)
      should.equal(listNumbers.at(4).value, 4)

      should.equal(listNumbers.length, 5)

      should.equal(listEmpty.insertAt(-1), undefined)
      should.equal(listEmpty.insertAt(0), undefined)

    })

    it('unshift', function() {

      listNumbers.unshift(new LinkedList.Node(0))
      should.equal(listNumbers.at(0).value, 0)

      should.equal(listNumbers.length, 6)

    })

    it('insertAfter', function() {

      listNumbers.insertAfter(listNumbers.first, new LinkedList.Node(0.5))
      should.equal(listNumbers.at(1).value, 0.5)

      should.equal(listNumbers.length, 7)

      listEmpty.insertAfter(listNumbers.first, new LinkedList.Node(0.5))
      should.equal(listEmpty.length, 0)

    })

    it('insertBefore', function() {

      listNumbers.insertBefore(listNumbers.last, new LinkedList.Node(4.5))
      should.equal(listNumbers.last.prev.value, 4.5)

      should.equal(listNumbers.length, 8)

      listEmpty.insertBefore(listNumbers.last, new LinkedList.Node(0.5))
      should.equal(listEmpty.length, 0)

    })

    it('reduce', function() {
      should.equal(listNumbers.reduce(count => count + 1, 0), 8)
    })

    it('forEach', function() {
      let count = 0
      listNumbers.forEach(() => count++)
      should.equal(count, 8)
    })

    it('remove', function() {

      listNumbers.remove(listNumbers.first)
      should.equal(listNumbers.length, 7)

      should.equal(listEmpty.remove(listNumbers.first), null)

    })

    it('empty', function() {

      listNumbers.empty()
      should.equal(listNumbers.length, 0)

    })

  })

})
