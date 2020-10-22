const path = require('path')
const { ProjectFilesManager } = require('../lib/index')

const makeDefaultManager = ({
    semver,
    type = 'minor',
    skipSemVerFor = 'ios',
    skipCodeFor = 'ios',
    gradleFileName = 'double.gradle'
} = {}) => new ProjectFilesManager({
    type,
    semver,
    skipSemVerFor,
    skipCodeFor,
    root: path.join(__dirname, 'android'),
    buildGradlePath: path.join(__dirname, 'android', gradleFileName)
})

test('successfully bump version', () => {
    const manager = makeDefaultManager().dryRun()

    expect(manager.buildGradle.content).toMatchSnapshot()
})


test('skip semVer when asked', () => {
    const manager = makeDefaultManager({ skipSemVerFor: 'all' }).dryRun()

    expect(manager.buildGradle.content).toMatchSnapshot()
})

test('preserve quotes style', () => {
    const manager = makeDefaultManager({ gradleFileName: 'single.gradle' }).dryRun()

    expect(manager.buildGradle.content).toMatchSnapshot()
})

test('direct set semver string', () => {
    const manager = makeDefaultManager({ semver: '1.1.2' }).dryRun()

    expect(manager.buildGradle.content).toMatchSnapshot()
    expect(manager.packageJSON.content).toMatchSnapshot()
})
