import StringUtil from "../util/stringutil.js"
import Config from "../config.js";

class AstNodeType {
    static nodeDocument = "NodeDocument";
    static nodeHeading = "NodeHeading";
    static nodeParagraph = "NodeParagraph";
    static nodeListItem = "NodeListItem";
    static nodeList = "NodeList";
    static nodeText = "NodeText";
    static nodeMDText = "NodeMDText";
    static nodeTextMark = "NodeTextMark";
    static nodeBlockquote = "NodeBlockquote";
    static nodeBlockquoteMarker = "NodeBlockquoteMarker";
    static nodeImage = "NodeImage";
    static nodeBang = "NodeBang";
    static nodeOpenBracket = "NodeOpenBracket";
    static nodeCloseBracket = "NodeCloseBracket";
    static nodeOpenParen = "NodeOpenParen";
    static nodeCloseParen = "NodeCloseParen";
    static nodeLinkText = "NodeLinkText";
    static nodeLinkDest = "NodeLinkDest";
    static nodeTable = "NodeTable";
    static nodeTableHead = "NodeTableHead";
    static nodeTableRow = "NodeTableRow";
    static nodeTableCell = "NodeTableCell";
    static nodeBr = "NodeBr";
}

enum TextMarkType {
    blockRef = "block-ref",
    a = "a",
}

export default class AstNode {
    id: string | null = null;
    type: AstNodeType;
    data: string | null = null;
    children: AstNode[] = [];
    headingLevel: number | null = null;

    textMarkType?: TextMarkType;
    textMarkTextContent?: string | null;
    textMarkAHref?: string;
    textMarkBlockRefId?: string;

    properties?: Record<string, unknown>;

    constructor(type: AstNodeType) {
        this.type = type;
    }

    setData(data: string) {
        this.data = data;
        return this;
    }

    setHeadingLevel(headingLevel: number) {
        this.headingLevel = headingLevel;
        return this;
    }

    setChildren(children: AstNode[]) {
        this.children = children;
        return this;
    }

    toString(indent: number = -1): string {
        const TAB = Config.TAB_CHAR;
        const DASH = Config.DASH_CHAR;
        const HEAD = Config.HEADING_PREFIX;

        switch (this.type) {
            case AstNodeType.nodeDocument:
                return this.children.map(child => child.toString(indent)).join("\n\n");
            case AstNodeType.nodeHeading:
                return `${HEAD.repeat(this.headingLevel || 1)} ${this.children.map(child => child.toString(indent)).join("")}`;
            case AstNodeType.nodeMDText:
                return this.data ?? "";
            case AstNodeType.nodeText:
                return StringUtil.escapeMarkdown(this.data || "");
            case AstNodeType.nodeTextMark:
                switch (this.textMarkType) {
                    case TextMarkType.a:
                        return `[${this.textMarkTextContent ? StringUtil.escapeMarkdown(this.textMarkTextContent) : this.textMarkAHref}](<${this.textMarkAHref}>)`;
                    case TextMarkType.blockRef:
                        if (this.textMarkTextContent) {
                            return `[${StringUtil.escapeMarkdown(this.textMarkTextContent)}](<${this.textMarkBlockRefId}>)`;
                        } else {
                            return `[${StringUtil.escapeMarkdown(this.textMarkBlockRefId || "")}](<${this.textMarkBlockRefId}>)`;
                        }
                }
            case AstNodeType.nodeImage:
                const imgSrc = this.children.find(child => child.type === AstNodeType.nodeLinkDest)?.data ?? "";
                const imgAlt = this.children.find(child => child.type === AstNodeType.nodeLinkText)?.data ?? "";
                const width = this.properties?.width ?? Config.DEFAULT_IMAGE_WIDTH;
                return `<img src="${imgSrc}" width=${width} alt="${imgAlt}"/>`.replace(/\s+/g, ' ').trim();
            case AstNodeType.nodeBlockquoteMarker:
                return this.data ?? ">";
            case AstNodeType.nodeBlockquote:
                const marker = this.children.find(child => child.type === AstNodeType.nodeBlockquoteMarker) || ">";
                return this.children
                    .filter(child => child.type !== AstNodeType.nodeBlockquoteMarker)
                    .map(child => child.toString(indent)).join("\n").split("\n").map(line => {
                        return `${marker} ${line}`;
                    }).join("\n");
            case AstNodeType.nodeParagraph:
                return this.children.map(child => child.toString(indent)).join("");
            case AstNodeType.nodeListItem:
                let i = 0;
                const strParts = this.children.map((child) => {
                    if (child.type === AstNodeType.nodeList) {
                        const childStr = child.toString(indent);
                        i += childStr.split("\n").length;
                        return childStr;
                    }
                    const childStr = child.toString(indent).split("\n").map(line => {
                        const newLine = `${TAB.repeat(indent)}${i === 0 ? DASH : " "} ${line}`;
                        i++;
                        return newLine;
                    }).join("\n");
                    return childStr;
                });
                return strParts.join("\n");
            case AstNodeType.nodeList:
                return this.children.map(child => child.toString(indent + 1)).join("\n");
            case AstNodeType.nodeTable:
                const tableHead = this.children.find(child => child.type === AstNodeType.nodeTableHead);
                const tableRows = this.children.filter(child => child.type === AstNodeType.nodeTableRow);
                return [
                    tableHead?.toString(indent),
                    "|" + " --- |".repeat(tableHead?.children?.[0]?.children.length || 0),
                    ...tableRows.map(row => row.toString(indent))
                ].filter(item => item).join("\n");
            case AstNodeType.nodeTableHead:
                return this.children.filter(child => child.type === AstNodeType.nodeTableRow).map(row => row.toString(indent)).join("\n");
            case AstNodeType.nodeTableRow:
                return "| " + this.children.filter(child => child.type === AstNodeType.nodeTableCell).map(cell => cell.toString(indent)).join(" | ") + " |";
            case AstNodeType.nodeTableCell:
                return this.children.map(child => child.toString(indent)).join("");
            case AstNodeType.nodeBr:
                return "<br>";
        }

        return "";
    }


