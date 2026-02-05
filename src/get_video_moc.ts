/**
 * @version v1.0.1.20260204
 */


import DateUtil from "./util/dateutil.js"
import ArrayUtil from "./util/arrayutil.js"
import AstNode from "./model/astnode.js";
import Link from "./model/link.js";

declare const app: any;
declare const module: any;

interface ItemData {
    path: string;
    title: string;
    url: string;
    description?: string;
    tags?: string[]
    image?: string;
    ctime: string;
    comment?: string;
    keywords?: string[];
    categories?: string[];
    note?: any;
    day?: string;
    month?: string;
    year?: string;
}

class Collection {
    public static getFolderHeadingText(folderPath: string): string {
        return (folderPath.split("/").filter(part => part.length !== 0).at(-1) || "");
    }
    public static getMOCData(folderPath: string): AstNode[] {
        const nodeArrArr: AstNode[][] = app.vault.getMarkdownFiles()
            .filter((file: any) => file.path.startsWith(folderPath))
            .map((file: any) => {
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
                return {
                    file,
                    formula,
                    note
                }
            }).sort((a: any, b: any) => b.note.ctime.localeCompare(a.note.ctime))
            .map(({file, formula, note}: any) => {
                const tagParagraphChildren = ArrayUtil.safeArray(note.categories).concat(ArrayUtil.safeArray(note.keywords)).concat(formula.tags).map(k => {
                    const wikilinkObj = Link.parseWikiLink(k);
                    if (!wikilinkObj) {
                        return AstNode.mdText(`#${k}`);
                    }
                    const file = app.metadataCache.getFirstLinkpathDest(wikilinkObj.path);
                    const path = file ? file.path : wikilinkObj.path;
                    const display = wikilinkObj.display ? `#${wikilinkObj.display}` : null;
                    return AstNode.textMarkBlockRef(path, display);
                }).flatMap(item => [AstNode.text(", "), item]).slice(1);

                const tagParagraph = tagParagraphChildren.length !== 0 
                    ? AstNode.p().setChildren(tagParagraphChildren) 
                    : AstNode.p().setChildren([AstNode.text("No tags")]);

                return [
                    AstNode.h(3).setChildren([AstNode.mdText(file.basename)]),
                    AstNode.p().setChildren([
                        AstNode.textMarkA(`#${file.basename}`, "section"),
                        AstNode.text(` | `),
                        AstNode.textMarkA(note.url, note.title),
                        AstNode.text(` | `),
                        AstNode.textMarkBlockRef(file.path, "file"),
                    ]),
                    AstNode.p().setChildren([
                        AstNode.mdText(note.description || "No description")
                    ]),
                    tagParagraph,
                    Link.parseWikiLink(formula.image)?.toImageNode() 
                        ?? AstNode.p().setChildren([AstNode.text("No image")]),
                    AstNode.p().setChildren([
                        AstNode.mdText(`Created at: ${note.ctime}`)
                    ]),
                    AstNode.blockquote().setChildren([
                        AstNode.p().setChildren([
                            AstNode.mdText(Collection.replaceAllImageEmbed(note.comment?.replace(/<br>/g, "\n") || "No comment"))
                        ])
                    ]),
                    formula.additionalInfo 
                        ? Collection.table(formula.additionalInfo) 
                        : AstNode.p().setChildren([AstNode.text("No additional note")]),
                ]
            });

        return [
            AstNode.h(2).setChildren([
                AstNode.mdText(Collection.getFolderHeadingText(folderPath))
            ]),
            AstNode.ul().setChildren(nodeArrArr.map(nodeArr => AstNode.li().setChildren([nodeArr[1] as AstNode]))),
            ...nodeArrArr.flatMap(nodeArr => nodeArr)
        ];
    }
    private static parseValueToNodeArray(value: any, isEnableMDTextForCommonText: boolean = false): AstNode[] {
        if (value === null || value === undefined) {
            return [];
        }
        if (Array.isArray(value)) {
            return value.flatMap(v => [AstNode.br(), ...Collection.parseValueToNodeArray(v, isEnableMDTextForCommonText)]).slice(1);
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
                return [AstNode.textMarkA(value, value)];
            } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
                return [AstNode.mdText(value)]
            } else {
                return [isEnableMDTextForCommonText ? AstNode.mdText(value) : AstNode.text(value)];
            }
        }
        return [AstNode.text(value + "")];
    }



    private static table(object: Record<string, any>[]): AstNode {
        const node = AstNode.table();

        if (!object || object.length === 0) {
            return node;
        }

        const tableHeadRow = AstNode.tableRow().setChildren([AstNode.tableCell().setChildren([AstNode.text("")]), AstNode.tableCell().setChildren([AstNode.text("")])])

        const tableHeadNode = AstNode.tableHead().setChildren([tableHeadRow]);

        node.children.push(tableHeadNode);

        Object.entries(object).forEach(([key, value]) => {
            const keyCell = AstNode.tableCell().setChildren([AstNode.mdText(key)]);
            const valueCell = AstNode.tableCell().setChildren(Collection.parseValueToNodeArray(value));
            const rowNode = AstNode.tableRow().setChildren([keyCell, valueCell]);
            node.children.push(rowNode);
        })

        return node;
    }

    private static replaceAllImageEmbed(comment: string): string {
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

export default function getVideoMOC(FOLDER_ARRAY: string[]): string {
    const infoArray: [AstNode, AstNode[]][] = FOLDER_ARRAY.map(folder => {
        const folderHeadingText = Collection.getFolderHeadingText(folder);
        const mocData = Collection.getMOCData(folder);
        const ul = mocData[1]!!;
        const li = AstNode.li().setChildren([
            AstNode.p().setChildren([AstNode.textMarkA(`#${folderHeadingText}`, folderHeadingText)]),
            ul
        ])
        return [li, mocData];
    })
    const ul = AstNode.ul().setChildren(infoArray.map(info => info[0]));
    const blockquote = AstNode.blockquote().setChildren([ul]);
    const docNode = AstNode.doc().setChildren([
        blockquote,
        ...infoArray.flatMap(info => info[1])
    ]);
    return docNode.toString();
}
