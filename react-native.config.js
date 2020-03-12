const { versioner } = require('./lib/index')

module.exports = {
    commands: [{
        name: 'bump-version',
        func: (_, config, args) => {

            if (args.skipCodeFor === 'all' && args.skipSemverFor === 'all') {
                // https://i.kym-cdn.com/photos/images/newsfeed/001/240/075/90f.png
                console.log('My work here is done.')
                return
            }

            versioner({
                root: config.root,
                pbxprojPath: config.project.ios.pbxprojPath,
                buildGradlePath: config.project.android.buildGradlePath,
                type: args.type,
                skipCodeFor: args.skipCodeFor
                    ? args.skipCodeFor.split(' ')
                    : [],
                skipSemVerFor: args.skipSemverFor
                    ? args.skipSemverFor.split(' ')
                    : []
            })
        },
        options: [
            {
                name: '--type [major|minor|patch]',
                description: 'SemVer release type, optional if --skip-semver is true'
            },
            {
                name: '--skip-semver-for [android|ios|all]',
                description: 'Skips bump SemVer for specified platform'
            },
            {
                name: '--skip-code-for [android|ios|all]',
                description: 'Skips bump version codes for specified platform'
            }
        ]
    }]
}
