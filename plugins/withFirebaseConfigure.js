import configPlugins from 'expo/config-plugins.js';
import fs from 'fs';
import path from 'path';

const { withDangerousMod } = configPlugins;

/**
 * Expo config plugin that injects FirebaseApp.configure() into the Swift AppDelegate.
 *
 * This is needed because @react-native-firebase/app's built-in plugin uses a regex
 * anchored on `self.moduleName = "..."` which no longer exists in Expo SDK 55+
 * AppDelegate templates (React Native 0.83+).
 */
const withFirebaseConfigure = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const appDelegatePath = path.join(
        config.modRequest.projectRoot,
        'ios',
        config.modRequest.projectName,
        'AppDelegate.swift'
      );

      let contents = fs.readFileSync(appDelegatePath, 'utf-8');

      // Skip if already configured
      if (contents.includes('FirebaseApp.configure()')) {
        return config;
      }

      // Add import if missing
      if (!contents.includes('import FirebaseCore')) {
        contents = contents.replace(/import Expo/, 'import Expo\nimport FirebaseCore');
      }

      // Insert FirebaseApp.configure() at the start of didFinishLaunchingWithOptions
      contents = contents.replace(
        /(didFinishLaunchingWithOptions launchOptions:.*\n\s*\) -> Bool \{\n)/,
        '$1    FirebaseApp.configure()\n\n'
      );

      fs.writeFileSync(appDelegatePath, contents);
      return config;
    },
  ]);
};

export default withFirebaseConfigure;
