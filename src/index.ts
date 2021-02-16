import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import { pipe, split, curry, map, replace } from 'ramda'

export type SemVer = 'major' | 'minor' | 'patch'
export type Platforms = 'android' | 'ios' | 'all'

type Configs = {
    type?: SemVer
    semver?: string
    skipSemVerFor: Platforms[]
    skipCodeFor: Platforms[]
    root: string
    pbxprojPath: string
    buildGradlePath: string
}

const success = chalk.green

const writeFile =
    (fPath: string, file: string) => fs.writeFileSync(fPath, file, 'utf8')

const parseDecimal = (it: string) => parseInt(it, 10)

const parseSemVer = pipe(split('.'), map(parseDecimal))

const matchFirst = curry((reg: RegExp, value: string) => {
    const [, first] = ([] as string[]).concat(reg.exec(value)!)

    return first
})

const incrementSemVer = (current: string, type: SemVer | undefined) => {
    const [major, minor, patch] = parseSemVer(current)

    if (type === 'major') {
        return [major + 1, 0, 0].join('.')
    }

    if (type === 'minor') {
        return [major, minor + 1, 0].join('.')
    }

    if (type === 'patch') {
        return [major, minor, patch + 1].join('.')
    }

    throw new Error(`'${ type }' is not a semver type`)
}

abstract class BaseFileManager {
    private readonly basePath: string
    protected content: string | null = null

    constructor(basePath: string) {
        this.basePath = basePath
    }

    protected read() {
        if (this.content === null) {
            this.content = fs.readFileSync(this.basePath, 'utf8')
        }

        return this.content
    }

    write() {
        if (this.content) {
            return writeFile(this.basePath, this.content)
        }
    }
}

class PBXManager extends BaseFileManager {
    bumpProjectVersion() {
        const currentFile = this.read()
        const codeRegex = /CURRENT_PROJECT_VERSION = (\d+);/g
        const currentCode = pipe(
            matchFirst(codeRegex),
            parseDecimal
        )(currentFile)
        const nextCode = currentCode + 1

        this.content = replace(
            codeRegex,
            `CURRENT_PROJECT_VERSION = ${ nextCode };`,
            currentFile
        )

        return {
            current: currentCode,
            next: nextCode
        }
    }

    setMarketingVersion(nextVersion: string) {
        const currentFile = this.read()
        const versionRegex = /MARKETING_VERSION = (.*);/g
        const currentVersion = matchFirst(versionRegex, currentFile)

        this.content = replace(
            versionRegex,
            `MARKETING_VERSION = ${ nextVersion };`,
            currentFile
        )

        return {
            current: currentVersion,
            next: nextVersion
        }
    }
}

class BuildGradleManager extends BaseFileManager {
    bumpCode() {
        const currentFile = this.read()!
        const codeExp = /versionCode (\d+)/

        const versionMatch = matchFirst(codeExp, currentFile)
        const current = parseDecimal(versionMatch)
        const next = current + 1

        if (isNaN(next)) {
            throw new Error(`Invalid versionCode version parsed (${ versionMatch })`)
        }

        this.content = currentFile.replace(codeExp, `versionCode ${ next }`)

        return { current, next }
    }

    setVersionName(next: string) {
        const currentFile = this.read()!
        const quotes = /[^"']+/
        const nameExp = /versionName ('.*'|".*")/

        const current = matchFirst(nameExp, currentFile)
        const newVersionName = current.replace(quotes, next)

        this.content = currentFile.replace(
          nameExp,
          // Here we try to prevent quotes style...
          // which may be unnecessary, but who knows?
          `versionName ${newVersionName}`
        )

        return { current, next }
    }
}

class PackageJSONManager {
    private readonly basePath: string
    private content: {
        version: string
    } | null = null

    constructor(basePath: string) {
        this.basePath = basePath
    }

    private read() {
        if (this.content === null) {
            this.content = require(this.basePath)
        }

        return this.content!
    }

    write() {
        if (this.content) {
            return writeFile(
                this.basePath,
                JSON.stringify(this.content, null, 2)
            )
        }
    }

    getVersion() {
        return this.read().version
    }

