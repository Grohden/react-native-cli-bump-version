import fs from "fs";
import path from "path";

// -- Types

type SemVer = "major" | "minor" | "patch";

type Platforms = "android" | "ios" | "all";

type Configs = {
    type?: SemVer;
    semver?: string;
    skipSemVerFor: Platforms[];
    skipCodeFor: Platforms[];
    root: string;
    pbxprojPath: () => string;
    buildGradlePath: () => string;
};

// -- FP

const split = (sep: string) => (str: string) => str.split(sep);

const map = <T, R>(fn: (item: T) => R) => (list: T[]) => list.map(fn);

const pipe2 = <A1, A2, R>(
    fn1: (arg: A1) => A2,
    fn2: (arg: A2) => R,
) => (arg: A1) => fn2(fn1(arg));

const replace = (expr: string | RegExp, replacement: string, str: string) => {
    return str.replace(expr, replacement);
};

// -- Specializations

const parseDecimal = (it: string) => parseInt(it, 10);

const parseSemVer = pipe2(split("."), map(parseDecimal));

const writeFile = (fPath: string, file: string) => {
    fs.writeFileSync(fPath, file, "utf8");
};

const matchFirst = (reg: RegExp) =>
    (value: string) => {
        const [, first] = ([] as string[]).concat(reg.exec(value)!);

        return first;
    };

const incrementSemVer = (current: string, type: SemVer | undefined) => {
    const [major, minor, patch] = parseSemVer(current);

    if (type === "major") {
        return [major + 1, 0, 0].join(".");
    }

    if (type === "minor") {
        return [major, minor + 1, 0].join(".");
    }

    if (type === "patch") {
        return [major, minor, patch + 1].join(".");
    }

    throw new Error(`'${type}' is not a semver type`);
};

// -- Managers

abstract class BaseFileManager {
    private readonly basePath: () => string;
    protected content: string | null = null;

    constructor(basePath: () => string) {
        this.basePath = basePath;
    }

    protected read() {
        if (this.content === null) {
            this.content = fs.readFileSync(this.basePath(), "utf8");
        }

        return this.content;
    }

    write() {
        if (this.content) {
            return writeFile(this.basePath(), this.content);
        }
    }
}

class PBXManager extends BaseFileManager {
    bumpProjectVersion() {
        const currentFile = this.read();
        const codeRegex = /CURRENT_PROJECT_VERSION = (\d+);/g;
        const currentCode = pipe2(
            matchFirst(codeRegex),
            parseDecimal,
        )(currentFile);
        const nextCode = currentCode + 1;

        this.content = replace(
            codeRegex,
            `CURRENT_PROJECT_VERSION = ${nextCode};`,
            currentFile,
        );

        return {
            current: currentCode,
            next: nextCode,
        };
    }

    setMarketingVersion(nextVersion: string) {
        const currentFile = this.read();
        const versionRegex = /MARKETING_VERSION = (.*);/g;
        const currentVersion = matchFirst(versionRegex)(currentFile);

        this.content = replace(
            versionRegex,
            `MARKETING_VERSION = ${nextVersion};`,
            currentFile,
        );

        return {
            current: currentVersion,
            next: nextVersion,
        };
    }
}

class BuildGradleManager extends BaseFileManager {
    bumpCode() {
        const currentFile = this.read()!;
        const codeExp = /versionCode (\d+)/;

        const versionMatch = matchFirst(codeExp)(currentFile);
        const current = parseDecimal(versionMatch);
        const next = current + 1;

        if (isNaN(next)) {
            throw new Error(`Invalid versionCode version parsed (${versionMatch})`);
        }

        this.content = currentFile.replace(codeExp, `versionCode ${next}`);

        return { current, next };
    }

    setVersionName(next: string) {
        const currentFile = this.read()!;
        const quotes = /[^"']+/;
        const nameExp = /versionName ('.*'|".*")/;

        const current = matchFirst(nameExp)(currentFile);
        const newVersionName = current.replace(quotes, next);

        this.content = currentFile.replace(
            nameExp,
            // Here we try to prevent quotes style...
            // which may be unnecessary, but who knows?
            `versionName ${newVersionName}`,
        );

        return { current, next };
    }
}

class PackageJSONManager {
    private readonly basePath: () => string;
    public content: {
        version: string;
    } | null = null;

    constructor(basePath: () => string) {
        this.basePath = basePath;
    }

    private read() {
        if (this.content === null) {
            // Avoid direct require as it caches
            // resolved modules and changes to them
            // are going to be persisted in the same process
            const raw = fs.readFileSync(require.resolve(this.basePath()), {
                encoding: "utf8",
            });
            this.content = JSON.parse(raw);
        }

        return this.content!;
    }

    write() {
        if (this.content) {
            return writeFile(
                this.basePath(),
                JSON.stringify(this.content, null, 2),
            );
        }
    }

    getVersion() {
        return this.read().version;
    }

