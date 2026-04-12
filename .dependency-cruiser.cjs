/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ──────────────────────────────────────────────
    // RULE 1: UI screens/components cannot import Firebase directly
    // They must go through Core/Storage (the data access layer)
    // ──────────────────────────────────────────────
    {
      name: 'no-direct-firebase-from-screens',
      comment:
        'Screens and UI components must not import Firebase directly. ' +
        'Use Core/Storage as the data access layer instead.',
      severity: 'error',
      from: {
        path: '^component/(HomeScreen|AddItemModal|AListItem|ConfirmationModal)',
      },
      to: {
        path: '@react-native-firebase/firestore',
      },
    },
    {
      name: 'no-direct-firestore-from-profile',
      comment:
        'ProfileScreen must not import Firestore directly. ' +
        'Use Core/Storage as the data access layer instead.',
      severity: 'error',
      from: {
        path: '^component/ProfileScreen',
      },
      to: {
        path: '@react-native-firebase/firestore',
      },
    },

    // ──────────────────────────────────────────────
    // RULE 2: UI components cannot access AsyncStorage directly
    // All persistence goes through Core/Storage
    // ──────────────────────────────────────────────
    {
      name: 'no-direct-async-storage-from-ui',
      comment:
        'UI components must not import AsyncStorage directly. ' +
        'Use Core/Storage as the data access layer.',
      severity: 'error',
      from: {
        path: '^component/(HomeScreen|ProfileScreen|AddItemModal|AListItem|ConfirmationModal)',
      },
      to: {
        path: '@react-native-async-storage/async-storage',
      },
    },

    // ──────────────────────────────────────────────
    // RULE 3: Login modules cannot access Firestore directly
    // Auth modules handle authentication only; data goes through Core/Storage
    // ──────────────────────────────────────────────
    {
      name: 'no-direct-firestore-from-login',
      comment:
        'Login modules must not import Firestore directly. ' +
        'Use Core/Storage for any data operations.',
      severity: 'error',
      from: {
        path: '^component/Login/',
      },
      to: {
        path: '@react-native-firebase/firestore',
      },
    },

    // ──────────────────────────────────────────────
    // RULE 4: Core/DataModel and Core/GlobalStyles must stay pure
    // They define types and styles — no side effects or storage imports
    // ──────────────────────────────────────────────
    {
      name: 'datamodel-must-be-pure',
      comment:
        'DataModel defines types and enums only. ' +
        'It must not import Storage, Security, or Firebase.',
      severity: 'error',
      from: {
        path: '^component/Core/DataModel',
      },
      to: {
        path: '(Core/Storage|Core/Security|@react-native-firebase|@react-native-async-storage)',
      },
    },
    {
      name: 'globalstyles-must-be-pure',
      comment:
        'GlobalStyles defines styles only. ' +
        'It must not import Storage, Security, DataModel, or Firebase.',
      severity: 'error',
      from: {
        path: '^component/Core/GlobalStyles',
      },
      to: {
        path: '(Core/Storage|Core/Security|Core/DataModel|@react-native-firebase|@react-native-async-storage)',
      },
    },

    // ──────────────────────────────────────────────
    // RULE 5: Login module cannot import screen-level components
    // Login handles auth; it should not depend on HomeScreen etc.
    // ──────────────────────────────────────────────
    {
      name: 'no-screens-from-login',
      comment:
        'Login modules must not import screen-level components. ' +
        'Login handles authentication only.',
      severity: 'error',
      from: {
        path: '^component/Login/',
      },
      to: {
        path: '^component/(HomeScreen|ProfileScreen|AddItemModal|AListItem|ConfirmationModal)',
      },
    },

    // ──────────────────────────────────────────────
    // RULE 6: No circular dependencies
    // ──────────────────────────────────────────────
    {
      name: 'no-circular',
      comment: 'No circular dependencies allowed.',
      severity: 'error',
      from: {},
      to: {
        circular: true,
      },
    },

    // ──────────────────────────────────────────────
    // RULE 7: Core modules cannot import from UI components
    // Core is a lower layer — it must not depend on screens or modals
    // ──────────────────────────────────────────────
    {
      name: 'no-ui-from-core',
      comment: 'Core modules must not import UI components. ' + 'Core is a lower-level layer.',
      severity: 'error',
      from: {
        path: '^component/Core/',
      },
      to: {
        path: '^component/(HomeScreen|ProfileScreen|AddItemModal|AListItem|ConfirmationModal|Login/)',
      },
    },

    // ──────────────────────────────────────────────
    // RULE 8: No orphan modules (files that are never imported)
    // Helps catch dead code that AI might generate
    // ──────────────────────────────────────────────
    {
      name: 'no-orphans',
      comment: 'Modules must be imported by at least one other module.',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(cjs|mjs|js|json)$', // config files
          '\\.d\\.ts$', // type declarations
          '(^|/)__tests__/', // test files
          '(^|/)__mocks__/', // mock files
          '^App\\.tsx$', // app entry point
          '^index\\.js$', // metro entry point
          '\\.config\\.(js|cjs|mjs|ts|json)$', // config files
          '^plugins/', // expo plugins
          '^scripts/', // scripts
          '^e2e/', // e2e tests
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: {
      path: [
        'node_modules',
        'android',
        'ios',
        '\\.git',
        'coverage',
        'reports',
        'firebase-emulator',
      ],
    },
    exclude: {
      path: ['__tests__', '__mocks__', '\\.test\\.tsx?$', '\\.spec\\.tsx?$'],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/(@[^/]+/[^/]+|[^/]+)',
        theme: {
          graph: {
            splines: 'ortho',
          },
        },
      },
      text: {
        highlightFocused: true,
      },
    },
  },
};
