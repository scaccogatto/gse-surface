import Gio from './gio.js';

export class Extension {
    constructor(metadata) {
        this.metadata = metadata;
        this.dir = Gio.File.new_for_path('/extension');
    }
}