    setVersion(next: string) {
        const current = this.getVersion();
        this.content!.version = next;

        return { next, current };
    }
}

class ProjectFilesManager {
    readonly configs: Configs;
    readonly pbx: PBXManager;
    readonly buildGradle: BuildGradleManager;
    readonly packageJSON: PackageJSONManager;

    constructor(configs: Configs) {
        const { root, pbxprojPath, buildGradlePath } = configs;

        this.configs = configs;
        this.buildGradle = new BuildGradleManager(buildGradlePath);
        this.pbx = new PBXManager(pbxprojPath);
        this.packageJSON = new PackageJSONManager(() =>
            path.join(
                root,
                "package.json",
            )
        );
    }

    syncSemver(semverString: string) {
        const { skipSemVerFor } = this.configs;

        if (!skipSemVerFor.includes("ios")) {
            const {
                next: pbxNext,
                current: pbxCurrent,
            } = this.pbx.setMarketingVersion(semverString);
            console.log(`iOS project.pbxproj version: ${pbxCurrent} -> ${pbxNext}`);
        }

        if (!skipSemVerFor.includes("android")) {
            const {
                next: gradleNext,
                current: gradleCurrent,
            } = this.buildGradle.setVersionName(semverString);
            console.log(`Android gradle.build version: ${gradleCurrent} -> ${gradleNext}`);
        }

        const {
            next: packageNext,
            current: packageCurrent,
        } = this.packageJSON.setVersion(semverString);
        console.log(`package.json: ${packageCurrent} -> ${packageNext}`);
    }

    bumpCodes() {
        const { skipCodeFor } = this.configs;

        if (!skipCodeFor.includes("ios")) {
            const {
                next: pbxNext,
                current: pbxCurrent,
            } = this.pbx.bumpProjectVersion();
            console.log(`iOS project.pbxproj code: ${pbxCurrent} -> ${pbxNext}`);
        }

        if (!skipCodeFor.includes("android")) {
            const {
                next: gradleNext,
                current: gradleCurrent,
            } = this.buildGradle.bumpCode();
            console.log(`Android build.gradle code: ${gradleCurrent} -> ${gradleNext}`);
        }
    }

    run() {
        this.dryRun();
        this.pbx.write();
        this.buildGradle.write();
        this.packageJSON.write();
    }

    /**
     * Separated for testing
     *
     * This executes changes but don't actually write anything to fs
     */
    dryRun() {
        const { type, semver, skipSemVerFor, skipCodeFor } = this.configs;
        const current = this.packageJSON.getVersion();
        const next = semver ?? incrementSemVer(current, type ?? "minor");

        if (!skipCodeFor.includes("all")) {
            this.bumpCodes();
        }

        if (!skipSemVerFor.includes("all")) {
            if (!type && !semver) {
                throw new Error("bump type and semver value not specified");
            }

            this.syncSemver(next);
        }

        return this;
    }
}

// if you want a simple version to use as api
export const apiVersioner = (configs: Configs) => {
    return new ProjectFilesManager(configs);
};

export const versioner = (
    cliConfigs: {
        root?: string;
        project?: {
            ios?: {
                sourceDir?: string;
                pbxprojPath?: string;
                xcodeProject?: {
                    name: string;
                };
            };
            android?: {
                sourceDir?: string;
                appName?: string;
            };
        };
    },
    cliArgs: {
        skipCodeFor?: string;
        skipSemverFor?: string;
        semver?: string;
        type?: string;
    },
) => {
    // https://i.kym-cdn.com/photos/images/newsfeed/001/240/075/90f.png
    if (cliArgs.skipCodeFor === "all" && cliArgs.skipSemverFor === "all") {
        console.log("All bumps skipped due to skip flags.");
        return;
    }

    const required = <T>(value: T, name: string): NonNullable<T> => {
        if (!value) {
            throw new Error(
                `Value for ${name} is '${value}', maybe RN cli broke compatibility?`,
            );
        }

        return value!;
    };

    return apiVersioner({
        root: required(cliConfigs.root, "root"),
        pbxprojPath: () => {
            const iosProject = required(cliConfigs?.project?.ios, "project.ios");

            return iosProject.pbxprojPath || path.join(
                required(iosProject.sourceDir, "project.ios.sourceDir"),
                required(iosProject.xcodeProject, "project.ios.xcodeProject")
                    .name
                    .replace(".xcworkspace", ".xcodeproj"),
                "project.pbxproj",
            );
        },
        buildGradlePath: () => {
            const androidProject = required(cliConfigs?.project?.android, "project.android");

            return path.join(
                required(androidProject.sourceDir, "project.android.sourceDir"),
                required(androidProject.appName, "project.android.appName"),
                "build.gradle",
            );
        },
        // code validates these casts, we cast to make api above allow only valid values
        // for type checked usages
        type: cliArgs.type as SemVer,
        semver: cliArgs.semver,
        skipCodeFor: cliArgs.skipCodeFor
            ? cliArgs.skipCodeFor.split(" ") as Platforms[]
            : [],
        skipSemVerFor: cliArgs.skipSemverFor
            ? cliArgs.skipSemverFor.split(" ") as Platforms[]
            : [],
    });
};
