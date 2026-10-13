// Maps the GJS-only import specifiers (gi://, resource:///) used by the
// extension to small in-process stubs, so the extension modules can be
// loaded and exercised under Node's test runner.
import {registerHooks} from 'node:module';

const STUBS = {
    'gi://Gio': 'gio.js',
    'gi://GObject': 'gobject.js',
    'resource:///org/gnome/shell/extensions/extension.js': 'extension.js',
    'resource:///org/gnome/shell/ui/main.js': 'main.js',
    'resource:///org/gnome/shell/ui/popupMenu.js': 'popupMenu.js',
    'resource:///org/gnome/shell/ui/quickSettings.js': 'quickSettings.js',
};

registerHooks({
    resolve(specifier, context, nextResolve) {
        const stub = STUBS[specifier];
        if (stub)
            return {url: new URL(`./stubs/${stub}`, import.meta.url).href, shortCircuit: true};
        return nextResolve(specifier, context);
    },
});