    setVersion(next: string) {
        const current = this.getVersion()
        this.content!.version = next

        return {
            next,
            current
        }
    }
}


class AppJSONManager {
    private readonly basePath: string
    private content: {
        expo: {
            version: string
        }
    } | null = null

    constructor(basePath: string) {
        this.basePath = basePath
    }

    private read() {
        if (this.content === null) {
            try {
                this.content = require(this.basePath)
                console.log(info(`Expo app.json detected, app.json will be updated.`)
            } catch(e) {
                console.log(`Could not load expo app.json, skiping it ${(e?.message)}`)
            }
        }

        return this.content!
    }

    write() {
        if (this.content) {
            return writeFile(
                this.basePath,
                JSON.stringify(this.content, null, 2)
            )
        }
    }

    getVersion() {
        return this.read()?.expo?.version
    }

    setVersion(next: string) {
        const current = this.getVersion()
        if(this.content) {
            this.content = {
                ...this.content,
                expo: {
                    ...this.content?.expo,
                    version: next
                }
            }
        }

        return {
            next,
            current
        }
    }
}

export class ProjectFilesManager {
    readonly configs: Configs
    readonly pbx: PBXManager
    readonly buildGradle: BuildGradleManager
    readonly packageJSON: PackageJSONManager
    readonly appJSON: AppJSONManager

    constructor(configs: Configs) {
        const {
            root,
            pbxprojPath,
            buildGradlePath
        } = configs

        this.configs = configs
        this.buildGradle = new BuildGradleManager(buildGradlePath)
        this.pbx = new PBXManager(pbxprojPath)
        this.packageJSON = new PackageJSONManager(path.join(
            root,
            'package.json'
        ))
        this.appJSON = new AppJSONManager(path.join(
            root,
            'app.json'
        ))
    }

    syncSemver(semverString: string) {
        const { skipSemVerFor } = this.configs

        if (!skipSemVerFor.includes('ios')) {
            const {
                next: pbxNext,
                current: pbxCurrent
            } = this.pbx.setMarketingVersion(semverString)
            console.log(success(`iOS project.pbxproj version: ${ pbxCurrent } -> ${ pbxNext }`))
        }

        if (!skipSemVerFor.includes('android')) {
            const {
                next: gradleNext,
                current: gradleCurrent
            } = this.buildGradle.setVersionName(semverString)
            console.log(success(`Android gradle.build version: ${ gradleCurrent } -> ${ gradleNext }`))
        }

        const {
            next: packageNext,
            current: packageCurrent
        } = this.packageJSON.setVersion(semverString)
        console.log(success(`package.json: ${ packageCurrent } -> ${ packageNext }`))

        const {
            next: appNext,
            current: appCurrent
        } = this.appJSON.setVersion(semverString)
        appCurrent && console.log(success(`app.json: ${ appCurrent } -> ${ appNext }`))

    }

    bumpCodes() {
        const { skipCodeFor } = this.configs

        if (!skipCodeFor.includes('ios')) {
            const {
                next: pbxNext,
                current: pbxCurrent
            } = this.pbx.bumpProjectVersion()
            console.log(success(`iOS project.pbxproj code: ${ pbxCurrent } -> ${ pbxNext }`))
        }

        if (!skipCodeFor.includes('android')) {
            const {
                next: gradleNext,
                current: gradleCurrent
            } = this.buildGradle.bumpCode()
            console.log(success(`Android build.gradle code: ${ gradleCurrent } -> ${ gradleNext }`))
        }

    }

    run() {
        this.dryRun()
        this.pbx.write()
        this.buildGradle.write()
        this.packageJSON.write()
        this.appJSON.write()
    }

    /**
     * Separated for testing
     *
     * This executes changes but don't actually write anything to fs
     */
    dryRun() {
        const { type, semver, skipSemVerFor, skipCodeFor } = this.configs
        const current = this.packageJSON.getVersion()
        const next = semver ?? incrementSemVer(current, type ?? 'minor')

        if (!skipCodeFor.includes('all')) {
            this.bumpCodes()
        }

        if (!skipSemVerFor.includes('all')) {
            if (!type) {
                throw new Error('SemVer type not specified')
            }

            this.syncSemver(next)
        }

        return this;
    }
}

export const versioner = (configs: Configs) => {
    new ProjectFilesManager(configs).run()
}
