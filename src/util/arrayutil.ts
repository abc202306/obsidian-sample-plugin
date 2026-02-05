export default class ArrayUtil {
    static safeArray(v: any) {
        if (!v) { return []; }
        if (Array.isArray(v)) { return v; }
        return [v];
    }
}