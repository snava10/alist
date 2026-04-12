import configPlugins from 'expo/config-plugins.js';
import fs from 'fs';
import path from 'path';

const { withDangerousMod } = configPlugins;

/**
 * Expo config plugin that patches the fmt pod's base.h header to force-disable
 * consteval, fixing compilation errors with newer Xcode/Clang versions.
 *
 * The fmt library's #if/#elif chain for FMT_USE_CONSTEVAL doesn't account for
 * newer Apple Clang versions where consteval is defined but still broken.
 * We inject a post_install hook that patches the header directly.
 */
const withFmtFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.projectRoot, 'ios', 'Podfile');

      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // Skip if already patched
      if (contents.includes('fmt_base_path')) {
        return config;
      }

      const fmtPatch = `
    # Fix fmt library consteval error with newer Xcode/Clang versions
    fmt_base_path = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base_path)
      fmt_content = File.read(fmt_base_path)
      unless fmt_content.include?('PATCHED_FMT_CONSTEVAL')
        fmt_content = fmt_content.sub(
          /\\/\\/ Detect consteval.*?#endif\\n#if FMT_USE_CONSTEVAL/m,
          "// PATCHED_FMT_CONSTEVAL: force-disable consteval for Apple Clang compatibility\\n#define FMT_USE_CONSTEVAL 0\\n#if FMT_USE_CONSTEVAL"
        )
        File.write(fmt_base_path, fmt_content)
      end
    end`;

      // Insert the patch after react_native_post_install
      contents = contents.replace(/(react_native_post_install\([\s\S]*?\)\n)/, `$1${fmtPatch}\n`);

      fs.writeFileSync(podfilePath, contents);

      return config;
    },
  ]);
};

export default withFmtFix;
