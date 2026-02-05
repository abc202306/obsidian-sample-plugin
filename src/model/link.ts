
import AstNode from "./astnode.js";
import Config from "../config.js";

declare const app: any;

export default class Link {
    static readonly BARE_LINK_REGEX: RegExp = /^\[\[(.*)\]\]$/;
    static readonly DISPLAY_LINK_REGEX: RegExp = /^\[\[(.*?)\|(.*)\]\]$/;
    static readonly MD_LINK_REGEX: RegExp = /^\[(.*)\]\((.*)\)$/;

    path: string;
    display: string | null;

    constructor(path: string, display: string | null = null) {
        this.path = path;
        this.display = display;
    }

    static parseMDLink(linkString: string | undefined | null): Link | null {
        if (!linkString) return null;
        const match = this.MD_LINK_REGEX.exec(linkString);
        if (match) {
            return new Link(match[2]!!, match[1]!!);
        }
        return null;
    }

    static parseWikiLink(linkString: string | undefined | null): Link | null {
        if (!linkString) return null;
        const displayMatch = this.DISPLAY_LINK_REGEX.exec(linkString);
        if (displayMatch) {
            return new Link(displayMatch[1]!!, displayMatch[2]!!);
        }
        const bareMatch = this.BARE_LINK_REGEX.exec(linkString);
        if (bareMatch) {
            return new Link(bareMatch[1]!!, null);
        }
        return null;
    }

    toWikiLink() {
        return AstNode.textMarkBlockRef({ textMarkBlockRefId: this.path, textMarkTextContent: this.display });
    }

    toMDLink() {
        const file = app.metadataCache.getFirstLinkpathDest(this.path);
        const href = file ? file.path : this.path;
        const textContent = this.display || href;
        return AstNode.textMarkA({ textMarkAHref: href, textMarkTextContent: textContent });
    }

    toImageNode(width: number = Config.DEFAULT_IMAGE_WIDTH): AstNode | null {
        const file = app.metadataCache.getFirstLinkpathDest(this.path);
        if (!file || !["jpg", "png", "webp", "svg"].includes(file.extension)) return null;
        return AstNode.image({ src: file.path, alt: this.display || '', width: width });
    }
}