    static tableCell(): AstNode {
        return new AstNode(AstNodeType.nodeTableCell);
    }

    static tableRow(): AstNode {
        return new AstNode(AstNodeType.nodeTableRow);
    }

    static tableHead(): AstNode {
        return new AstNode(AstNodeType.nodeTableHead);
    }

    static table(): AstNode {
        return new AstNode(AstNodeType.nodeTable);
    }

    static text({ data }: { data: string }): AstNode {
        return new AstNode(AstNodeType.nodeText).setData(data);
    }

    static mdText({ data }: { data: string }): AstNode {
        return new AstNode(AstNodeType.nodeMDText).setData(data);
    }

    static br() {
        return new AstNode(AstNodeType.nodeBr).setData("br");
    }

    static textMarkA({ textMarkAHref, textMarkTextContent }: { textMarkAHref: string, textMarkTextContent: string }): AstNode {
        const node = new AstNode(AstNodeType.nodeTextMark);
        node.textMarkType = TextMarkType.a;
        node.textMarkAHref = textMarkAHref;
        node.textMarkTextContent = textMarkTextContent;
        return node;
    }

    static textMarkBlockRef({ textMarkBlockRefId, textMarkTextContent }: { textMarkBlockRefId: string, textMarkTextContent: string | null }): AstNode {
        const node = new AstNode(AstNodeType.nodeTextMark);
        node.textMarkType = TextMarkType.blockRef;
        node.textMarkBlockRefId = textMarkBlockRefId;
        node.textMarkTextContent = textMarkTextContent;
        return node;
    }

    static bang(): AstNode {
        return new AstNode(AstNodeType.nodeBang);
    }

    static openBracket(): AstNode {
        return new AstNode(AstNodeType.nodeOpenBracket);
    }

    static closeBracket(): AstNode {
        return new AstNode(AstNodeType.nodeCloseBracket);
    }

    static openParen(): AstNode {
        return new AstNode(AstNodeType.nodeOpenParen);
    }

    static closeParen(): AstNode {
        return new AstNode(AstNodeType.nodeCloseParen);
    }

    static linkText({data}:{data: string}): AstNode {
        return new AstNode(AstNodeType.nodeLinkText).setData(data);
    }

    static linkDest({data}:{data: string}): AstNode {
        return new AstNode(AstNodeType.nodeLinkDest).setData(data);
    }

    static image({src, alt = "", width = Config.DEFAULT_IMAGE_WIDTH}:{src: string, alt: string, width: number}): AstNode {
        const node = new AstNode(AstNodeType.nodeImage);

        node.properties = { width };
        node.setChildren([
            AstNode.bang(),
            AstNode.openBracket(),
            AstNode.linkText({data: alt}),
            AstNode.closeBracket(),
            AstNode.openParen(),
            AstNode.linkDest({data: src}),
            AstNode.closeParen()
        ]);

        return node;
    }

    static blockquoteMarker(): AstNode {
        return new AstNode(AstNodeType.nodeBlockquoteMarker).setData("\u003e");
    }

    static blockquote(): AstNode {
        return new AstNode(AstNodeType.nodeBlockquote).setChildren([AstNode.blockquoteMarker()]);
    }

    static p(): AstNode {
        return new AstNode(AstNodeType.nodeParagraph);
    }

    static li(): AstNode {
        return new AstNode(AstNodeType.nodeListItem);
    }

    static ul(): AstNode {
        return new AstNode(AstNodeType.nodeList);
    }

    static h({headingLevel}:{headingLevel:number}): AstNode {
        return new AstNode(AstNodeType.nodeHeading).setHeadingLevel(headingLevel);
    }

    static doc(): AstNode {
        return new AstNode(AstNodeType.nodeDocument);
    }
}