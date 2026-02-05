
export default class StringUtil {
    static escapeMarkdown(text: string): string {
        return text.replace(/([\\`*_[\]{}()#+\-.!])/g, '\\$1');
    }
}
