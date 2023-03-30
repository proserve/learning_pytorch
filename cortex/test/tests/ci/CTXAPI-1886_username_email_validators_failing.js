const should = require('should'),
      { createAccount,
        getInstance,
        updateInstance,
        deleteInstance } = require('../../lib/utils')()

describe('CTXAPI-1886 username and email validators failing', () => {
  let account

  before(async() => {
    const credentials = {
      name: {
        first: 'Drew',
        last: 'Holbrook'
      },
      email: 'drew.holbrook@medable.com',
      username: 'drewholbrook',
      mobile: '15055555555',
      password: 'myPa$$word123'
    }

    account = await createAccount(credentials)
  })

  after(async function() {
    await deleteInstance('accounts', account._id)
  })

  it('does not throw duplicateEmail error when username is updated', async() => {
    const update = {
      $set: {
        username: 'newUsername'
      }
    }

    await updateInstance('accounts', account._id, update)

    let updatedAccount = await getInstance('accounts', account._id)

    should.equal(updatedAccount.username, 'newUsername')
  })

  it('does not throw duplicateUsername error when email is updated', async() => {
    const update = {
      $set: {
        email: 'updated@medable.com'
      }
    }

    await updateInstance('accounts', account._id, update)

    let updatedAccount = await getInstance('accounts', account._id)

    should.equal(updatedAccount.email, 'updated@medable.com')
  })
})
