/**
 * @version v1.0.1.20260204
 */

import { App, FrontMatterCache, MarkdownFileInfo, TFile } from "obsidian";

import ArrayUtil from "./util/arrayutil.js"
import AstNode from "./model/astnode.js";
import Link from "./model/link.js";

declare const app: App;

class StringTemplate {
    public static getFolderHeadingText(folderPath: string): string {
        return (folderPath.split("/").filter(part => part.length !== 0).at(-1) || "");
    }

    public static replaceAllImageEmbed(comment: string): string {
        const IMAGE_EMBED_REGEXP = /\!(?<wikilink>\[\[(?<path>.*?\.(png|jpg|webp|svg))\|(?<width>\d+)\]\])/;
        let match;
        while (true) {
            match = IMAGE_EMBED_REGEXP.exec(comment);

            if (!match) {
                break;
            }
            const wikilinkObj = Link.parseWikiLink(match.groups?.wikilink);
            const imageNode = wikilinkObj?.toImageNode(parseInt(match.groups?.width || "200"));
            comment = comment.replace(IMAGE_EMBED_REGEXP, imageNode?.toString() || "");
        }
        return comment;
    }
}

class Page {
    file: TFile;
    note: FrontMatterCache;
    formula: Record<string, any>;
    constructor({file, note, formula}: {file: TFile, note: FrontMatterCache, formula: Record<string, any>}) {
        this.file = file;
        this.note = note;
        this.formula = formula;
    }
}

class AstNodeTemplate {
    public static moc(FOLDER_ARRAY: string[]): AstNode {
        const infoArray: { li: AstNode, mocData: AstNode[] }[] = FOLDER_ARRAY.map(folder => {
            const folderHeadingText = StringTemplate.getFolderHeadingText(folder);
            const mocData = AstNodeTemplate.collectionMOC(folder);
            const ul = mocData[1]!!;
            const li = AstNode.li().setChildren([
                AstNode.p().setChildren([AstNode.textMarkA({ textMarkAHref: `#${folderHeadingText}`, textMarkTextContent: folderHeadingText })]),
                ul
            ])
            return { li, mocData };
        })
        const docNode = AstNode.doc().setChildren([
            AstNode.blockquote().setChildren([AstNode.ul().setChildren(infoArray.map(info => info.li))]),
            ...infoArray.flatMap(info => info.mocData)
        ]);
        return docNode;
    }
    private static collectionMOC(folderPath: string): AstNode[] {
        const nodeArrArr: AstNode[][] = app.vault.getMarkdownFiles()
            .filter((file: TFile) => file.path.startsWith(folderPath))
            .map((file: TFile) => {
                const fileCache = app.metadataCache.getFileCache(file);
                const note = fileCache?.frontmatter || {};
                const formula = {
                    tags: ArrayUtil.safeArray(note.tags).concat(ArrayUtil.safeArray(fileCache?.tags?.map((tagInfo: { tag: string }) => tagInfo.tag.slice(1))?.unique())),
                    additionalInfo: Object.entries(note)
                        .filter(([key, _]) => !["title", "url", "ctime", "description", "cover", "icon", "comment", "keywords", "categories", "tags"].includes(key))
                        .reduce((obj, [key, value]) => {
                            if (value === null || value === undefined) return obj;
                            obj[key] = value;
                            return obj;
                        }, {} as any),
                    image: note.cover || note.icon || note.image
                }
                return new Page({
                    file,
                    formula,
                    note
                })
            }).sort((a: Page, b: Page) => b.note.ctime.localeCompare(a.note.ctime))
            .map(AstNodeTemplate.itemSection);

        return [
            AstNode.h({ headingLevel: 2 }).setChildren([
                AstNode.mdText({ data: StringTemplate.getFolderHeadingText(folderPath) })
            ]),
            AstNode.ul().setChildren(nodeArrArr.map(nodeArr => AstNode.li().setChildren([nodeArr[1] as AstNode]))),
            ...nodeArrArr.flatMap(nodeArr => nodeArr)
        ];
    }

