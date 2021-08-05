# 1.3.0

Reverted the changes from 1.2.0, it seems that RN cli is somehow unstable with its
params for plugins

This should fix the build gradle not being found properly again

# 1.2.0

Made the cli prefer using the `buildGradlePath` from RN cli, this probably doesn't 
break any existing project, but for safety I'm doing a minor here.

# 1.1.0

Changed `--version` flag to `--semver` due to issues with react-native
cli with that argument
