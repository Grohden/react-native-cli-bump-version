const path = require("path");
const { ProjectFilesManager } = require("../lib/index");

const makeDefaultManager = ({
    semver,
    type = "minor",
    skipSemVerFor = "android",
    skipCodeFor = "android",
    pbxFileName = "project.pbxproj",
} = {}) =>
    new ProjectFilesManager({
        type,
        semver,
        skipSemVerFor,
        skipCodeFor,
        root: path.join(__dirname, "ios"),
        pbxprojPath: path.join(__dirname, "ios", pbxFileName),
    });

test("successfully bump version", () => {
    const manager = makeDefaultManager().dryRun();

    expect(manager.pbx.content).toMatchSnapshot();
});

test("skip semVer when asked", () => {
    const manager = makeDefaultManager({ skipSemVerFor: "all" }).dryRun();

    expect(manager.pbx.content).toMatchSnapshot();
});

test("direct set semver string", () => {
    const manager = makeDefaultManager({ semver: "1.1.2" }).dryRun();

    expect(manager.pbx.content).toMatchSnapshot();
    expect(manager.packageJSON.content).toMatchSnapshot();
});
