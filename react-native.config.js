const { versioner } = require("./lib/index");
const path = require("path");

module.exports = {
    commands: [{
        name: "bump-version",
        func: (_, config, args) => {
            const result = versioner(config, args);

            if(result) {
                result.run();
            }
        },
        options: [
            {
                name: "--type [major|minor|patch]",
                description: "SemVer release type, optional if --skip-semver-for all is passed, ignored (and optional) when --semver is passed",
            },
            {
                name: "--semver [String]",
                description: "Pass release version if known. Overwrites calculated SemVer. Optional.",
            },
            {
                name: "--skip-semver-for [android|ios|all]",
                description: "Skips bump SemVer for specified platform",
            },
            {
                name: "--skip-code-for [android|ios|all]",
                description: "Skips bump version codes for specified platform",
            },
        ],
    }],
};
