# react-native-cli-bump-version

A **simple** react-native cli plugin to bump versions at platform files

## Install

`npm i --save-dev react-native-cli-bump-version`

`yarn add -D react-native-cli-bump-version`

## Usage

Since this is a react-native cli plugin, after adding it to the project
you can call:

```shell script
npx react-native bump-version --type patch
```
That should produce this:
```shell script
iOS project.pbxproj code: 24 -> 25
Android build.gradle code: 23 -> 24
iOS project.pbxproj version: 1.10.6 -> 1.10.7
Android gradle.build version: 1.10.6 -> 1.10.7
package.json: 1.10.6 -> 1.10.7
```

The plugin updates and write the output listed files, and it's up to you to
commit them.

## Flags

Just ask for help:

```shell script
npx react-native bump-version --help

Options:
  --type [major|minor|patch]           SemVer release type, optional if --skip-semver-for all is passed
  --skip-semver-for [android|ios|all]  Skips bump SemVer for specified platform
  --skip-code-for [android|ios|all]    Skips bump version codes for specified platform
  --version                            Pass release version if known. Overwrites calculated SemVer. Optional.
  -h, --help                           output usage information
```

### Recommendations

#### Use gradle for SemVer sync
Android can handle automatically semantic version sync with `package.json`:

```groovy
import groovy.json.JsonSlurper

def getNpmVersion() {
    def inputFile = file("$rootDir/../package.json")
    def jsonPackage = new JsonSlurper().parseText(inputFile.text)

    return jsonPackage["version"]
}

android {
  ...
  defaultConfig {
        applicationId "com.example"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 25
        versionName getNpmVersion()
        ...
    }
    ...
}
```

Note: with this you should pass `--skip-semver-for android`, otherwise the cli
will break.

#### Use MARKETING_VERSION in `Info.plist`

I've choose to remove the `Info.plist` manipulation as it was not needed
if it uses the `MARKETING_VERSION` env var, so be sure that your project/xcode is updated and that
the `Info.plist` file has `MARKETING_VERSION` instead of SemVer string:

```xml
	<key>CFBundleShortVersionString</key>
	<string>$(MARKETING_VERSION)</string>
```

### Mention

I tried to find a tool that did this before starting it:
 
 * [rnbv](https://github.com/llotheo/react-native-cli-bump-version) inspired my initial sources
 * [react-native-version](https://github.com/stovmascript/react-native-version) actually does what I was
 looking for, but I already had written the tool, so I just published it anyway. 
