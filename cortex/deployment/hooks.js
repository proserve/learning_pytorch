'use strict'

const fs = require('fs'),
      path = require('path')

module.exports = {

  'build.before': function(project, task) {

    const isLocal = project.arg('local'),
          localRepoDir = path.join(project.workingDir, 'repo'),
          image = `${project.imageTag}${(isLocal ? '-local' : '')}`

    task.assert(
      '',
      '',
      () => {
        const configJson = JSON.parse(fs.readFileSync(path.join(localRepoDir, 'config.json'), 'utf8'))
        configJson.image = image
        console.log(`Setting config.image in config.json to: ${image}`)
        fs.writeFileSync(path.join(localRepoDir, 'config.json'), JSON.stringify(configJson, null, 2), 'utf8')
        return true
      }
    )

    if (isLocal) {
      console.log('nuking local json')
      fs.unlinkSync(path.join(localRepoDir, 'config.local.json'))
    }

    return true

  }

}
