const path = require("path");
const { versioner } = require("../lib/index");

const makeDefaultManager = ({
    semver,
    type = "minor",
    skipSemverFor = "ios",
    skipCodeFor = "ios",
    appName = "double",
} = {}) =>
    versioner({
        root: path.join(__dirname, "android"),
        project: {
            android: {
                appName: appName,
                sourceDir: path.join(__dirname, "android"),
            },
        },
    }, {
        type,
        semver,
        skipSemverFor,
        skipCodeFor,
    });

test("successfully bump version", () => {
    const manager = makeDefaultManager().dryRun();

    expect(manager.buildGradle.content).toMatchSnapshot();
});

test("skip semVer when asked", () => {
    const manager = makeDefaultManager({ skipSemverFor: "all" }).dryRun();

    expect(manager.buildGradle.content).toMatchSnapshot();
});

test("preserve quotes style", () => {
    const manager = makeDefaultManager({ appName: "single" }).dryRun();

    expect(manager.buildGradle.content).toMatchSnapshot();
});

test("direct set semver string", () => {
    const manager = makeDefaultManager({ semver: "1.1.2" }).dryRun();

    expect(manager.buildGradle.content).toMatchSnapshot();
    expect(manager.packageJSON.content).toMatchSnapshot();
});