    private static tagParagraph(page: Page): AstNode {
        const {note, formula} = page;
        const tagParagraphChildren = ArrayUtil.safeArray(note?.categories).concat(ArrayUtil.safeArray(note?.keywords)).concat(formula?.tags).map(k => {
            const wikilinkObj = Link.parseWikiLink(k);
            if (!wikilinkObj) {
                return AstNode.mdText({ data: `#${k}` });
            }
            const file = app.metadataCache.getFirstLinkpathDest(wikilinkObj.path, "");
            const path = file ? file.path : wikilinkObj.path;
            const display = wikilinkObj.display ? `#${wikilinkObj.display}` : null;
            return AstNode.textMarkBlockRef({ textMarkBlockRefId: path, textMarkTextContent: display });
        }).flatMap(item => [AstNode.text({ data: ", " }), item]).slice(1);

        const tagParagraph = tagParagraphChildren.length !== 0
            ? AstNode.p().setChildren(tagParagraphChildren)
            : AstNode.p().setChildren([AstNode.text({ data: "No tags" })]);

        return tagParagraph;
    }

    private static additionalInfo(page: Page): AstNode {
        const {formula} = page;
        if (!formula?.additionalInfo || formula?.additionalInfo.length === 0) {
            return AstNode.p().setChildren([AstNode.text({ data: "No additional note" })]);
        }

        const node = AstNode.table();

        const tableHeadRow = AstNode.tableRow().setChildren([AstNode.tableCell().setChildren([AstNode.text({ data: "" })]), AstNode.tableCell().setChildren([AstNode.text({ data: "" })])])

        const tableHeadNode = AstNode.tableHead().setChildren([tableHeadRow]);

        node.children.push(tableHeadNode);

        Object.entries(formula.additionalInfo).forEach(([key, value]) => {
            const keyCell = AstNode.tableCell().setChildren([AstNode.mdText({ data: key })]);
            const valueCell = AstNode.tableCell().setChildren(AstNodeTemplate.propValue(value));
            const rowNode = AstNode.tableRow().setChildren([keyCell, valueCell]);
            node.children.push(rowNode);
        })

        return node;
    }

    private static itemSection(page: Page): AstNode[] {
        const {file, note, formula} = page;
        return [
            AstNode.h({ headingLevel: 3 }).setChildren([AstNode.mdText({ data: file.basename })]),
            AstNode.p().setChildren([
                AstNode.textMarkA({ textMarkAHref: `#${file.basename}`, textMarkTextContent: note?.title }),
                AstNode.text({ data: ` | ` }),
                AstNode.textMarkBlockRef({ textMarkBlockRefId: file.path, textMarkTextContent: "file" }),
                AstNode.text({ data: ` | ` }),
                AstNode.textMarkA({ textMarkAHref: note?.url, textMarkTextContent: "url" }),
            ]),
            AstNode.p().setChildren([
                AstNode.mdText({ data: note?.description || "No description" })
            ]),
            AstNodeTemplate.tagParagraph(page),
            Link.parseWikiLink(formula?.image)?.toImageNode() ?? AstNode.p().setChildren([AstNode.text({ data: "No image" })]),
            AstNode.p().setChildren([
                AstNode.mdText({ data: `Created at: ${note?.ctime}` })
            ]),
            AstNode.blockquote().setChildren([
                AstNode.p().setChildren([
                    AstNode.mdText({ data: StringTemplate.replaceAllImageEmbed(note?.comment?.replace(/<br>/g, "\n") || "No comment") })
                ])
            ]),
            AstNodeTemplate.additionalInfo(page),
        ]
    }

    private static propValue(value: any, isEnableMDTextForCommonText: boolean = false): AstNode[] {
        if (value === null || value === undefined) {
            return [];
        }
        if (Array.isArray(value)) {
            return value.flatMap(v => [AstNode.br(), ...AstNodeTemplate.propValue(v, isEnableMDTextForCommonText)]).slice(1);
        }
        if (typeof value === "string") {
            const wikilinkObj = Link.parseWikiLink(value);
            const mdlinkObj = Link.parseMDLink(value);
            if (wikilinkObj) {
                const imageNode = wikilinkObj.toImageNode();
                return [wikilinkObj.toMDLink(), imageNode ? AstNode.br() : null, imageNode].filter(value => value !== null);
            } else if (mdlinkObj) {
                return [mdlinkObj.toMDLink()];
            } else if (/^http(s)?:\/\//.test(value)) {
                return [AstNode.textMarkA({ textMarkAHref: value, textMarkTextContent: value })];
            } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
                return [AstNode.mdText({ data: value })]
            } else {
                return [isEnableMDTextForCommonText ? AstNode.mdText({ data: value }) : AstNode.text({ data: value })];
            }
        }
        return [AstNode.text({ data: value + "" })];
    }
}

export default function getVideoMOC(FOLDER_ARRAY: string[]): string {
    return AstNodeTemplate.moc(FOLDER_ARRAY).toString();
}
